// src/engine/triangularArb.ts

import { logger } from '../logger';
import type { FeesBpsConfig } from '@/shared/types';
import {
  getSpotExchangeInfo,
  getSpotTickers24h,
  getSpotBookTickers,
  type SpotSymbolInfo,
  type Ticker24h,
  type BookTicker,
} from '../api/exchange';

export interface TriangularOpportunity {
  route: [string, string, string]; // [AUSDT, A/B or B/A, BUSDT]
  description: string; // USDT -> A -> B -> USDT (direction)
  midDirection: 'AtoB' | 'BtoA';
  netProfitBps: number;
}

function bpsFromFactor(factor: number): number {
  return (factor - 1) * 10_000;
}

// Nota: taxas e slippage são aplicadas no fluxo de quantidade dentro de computeTriangleFactor.

/**
 * Calcula o fator de multiplicação (USDT_final/USDT_inicial) para USDT->A->B->USDT, usando ask/bid.
 */
function computeTriangleFactor(
  pair1: { ask: number }, // USDT->A via AUSDT: comprar A
  pair2: { ask?: number; bid?: number; direction: 'AtoB' | 'BtoA' }, // A->B (se A/B existe, usa ask; se B/A existe, vender A por B usa bid)
  pair3: { bid: number }, // B->USDT: vender B
  fees: FeesBpsConfig,
  slippageBpsPerLeg: number,
): number {
  const feeBps = fees.spotTaker ?? 10;
  const feeFactor = 1 - feeBps / 10_000;

  // Início com 1 USDT
  // Leg1: USDT -> A (compra ao ASK com slippage de compra)
  const price1Eff = pair1.ask * (1 + slippageBpsPerLeg / 10_000);
  let qtyA = (1 / price1Eff) * feeFactor;

  // Leg2: A -> B
  let qtyB: number;
  if (pair2.direction === 'AtoB') {
    // AB existe: vender A por B ao BID com slippage de venda
    const bidEff = pair2.bid! * (1 - slippageBpsPerLeg / 10_000);
    qtyB = (qtyA * bidEff) * feeFactor;
  } else {
    // BA existe: comprar B com A ao ASK com slippage de compra
    const askEff = pair2.ask! * (1 + slippageBpsPerLeg / 10_000);
    qtyB = (qtyA / askEff) * feeFactor;
  }

  // Leg3: B -> USDT (venda ao BID com slippage de venda)
  const price3Eff = pair3.bid * (1 - slippageBpsPerLeg / 10_000);
  const usdtFinal = (qtyB * price3Eff) * feeFactor;

  return usdtFinal; // fator = USDT_final / USDT_inicial (USDT_inicial = 1)
}

export interface TriScanResult {
  best?: TriangularOpportunity;
  countChecked: number;
}

export async function scanTriangularUSDT(
  minQuoteVolumeUSDT: number,
  fees: FeesBpsConfig,
  slippageBpsPerLeg: number,
): Promise<TriScanResult> {
  // Dados necessários
  const [info, tickers, books] = await Promise.all([
    getSpotExchangeInfo(),
    getSpotTickers24h(),
    getSpotBookTickers(),
  ]);

  const trading = new Map<string, SpotSymbolInfo>();
  info.forEach((s) => {
    if (s.status === 'TRADING') trading.set(s.symbol, s);
  });

  const volBySymbol = new Map<string, Ticker24h>();
  tickers.forEach((t) => volBySymbol.set(t.symbol, t));

  const book = new Map<string, BookTicker>();
  books.forEach((b) => book.set(b.symbol, b));

  // Lista de ativos com par XUSDT e volume quote >= mínimo
  const usdtPairs = info
    .filter((s) => s.status === 'TRADING' && s.quoteAsset === 'USDT')
    .filter((s) => (volBySymbol.get(s.symbol)?.quoteVolume ?? 0) >= minQuoteVolumeUSDT);

  // Índices por ativo
  const byBase = new Map<string, SpotSymbolInfo>();
  usdtPairs.forEach((s) => byBase.set(s.baseAsset, s));

  let best: TriangularOpportunity | undefined;
  let checked = 0;

  const symbolsSet = new Set(info.map((s) => s.symbol));

  // Para cada par AUSDT e BUSDT, verificar se existe A/B ou B/A
  const bases = usdtPairs.map((s) => s.baseAsset);
  for (let i = 0; i < bases.length; i++) {
    for (let j = i + 1; j < bases.length; j++) {
      const A = bases[i];
      const B = bases[j];
      const AUSDT = byBase.get(A)!;
      const BUSDT = byBase.get(B)!;

      const AB = `${A}${B}`;
      const BA = `${B}${A}`;

      const hasAB = symbolsSet.has(AB) && trading.has(AB) && (volBySymbol.get(AB)?.quoteVolume ?? 0) >= minQuoteVolumeUSDT;
      const hasBA = symbolsSet.has(BA) && trading.has(BA) && (volBySymbol.get(BA)?.quoteVolume ?? 0) >= minQuoteVolumeUSDT;

      if (!hasAB && !hasBA) continue;

      const ausdtBook = book.get(AUSDT.symbol);
      const busdtBook = book.get(BUSDT.symbol);
      if (!ausdtBook || !busdtBook) continue;

      // Direção 1: USDT -> A -> B -> USDT
      if (hasAB) {
        const abBook = book.get(AB);
        if (abBook) {
          const factor = computeTriangleFactor(
            { ask: ausdtBook.askPrice },
            { bid: abBook.bidPrice, direction: 'AtoB' },
            { bid: busdtBook.bidPrice },
            fees,
            slippageBpsPerLeg,
          );
          const netBps = bpsFromFactor(factor);
          checked++;
          if (!best || netBps > best.netProfitBps) {
            best = {
              route: [AUSDT.symbol, AB, BUSDT.symbol],
              description: `USDT→${A}→${B}→USDT`,
              midDirection: 'AtoB',
              netProfitBps: netBps,
            };
          }
        }
      }

      // Direção 2: USDT -> B -> A -> USDT
      if (hasBA) {
        const baBook = book.get(BA);
        if (baBook) {
          const factor = computeTriangleFactor(
            { ask: busdtBook.askPrice },
            { ask: baBook.askPrice, direction: 'BtoA' },
            { bid: ausdtBook.bidPrice },
            fees,
            slippageBpsPerLeg,
          );
          const netBps = bpsFromFactor(factor);
          checked++;
          if (!best || netBps > best.netProfitBps) {
            best = {
              route: [BUSDT.symbol, BA, AUSDT.symbol],
              description: `USDT→${B}→${A}→USDT`,
              midDirection: 'BtoA',
              netProfitBps: netBps,
            };
          }
        }
      }
    }
  }

  if (best) {
    logger.debug('Melhor triangulo encontrado', best);
  }

  return { best, countChecked: checked };
}

// Execução da triangular com validação de filtros
import { spotMarketBuyByQuote, spotMarketSell, getSpotSymbolFilters, getSpotBalance } from '../api/exchange';

function quantize(qty: number, stepSize?: number, minQty?: number): number {
  let q = qty;
  if (typeof stepSize === 'number' && stepSize > 0) {
    const steps = Math.floor(q / stepSize);
    q = steps * stepSize;
  }
  if (typeof minQty === 'number' && minQty > 0 && q < minQty) {
    return 0;
  }
  return Number(q.toFixed(8));
}

export interface TriExecutionLeg {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantityOrQuote: number;
  executedQty?: number;
}

export interface TriExecutionResult {
  success: boolean;
  legs: TriExecutionLeg[];
  error?: string;
}

export async function executeTriangularUSDT(best: TriangularOpportunity, quoteUSDT: number): Promise<TriExecutionResult> {
  try {
    const [first, mid, last] = best.route; // e.g., [AUSDT, AB or BA, BUSDT]

    // Validar saldo USDT
    const balanceUSDT = await getSpotBalance();
    const spendUSDT = Math.min(balanceUSDT * 0.9, quoteUSDT);
    if (spendUSDT < 10) {
      return { success: false, legs: [], error: 'Saldo USDT insuficiente para executar (min ~10 USDT).' };
    }

    // Checar MIN_NOTIONAL do primeiro símbolo (AUSDT ou BUSDT)
    const f1 = await getSpotSymbolFilters(first);
    if (typeof f1.minNotional === 'number' && spendUSDT < f1.minNotional) {
      return { success: false, legs: [], error: `Notional abaixo do mínimo em ${first}: ${spendUSDT} < ${f1.minNotional}` };
    }

    const legs: TriExecutionLeg[] = [];

    // Leg 1: BUY first (quoteOrderQty = USDT)
    const leg1 = { symbol: first, side: 'BUY' as const, quantityOrQuote: spendUSDT };
    const r1 = await spotMarketBuyByQuote(first, spendUSDT);
    const executedQtyA = Number.parseFloat(r1.data?.executedQty ?? r1.data?.origQty ?? '0');
    legs.push({ ...leg1, executedQty: executedQtyA });
    if (!Number.isFinite(executedQtyA) || executedQtyA <= 0) {
      return { success: false, legs, error: 'Falha ao obter quantidade executada na primeira perna.' };
    }

    // Leg 2: converter A em B
    if (best.midDirection === 'AtoB') {
      // mid é AB: SELL quantidade de A
      const f2 = await getSpotSymbolFilters(mid);
      const qtyA = quantize(executedQtyA, f2.stepSize, f2.minQty);
      if (qtyA <= 0) return { success: false, legs, error: 'Quantidade após quantização ficou abaixo do mínimo para AB.' };
      const leg2 = { symbol: mid, side: 'SELL' as const, quantityOrQuote: qtyA };
      const r2 = await spotMarketSell(mid, qtyA);
      const executedQtyB = Number.parseFloat(r2.data?.cummulativeQuoteQty ?? '0'); // em B como quote? Para venda AB, recebemos B como QUOTE.
      legs.push({ ...leg2, executedQty: executedQtyB });
      if (!Number.isFinite(executedQtyB) || executedQtyB <= 0) {
        return { success: false, legs, error: 'Falha ao obter quantidade de B na segunda perna (AB).' };
      }

      // Leg 3: SELL BUSDT com quantidade de B
      const f3 = await getSpotSymbolFilters(last);
      const qtyB = quantize(executedQtyB, f3.stepSize, f3.minQty);
      if (qtyB <= 0) return { success: false, legs, error: 'Quantidade de B abaixo do mínimo para BUSDT.' };
      const leg3 = { symbol: last, side: 'SELL' as const, quantityOrQuote: qtyB };
      const r3 = await spotMarketSell(last, qtyB);
      const finalUSDT = Number.parseFloat(r3.data?.cummulativeQuoteQty ?? '0');
      legs.push({ ...leg3, executedQty: finalUSDT });
      return { success: finalUSDT > spendUSDT, legs };
    } else {
      // mid é BA: BUY quantidade de B usando A como quote
      const f2 = await getSpotSymbolFilters(mid);
      // Para BUY com quoteOrderQty, respeitar MIN_NOTIONAL (A como quote)
      const quoteA = executedQtyA;
      if (typeof f2.minNotional === 'number' && quoteA < f2.minNotional) {
        return { success: false, legs, error: 'Notional de A abaixo do mínimo para BA.' };
      }
      const leg2 = { symbol: mid, side: 'BUY' as const, quantityOrQuote: quoteA };
      const r2 = await spotMarketBuyByQuote(mid, quoteA);
      const executedQtyB = Number.parseFloat(r2.data?.executedQty ?? r2.data?.origQty ?? '0');
      legs.push({ ...leg2, executedQty: executedQtyB });
      if (!Number.isFinite(executedQtyB) || executedQtyB <= 0) {
        return { success: false, legs, error: 'Falha ao obter quantidade de B na segunda perna (BA).' };
      }

      // Leg 3: SELL BUSDT com quantidade de B
      const f3 = await getSpotSymbolFilters(last);
      const qtyB = quantize(executedQtyB, f3.stepSize, f3.minQty);
      if (qtyB <= 0) return { success: false, legs, error: 'Quantidade de B abaixo do mínimo para BUSDT.' };
      const leg3 = { symbol: last, side: 'SELL' as const, quantityOrQuote: qtyB };
      const r3 = await spotMarketSell(last, qtyB);
      const finalUSDT = Number.parseFloat(r3.data?.cummulativeQuoteQty ?? '0');
      legs.push({ ...leg3, executedQty: finalUSDT });
      return { success: finalUSDT > spendUSDT, legs };
    }
  } catch (error) {
    logger.error('Falha na execução triangular', { error });
    return { success: false, legs: [], error: String(error) };
  }
}