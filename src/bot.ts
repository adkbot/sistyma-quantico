// src/bot.ts

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { botState } from './state/botState';
import {
  executeArbitrageOrder,
  fetchBorrowAprPct,
  fetchFundingRateBpsPer8h,
  getFuturesTotalUSDT,
  getSpotPortfolioValueUSDT,
  getMarketPrices,
  getSpotExchangeInfo,
  getSpotTickers24h,
  getFuturesExchangeInfo
} from './api/exchange';
import { computeNetEdgeBps, decideSide } from './engine/arbDecision';
import type { ComputeNetEdgeResult } from './engine/arbDecision';
import { logger } from './logger';
import type { FeesBpsConfig, Side, TradeParams } from '@/shared/types';
import { scanTriangularUSDT, executeTriangularUSDT } from './engine/triangularArb';

export interface BotConfig {
  tradingPair: string;
  minProfitPercentage: number;
  exchangeFeePercentage: number;
  checkIntervalSeconds: number;
  placeOrders: boolean;
  allowReverse: boolean;
  spotMarginEnabled: boolean;
  feesBps: FeesBpsConfig;
  slippageBpsPerLeg: number;
  minSpreadBpsLongCarry: number;
  minSpreadBpsReverse: number;
  considerFunding: boolean;
  fundingHorizonHours: number;
  maxBorrowAprPct: number;
  // Escaneamento adicional
  enableTriangular: boolean;
  triMinQuoteVolumeUSDT: number;
  triMinProfitBps: number; // 5 bps = 0.05%
  spotFuturesMinProfitBps: number; // limiar mínimo para execução
  // Multi-par para Spot-Futuros
  multiPairScanEnabled: boolean;
  spotFuturesMinQuoteVolumeUSDT: number;
  spotFuturesMaxSymbols: number;
  // Orçamento da triangular
  triBudgetUseDynamic: boolean; // quando true, usa ~90% do saldo USDT
  triBudgetFixedUSDT: number; // quando triBudgetUseDynamic=false, orçamento fixo
}

export interface StartBotOptions {
  symbol?: string;
  pollIntervalMs?: number;
  minProfitPercentage?: number;
  feePercentage?: number;
  placeOrders?: boolean;
}

const CONFIG_PATH = new URL('../config.json', import.meta.url);

const DEFAULT_CONFIG: BotConfig = {
  tradingPair: 'BTCUSDT',
  // Meta alvo de lucro por operação (apenas informativo hoje)
  minProfitPercentage: 0.06,
  exchangeFeePercentage: 0.001,
  checkIntervalSeconds: 5,
  placeOrders: false,
  allowReverse: true,
  spotMarginEnabled: false,
  feesBps: { spotTaker: 10, futuresTaker: 4 },
  slippageBpsPerLeg: 5,
  // Limiar mínimo para execução (0.05% = 5 bps)
  minSpreadBpsLongCarry: 5,
  minSpreadBpsReverse: 5,
  considerFunding: true,
  fundingHorizonHours: 8,
  maxBorrowAprPct: 25,
  enableTriangular: true,
  triMinQuoteVolumeUSDT: 100_000,
  triMinProfitBps: 5,
  spotFuturesMinProfitBps: 5,
  multiPairScanEnabled: true,
  spotFuturesMinQuoteVolumeUSDT: 100_000,
  spotFuturesMaxSymbols: 20,
  triBudgetUseDynamic: true,
  triBudgetFixedUSDT: 0
};

function cloneFees(config: FeesBpsConfig | undefined): FeesBpsConfig {
  return {
    spotTaker: config?.spotTaker ?? DEFAULT_CONFIG.feesBps.spotTaker,
    futuresTaker: config?.futuresTaker ?? DEFAULT_CONFIG.feesBps.futuresTaker
  };
}

export function loadConfig(): BotConfig {
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<BotConfig>;

    return {
      tradingPair: parsed.tradingPair ?? DEFAULT_CONFIG.tradingPair,
      minProfitPercentage: parsed.minProfitPercentage ?? DEFAULT_CONFIG.minProfitPercentage,
      exchangeFeePercentage: parsed.exchangeFeePercentage ?? DEFAULT_CONFIG.exchangeFeePercentage,
      checkIntervalSeconds: parsed.checkIntervalSeconds ?? DEFAULT_CONFIG.checkIntervalSeconds,
      placeOrders: parsed.placeOrders ?? DEFAULT_CONFIG.placeOrders,
      allowReverse: parsed.allowReverse ?? DEFAULT_CONFIG.allowReverse,
      spotMarginEnabled: parsed.spotMarginEnabled ?? DEFAULT_CONFIG.spotMarginEnabled,
      feesBps: cloneFees(parsed.feesBps),
      slippageBpsPerLeg: parsed.slippageBpsPerLeg ?? DEFAULT_CONFIG.slippageBpsPerLeg,
      minSpreadBpsLongCarry: parsed.minSpreadBpsLongCarry ?? DEFAULT_CONFIG.minSpreadBpsLongCarry,
      minSpreadBpsReverse: parsed.minSpreadBpsReverse ?? DEFAULT_CONFIG.minSpreadBpsReverse,
      considerFunding: parsed.considerFunding ?? DEFAULT_CONFIG.considerFunding,
      fundingHorizonHours: parsed.fundingHorizonHours ?? DEFAULT_CONFIG.fundingHorizonHours,
      maxBorrowAprPct: parsed.maxBorrowAprPct ?? DEFAULT_CONFIG.maxBorrowAprPct,
      enableTriangular: parsed.enableTriangular ?? DEFAULT_CONFIG.enableTriangular,
      triMinQuoteVolumeUSDT: parsed.triMinQuoteVolumeUSDT ?? DEFAULT_CONFIG.triMinQuoteVolumeUSDT,
      triMinProfitBps: parsed.triMinProfitBps ?? DEFAULT_CONFIG.triMinProfitBps,
      spotFuturesMinProfitBps: parsed.spotFuturesMinProfitBps ?? DEFAULT_CONFIG.spotFuturesMinProfitBps,
      multiPairScanEnabled: parsed.multiPairScanEnabled ?? DEFAULT_CONFIG.multiPairScanEnabled,
      spotFuturesMinQuoteVolumeUSDT: parsed.spotFuturesMinQuoteVolumeUSDT ?? DEFAULT_CONFIG.spotFuturesMinQuoteVolumeUSDT,
      spotFuturesMaxSymbols: parsed.spotFuturesMaxSymbols ?? DEFAULT_CONFIG.spotFuturesMaxSymbols,
      triBudgetUseDynamic: parsed.triBudgetUseDynamic ?? DEFAULT_CONFIG.triBudgetUseDynamic,
      triBudgetFixedUSDT: parsed.triBudgetFixedUSDT ?? DEFAULT_CONFIG.triBudgetFixedUSDT
    };
  } catch (error) {
    logger.error('Falha ao carregar config.json. Usando padroes de contingencia.', { error });
    return { ...DEFAULT_CONFIG, feesBps: { ...DEFAULT_CONFIG.feesBps } };
  }
}

export function writeConfig(config: BotConfig): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

function mergeOptions(base: BotConfig, options: StartBotOptions = {}): BotConfig {
  const pollIntervalSeconds = options.pollIntervalMs
    ? Math.max(1, Math.round(options.pollIntervalMs / 1000))
    : base.checkIntervalSeconds;

  return {
    ...base,
    tradingPair: options.symbol ?? base.tradingPair,
    minProfitPercentage: options.minProfitPercentage ?? base.minProfitPercentage,
    exchangeFeePercentage: options.feePercentage ?? base.exchangeFeePercentage,
    checkIntervalSeconds: pollIntervalSeconds,
    placeOrders: options.placeOrders ?? base.placeOrders
  };
}

function waitWithAbort(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolveWait) => {
    if (signal.aborted) {
      resolveWait();
      return;
    }

    const timeout = setTimeout(resolveWait, ms);

    const abortHandler = () => {
      clearTimeout(timeout);
      resolveWait();
    };

    signal.addEventListener('abort', abortHandler, { once: true });
  });
}

function inferBaseAsset(symbol: string): string {
  const upper = symbol.toUpperCase();
  const knownQuotes = ['USDT', 'BUSD', 'USDC', 'BTC', 'ETH', 'EUR', 'BRL', 'TRY', 'BNB'];

  for (const quote of knownQuotes) {
    if (upper.endsWith(quote)) {
      return upper.slice(0, upper.length - quote.length);
    }
  }

  return upper.slice(0, Math.max(upper.length - 4, 1));
}

function determineNoTradeReason(
  prices: { spot: number; futuros: number },
  config: BotConfig,
  metrics: ComputeNetEdgeResult,
  borrowAprPct: number
): string {
  if (prices.futuros === prices.spot) {
    return 'basis_flat';
  }

  if (prices.futuros > prices.spot) {
    if (metrics.netLongCarry < config.minSpreadBpsLongCarry) {
      return 'long_edge_below_threshold';
    }
    return 'basis_condition_not_met';
  }

  if (!config.allowReverse) {
    return 'reverse_disabled';
  }

  if (!config.spotMarginEnabled) {
    return 'reverse_blocked_no_margin';
  }

  if (borrowAprPct > config.maxBorrowAprPct) {
    return 'reverse_borrow_apr_exceeds';
  }

  if (metrics.netReverseCarry < config.minSpreadBpsReverse) {
    return 'reverse_edge_below_threshold';
  }

  return 'basis_condition_not_met';
}

async function botLoop(config: BotConfig, signal: AbortSignal): Promise<void> {
  const pollIntervalMs = config.checkIntervalSeconds * 1000;
  const symbol = config.tradingPair;

  botState.initialize(symbol, pollIntervalMs);
  botState.setRunning(true);

  while (!signal.aborted) {
    try {
      const capital = await getFuturesTotalUSDT();

      if (signal.aborted) {
        break;
      }

      if (capital <= 0) {
        logger.warn('Sem capital disponivel na carteira de futuros. Aguardando...');
        const spotOnly = await getSpotPortfolioValueUSDT();
        botState.updateBalances(spotOnly, 0, 0);
        botState.setLastCycle();
        await waitWithAbort(pollIntervalMs, signal);
        continue;
      }

      const prices = await getMarketPrices(symbol);

      if (signal.aborted) {
        break;
      }

      if (prices.spot <= 0 || prices.futuros <= 0) {
        logger.warn('Preco invalido recebido. Ignorando ciclo.', prices);
        const spotNow = await getSpotPortfolioValueUSDT();
        botState.updateBalances(spotNow, capital, 0);
        botState.setLastCycle();
        await waitWithAbort(pollIntervalMs, signal);
        continue;
      }

      {
        const spotNow = await getSpotPortfolioValueUSDT();
        botState.updateBalances(spotNow, capital, prices.spot);
      }

      const amount = capital / prices.spot;

      if (!Number.isFinite(amount) || amount <= 0) {
        logger.warn('Quantidade calculada invalida. Aguardando proximo ciclo.', { amount, capital, prices });
        botState.setLastCycle();
        await waitWithAbort(pollIntervalMs, signal);
        continue;
      }

      const spread = prices.futuros - prices.spot;
      const baseAsset = inferBaseAsset(symbol);

      const [fundingRateBpsPer8h, borrowAprPctRaw] = await Promise.all([
        fetchFundingRateBpsPer8h(symbol),
        config.spotMarginEnabled ? fetchBorrowAprPct(baseAsset) : Promise.resolve(0)
      ]);

      const borrowAprPct = Math.max(0, borrowAprPctRaw);
      const metrics = computeNetEdgeBps({
        spot: prices.spot,
        futures: prices.futuros,
        feesBps: config.feesBps,
        slippageBpsPerLeg: config.slippageBpsPerLeg,
        considerFunding: config.considerFunding,
        fundingRateBpsPer8h,
        fundingHorizonHours: config.fundingHorizonHours,
        borrowAprPct
      });

      const side = decideSide({
        spot: prices.spot,
        futures: prices.futuros,
        cfg: {
          feesBps: config.feesBps,
          slippageBpsPerLeg: config.slippageBpsPerLeg,
          considerFunding: config.considerFunding,
          fundingHorizonHours: config.fundingHorizonHours,
          minSpreadBpsLongCarry: config.minSpreadBpsLongCarry,
          minSpreadBpsReverse: config.minSpreadBpsReverse,
          allowReverse: config.allowReverse,
          spotMarginEnabled: config.spotMarginEnabled,
          maxBorrowAprPct: config.maxBorrowAprPct
        },
        fundingRateBpsPer8h,
        borrowAprPct
      });

      const feesTotalBps = (config.feesBps.spotTaker ?? 0) + (config.feesBps.futuresTaker ?? 0);
      const slippageTotalBps = config.slippageBpsPerLeg * 2;

      const payload: Record<string, unknown> = {
        ts: new Date().toISOString(),
        symbol,
        spot: prices.spot,
        fut: prices.futuros,
        basis_bps: metrics.basisBps,
        fees_bps: feesTotalBps,
        slippage_bps: slippageTotalBps,
        funding_bps: metrics.fundingBps,
        borrow_bps: metrics.borrowBps,
        net_longcarry_bps: metrics.netLongCarry,
        net_reverse_bps: metrics.netReverseCarry,
        min_long_bps: config.minSpreadBpsLongCarry,
        min_reverse_bps: config.minSpreadBpsReverse,
        allow_reverse: config.allowReverse,
        spot_margin_enabled: config.spotMarginEnabled,
        chosen: side,
        dry_run: !config.placeOrders,
        notional_usdt: Number(capital.toFixed(2))
      };

      if (side === 'NONE') {
        payload.reason_if_none = determineNoTradeReason(prices, config, metrics, borrowAprPct);
        console.log(JSON.stringify(payload));
        botState.setLastCycle();
        await waitWithAbort(pollIntervalMs, signal);
        continue;
      }

      // Oportunidade encontrada no par principal
      {
        const netEdgeBps = side === 'LONG_SPOT_SHORT_PERP' ? metrics.netLongCarry : metrics.netReverseCarry;
        botState.setMessage(`Oportunidade spot-futuros detectada • ${symbol} • lado=${side} • net_bps=${netEdgeBps.toFixed(2)}`);
      }

      const tradeParams: TradeParams = side === 'LONG_SPOT_SHORT_PERP'
        ? {
            buyPrice: prices.spot,
            sellPrice: prices.futuros,
            amount,
            feePercentage: config.exchangeFeePercentage,
            spread,
            side
          }
        : {
            buyPrice: prices.futuros,
            sellPrice: prices.spot,
            amount,
            feePercentage: config.exchangeFeePercentage,
            spread,
            side
          };

      payload.action = config.placeOrders ? 'LIVE_ENTER' : 'DRY_RUN_ENTER';
      console.log(JSON.stringify(payload));

      if (!config.placeOrders) {
        botState.setLastCycle();
        await waitWithAbort(pollIntervalMs, signal);
        continue;
      }

      logger.info('Executando arbitragem spot-futuros (par principal).', { side, symbol, amount: tradeParams.amount });
      const tradeStart = performance.now();
      const result = await executeArbitrageOrder(tradeParams, symbol);
      const latencyMs = performance.now() - tradeStart;

      if (result.success) {
        logger.info(`Operacao concluida com lucro estimado de ${result.profit}.`, {
          executedAt: result.executedAt.toISOString(),
          details: result.details
        });

        botState.recordTrade({
          trade: tradeParams,
          pair: symbol,
          resultProfit: result.profit,
          latencyMs,
          feesUsd: tradeParams.amount * tradeParams.sellPrice * tradeParams.feePercentage,
          slippage: Math.abs(tradeParams.spread) * 0.0001
        });

        const [updatedFut, updatedSpot] = await Promise.all([getFuturesTotalUSDT(), getSpotPortfolioValueUSDT()]);
        botState.updateBalances(updatedSpot, updatedFut, prices.spot);
        logger.info('Saldo atualizado apos execucao.', { updatedBalance });
      } else {
        logger.warn('Execucao retornou sem sucesso. Verifique o retorno da corretora.', result.details);
      }

      botState.setLastCycle();
    } catch (error) {
      logger.error('Erro durante o ciclo principal do bot.', { error });
      botState.recordError(error);
      botState.setLastCycle();
    }

    if (signal.aborted) {
      break;
    }

    // Escaneamento Spot-Futuros multi-par com volume alto
    if (config.multiPairScanEnabled) {
      try {
        const [spotInfo, tickers, futInfo] = await Promise.all([
          getSpotExchangeInfo(),
          getSpotTickers24h(),
          getFuturesExchangeInfo(),
        ]);

        const futSet = new Set(
          futInfo.filter((f) => f.status === 'TRADING').map((f) => f.symbol)
        );
        const volMap = new Map<string, number>(
          tickers.map((t) => [t.symbol, t.quoteVolume])
        );

        const candidates = spotInfo
          .filter((s) => s.status === 'TRADING' && s.quoteAsset === 'USDT')
          .filter((s) => (volMap.get(s.symbol) ?? 0) >= config.spotFuturesMinQuoteVolumeUSDT)
          .filter((s) => futSet.has(s.symbol))
          .sort((a, b) => (volMap.get(b.symbol)! - volMap.get(a.symbol)!))
          .slice(0, Math.max(1, config.spotFuturesMaxSymbols));

        let executed = false;
        for (const s of candidates) {
          if (signal.aborted) break;

          const p = await getMarketPrices(s.symbol);
          if (p.spot <= 0 || p.futuros <= 0) continue;

          const m = computeNetEdgeBps({
            spot: p.spot,
            futures: p.futuros,
            feesBps: config.feesBps,
            slippageBpsPerLeg: config.slippageBpsPerLeg,
            considerFunding: config.considerFunding,
            fundingRateBpsPer8h: await fetchFundingRateBpsPer8h(s.symbol),
            fundingHorizonHours: config.fundingHorizonHours,
            borrowAprPct: 0,
          });

          const sDec = decideSide({
            spot: p.spot,
            futures: p.futuros,
            cfg: {
              feesBps: config.feesBps,
              slippageBpsPerLeg: config.slippageBpsPerLeg,
              considerFunding: config.considerFunding,
              fundingHorizonHours: config.fundingHorizonHours,
              minSpreadBpsLongCarry: config.minSpreadBpsLongCarry,
              minSpreadBpsReverse: config.minSpreadBpsReverse,
              allowReverse: config.allowReverse,
              spotMarginEnabled: config.spotMarginEnabled,
              maxBorrowAprPct: config.maxBorrowAprPct,
            },
            fundingRateBpsPer8h: await fetchFundingRateBpsPer8h(s.symbol),
            borrowAprPct: 0,
          });

          if (sDec === 'NONE') continue;

          const netEdge = sDec === 'LONG_SPOT_SHORT_PERP' ? m.netLongCarry : m.netReverseCarry;
          if (netEdge < config.spotFuturesMinProfitBps) continue;

          // Oportunidade encontrada no escaneamento multi-par
          botState.setMessage(`Oportunidade spot-futuros detectada • ${s.symbol} • lado=${sDec} • net_bps=${netEdge.toFixed(2)}`);

          const qty = capital / p.spot;
          if (!Number.isFinite(qty) || qty <= 0) continue;

          const trade: TradeParams = sDec === 'LONG_SPOT_SHORT_PERP'
            ? {
                buyPrice: p.spot,
                sellPrice: p.futuros,
                amount: qty,
                feePercentage: config.exchangeFeePercentage,
                spread: p.futuros - p.spot,
                side: sDec,
              }
            : {
                buyPrice: p.futuros,
                sellPrice: p.spot,
                amount: qty,
                feePercentage: config.exchangeFeePercentage,
                spread: p.futuros - p.spot,
                side: sDec,
              };

          console.log(JSON.stringify({
            ts: new Date().toISOString(),
            pair: s.symbol,
            type: 'spot-futuros',
            dry_run: !config.placeOrders,
            net_bps: netEdge,
          }));

          if (!config.placeOrders) continue;

          logger.info('Executando arbitragem spot-futuros.', { side: sDec, symbol: s.symbol, amount: trade.amount });
          const tStart = performance.now();
          const res = await executeArbitrageOrder(trade, s.symbol);
          const tLatency = performance.now() - tStart;

          if (res.success) {
            logger.info('Arbitragem spot-futuros concluída com sucesso.', { symbol: s.symbol, details: res.details });
            botState.recordTrade({
              trade,
              pair: s.symbol,
              resultProfit: res.profit,
              latencyMs: tLatency,
              feesUsd: trade.amount * trade.sellPrice * trade.feePercentage,
              slippage: Math.abs(trade.spread) * 0.0001,
            });
            const [updatedFut, updatedSpot] = await Promise.all([getFuturesTotalUSDT(), getSpotPortfolioValueUSDT()]);
            botState.updateBalances(updatedSpot, updatedFut, p.spot);
            executed = true;
            break;
          } else {
            logger.warn('Execução spot-futuros retornou sem sucesso.', res.details);
          }
        }
      } catch (error) {
        logger.warn('Falha no escaneamento spot-futuros multi-par.', { error });
      }
    }

    // Escaneamento e Execução Triangular Spot (USDT)
    if (config.enableTriangular) {
      try {
        const tri = await scanTriangularUSDT(
          config.triMinQuoteVolumeUSDT,
          config.feesBps,
          config.slippageBpsPerLeg
        );
        if (tri.best && tri.best.netProfitBps >= config.triMinProfitBps) {
          logger.info('Oportunidade triangular detectada', tri.best);
          botState.setMessage(`Oportunidade triangular detectada • rota=${tri.best.route.join(' → ')} • net_bps=${tri.best.netProfitBps.toFixed(2)}`);
          if (config.placeOrders) {
            // Orçamento: dinâmico (~90% do saldo USDT) ou fixo conforme configuração
            const quoteUSDT = config.triBudgetUseDynamic
              ? Number.MAX_SAFE_INTEGER
              : Math.max(10, Math.min(2_000, config.triBudgetFixedUSDT || config.triMinQuoteVolumeUSDT));
            const exec = await executeTriangularUSDT(tri.best, quoteUSDT);
            if (exec.success) {
              logger.info('Triangular executada com sucesso', { legs: exec.legs });
            } else {
              logger.warn('Falha/Abort na execução triangular', { error: exec.error, legs: exec.legs });
            }
          }
        }
      } catch (error) {
        logger.warn('Falha no escaneamento triangular', { error });
      }
    }

    await waitWithAbort(pollIntervalMs, signal);
  }

  botState.setRunning(false);
}

class BotRunner {
  private controller: AbortController | null = null;
  private runPromise: Promise<void> | null = null;
  private currentConfig: BotConfig = loadConfig();

  getConfig(): BotConfig {
    return this.currentConfig;
  }

  async reloadConfig(): Promise<BotConfig> {
    this.currentConfig = loadConfig();
    botState.initialize(this.currentConfig.tradingPair, this.currentConfig.checkIntervalSeconds * 1000);
    return this.currentConfig;
  }

  isRunning(): boolean {
    return this.controller !== null && this.controller.signal.aborted === false;
  }

  async start(options: StartBotOptions = {}): Promise<void> {
    if (this.isRunning()) {
      logger.warn('Solicitacao de start ignorada: bot ja esta em execucao.');
      return this.runPromise ?? Promise.resolve();
    }

    const baseConfig = loadConfig();
    this.currentConfig = mergeOptions(baseConfig, options);
    botState.initialize(this.currentConfig.tradingPair, this.currentConfig.checkIntervalSeconds * 1000);

    this.controller = new AbortController();

    this.runPromise = botLoop(this.currentConfig, this.controller.signal)
      .catch((error) => {
        logger.error('Loop principal do bot terminou com erro.', { error });
        botState.recordError(error);
        throw error;
      })
      .finally(() => {
        this.controller = null;
        this.runPromise = null;
        botState.setRunning(false);
      });

    return this.runPromise;
  }

  async stop(): Promise<void> {
    if (!this.controller) {
      logger.info('Solicitacao de stop ignorada: bot ja esta parado.');
      return;
    }

    this.controller.abort();

    try {
      await this.runPromise;
    } finally {
      this.controller = null;
      this.runPromise = null;
      botState.setRunning(false);
      logger.info('Bot interrompido sob demanda.');
    }
  }
}

export const botRunner = new BotRunner();

export async function startBot(options: StartBotOptions = {}): Promise<void> {
  await botRunner.start(options);
}

export async function stopBot(): Promise<void> {
  await botRunner.stop();
}

const executedDirectly = process.argv[1]
  ? resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (executedDirectly) {
  botRunner
    .start()
    .catch((error) => {
      logger.error('Erro fatal ao iniciar o bot.', { error });
      process.exit(1);
    });
}