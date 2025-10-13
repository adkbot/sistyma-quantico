// src/api/exchange.ts

import 'dotenv/config';
import axios, { type AxiosInstance } from 'axios';
import Bottleneck from 'bottleneck';
import { createHmac } from 'node:crypto';
import { getUserKeys } from '../lib/keyStore.js';
import { logger } from '../logger';
import { calculateProfit } from '../logic/calculation';
import type { TradeParams } from '@/shared/types';

export interface MarketPrices {
  spot: number;
  futuros: number;
}

export interface OrderExecutionResult {
  success: boolean;
  profit: number;
  executedAt: Date;
  details?: Record<string, unknown>;
}

interface PanicSellResult {
  attempted: boolean;
  success: boolean;
  error?: string;
  response?: unknown;
}

const MAX_REQUESTS_PER_MINUTE = 1200;
const SAFETY_FACTOR = 0.9;
const REQUESTS_PER_MINUTE = Math.floor(MAX_REQUESTS_PER_MINUTE * SAFETY_FACTOR);
const MIN_TIME_BETWEEN_CALLS_MS = Math.ceil(60000 / REQUESTS_PER_MINUTE);
const DEFAULT_RECV_WINDOW = Number.parseInt(process.env.RECV_WINDOW ?? '5000', 10);
const QUANTITY_PRECISION = Number.parseInt(process.env.QUANTITY_PRECISION ?? '6', 10);
const BALANCE_ASSET = process.env.BALANCE_ASSET ?? 'USDT';
const API_TIMEOUT_MS = Number.parseInt(process.env.API_TIMEOUT_MS ?? '10000', 10);
const DEFAULT_SPOT_API_BASE = process.env.SPOT_API_BASE ?? 'https://api.binance.com';
const DEFAULT_FUTURES_API_BASE = process.env.FUTURES_API_BASE ?? 'https://fapi.binance.com';
const TESTNET_SPOT_API_BASE = 'https://testnet.binance.vision';
const TESTNET_FUTURES_API_BASE = 'https://testnet.binancefuture.com';
const SIMULATED_BALANCE = Number.parseFloat(process.env.SIMULATED_BALANCE ?? '20');

const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: MIN_TIME_BETWEEN_CALLS_MS
});

const schedule = <T>(fn: () => Promise<T>): Promise<T> => limiter.schedule(fn);

type HttpMethod = 'GET' | 'POST' | 'DELETE';
type RawParams = Record<string, string | number | boolean | undefined>;
type BinanceMode = 'spot' | 'futures';

interface BinanceContext {
  simulation: boolean;
  apiKey?: string;
  apiSecret?: string;
  testnet: boolean;
  mode: BinanceMode;
  spotClient: AxiosInstance;
  futuresClient: AxiosInstance;
}

let cachedContext: BinanceContext | null = null;
let cachedSignature: string | null = null;
let warnedSimulation = false;

function createHttpClient(baseURL: string, apiKey?: string): AxiosInstance {
  const instance = axios.create({
    baseURL,
    timeout: API_TIMEOUT_MS
  });

  if (apiKey) {
    instance.defaults.headers.common['X-MBX-APIKEY'] = apiKey;
  }

  return instance;
}

function makeSignature(keys: { apiKey: string; apiSecret: string; testnet: boolean; mode: BinanceMode }): string {
  return `${keys.apiKey}:${keys.apiSecret}:${keys.mode}:${keys.testnet ? '1' : '0'}`;
}

function getBinanceContext(): BinanceContext {
  const keys = getUserKeys('default');

  if (!keys) {
    if (!warnedSimulation) {
      logger.warn('Modo simulado ativo: nenhuma credencial persistida no cofre.');
      warnedSimulation = true;
    }

    const simulationContext: BinanceContext = {
      simulation: true,
      testnet: false,
      mode: 'futures',
      spotClient: createHttpClient(DEFAULT_SPOT_API_BASE),
      futuresClient: createHttpClient(DEFAULT_FUTURES_API_BASE)
    };

    cachedContext = simulationContext;
    cachedSignature = 'simulation';
    return simulationContext;
  }

  const normalizedMode: BinanceMode = keys.mode === 'spot' ? 'spot' : 'futures';
  const signature = makeSignature({
    apiKey: keys.apiKey,
    apiSecret: keys.apiSecret,
    mode: normalizedMode,
    testnet: Boolean(keys.testnet)
  });

  if (cachedContext && cachedSignature === signature) {
    return cachedContext;
  }

  const spotBase = keys.testnet ? TESTNET_SPOT_API_BASE : DEFAULT_SPOT_API_BASE;
  const futuresBase = keys.testnet ? TESTNET_FUTURES_API_BASE : DEFAULT_FUTURES_API_BASE;

  cachedContext = {
    simulation: false,
    apiKey: keys.apiKey,
    apiSecret: keys.apiSecret,
    testnet: Boolean(keys.testnet),
    mode: normalizedMode,
    spotClient: createHttpClient(spotBase, keys.apiKey),
    futuresClient: createHttpClient(futuresBase, keys.apiKey)
  };

  cachedSignature = signature;
  warnedSimulation = false;
  return cachedContext;
}

function trimZeros(value: string): string {
  return value.replace(/(\.\d*?[1-9])0+$/u, '').replace(/\.0+$/u, '');
}

function formatQuantity(amount: number): string {
  const decimals = Number.isFinite(QUANTITY_PRECISION) ? QUANTITY_PRECISION : 6;
  return trimZeros(amount.toFixed(decimals));
}

function formatError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return { message: String(error) };
}

function buildSignedQuery(secret: string, params: RawParams = {}): URLSearchParams {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }

    query.append(key, String(value));
  });

  if (!query.has('recvWindow') && Number.isFinite(DEFAULT_RECV_WINDOW)) {
    query.append('recvWindow', String(DEFAULT_RECV_WINDOW));
  }

  query.append('timestamp', Date.now().toString());

  const signature = createHmac('sha256', secret)
    .update(query.toString())
    .digest('hex');

  query.append('signature', signature);

  return query;
}

async function signedRequest(
  context: BinanceContext,
  client: AxiosInstance,
  method: HttpMethod,
  path: string,
  params: RawParams = {}
) {
  if (context.simulation || !context.apiSecret) {
    throw new Error('Tentativa de chamada assinada sem credenciais configuradas.');
  }

  const query = buildSignedQuery(context.apiSecret, params);
  const headers = {
    'X-MBX-APIKEY': context.apiKey ?? '',
    'Content-Type': 'application/x-www-form-urlencoded'
  };

  if (method === 'GET' || method === 'DELETE') {
    const url = `${path}?${query.toString()}`;
    return schedule(() => client.request({ method, url, headers }));
  }

  if (method === 'POST') {
    return schedule(() => client.post(path, query.toString(), { headers }));
  }

  throw new Error(`Metodo HTTP nao suportado: ${method}`);
}

export async function getFuturesBalance(): Promise<number> {
  const context = getBinanceContext();

  if (context.simulation) {
    return SIMULATED_BALANCE;
  }

  const response = await signedRequest(context, context.futuresClient, 'GET', '/fapi/v2/balance');
  const balances = response.data as Array<{
    accountAlias: string;
    asset: string;
    balance: string;
    availableBalance: string;
  }>;

  if (!Array.isArray(balances)) {
    throw new Error('Resposta inesperada ao consultar saldo de futuros.');
  }

  const assetEntry =
    balances.find((entry) => entry.asset === BALANCE_ASSET) ?? balances[0];

  return Number.parseFloat(assetEntry?.availableBalance ?? '0');
}

export async function getMarketPrices(symbol: string): Promise<MarketPrices> {
  const context = getBinanceContext();
  const { spotClient, futuresClient } = context;

  const [spotResponse, futuresResponse] = await Promise.all([
    schedule(() =>
      spotClient.get('/api/v3/ticker/price', {
        params: { symbol }
      })
    ),
    schedule(() =>
      futuresClient.get('/fapi/v1/ticker/price', {
        params: { symbol }
      })
    )
  ]);

  const spotPrice = Number.parseFloat(spotResponse.data?.price);
  const futuresPrice = Number.parseFloat(futuresResponse.data?.price);

  return {
    spot: Number.isFinite(spotPrice) ? spotPrice : 0,
    futuros: Number.isFinite(futuresPrice) ? futuresPrice : 0
  };
}

// --- Mercado Spot: utilitários para escaneamento ---
export interface SpotSymbolInfo {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
}

export interface Ticker24h {
  symbol: string;
  priceChangePercent: number;
  volume: number; // base volume 24h
  quoteVolume: number; // quote volume 24h
}

export interface BookTicker {
  symbol: string;
  bidPrice: number;
  askPrice: number;
}

/**
 * Obtém a lista de símbolos spot com seus ativos base/quote.
 */
export async function getSpotExchangeInfo(): Promise<SpotSymbolInfo[]> {
  const context = getBinanceContext();
  const { spotClient } = context;

  const resp = await schedule(() => spotClient.get('/api/v3/exchangeInfo'));
  const data = resp.data as { symbols?: Array<{ symbol: string; status: string; baseAsset: string; quoteAsset: string }> };
  const symbols = (data.symbols ?? []).map((s) => ({
    symbol: s.symbol,
    status: s.status,
    baseAsset: s.baseAsset,
    quoteAsset: s.quoteAsset,
  }));
  return symbols;
}

/**
 * Obtém estatísticas 24h de todos os símbolos spot.
 */
export async function getSpotTickers24h(): Promise<Ticker24h[]> {
  const context = getBinanceContext();
  const { spotClient } = context;

  const resp = await schedule(() => spotClient.get('/api/v3/ticker/24hr'));
  const arr = resp.data as Array<{
    symbol: string;
    priceChangePercent: string;
    volume: string;
    quoteVolume: string;
  }>;
  return arr.map((t) => ({
    symbol: t.symbol,
    priceChangePercent: Number.parseFloat(t.priceChangePercent),
    volume: Number.parseFloat(t.volume),
    quoteVolume: Number.parseFloat(t.quoteVolume),
  }));
}

/**
 * Obtém bookTicker (melhor bid/ask) para todos os símbolos spot.
 */
export async function getSpotBookTickers(): Promise<BookTicker[]> {
  const context = getBinanceContext();
  const { spotClient } = context;
  const resp = await schedule(() => spotClient.get('/api/v3/ticker/bookTicker'));
  const arr = resp.data as Array<{ symbol: string; bidPrice: string; askPrice: string }>;
  return arr.map((t) => ({ symbol: t.symbol, bidPrice: Number.parseFloat(t.bidPrice), askPrice: Number.parseFloat(t.askPrice) }));
}

// --- Mercado Futuros: utilitário para listar símbolos disponíveis ---
export interface FuturesSymbolInfo {
  symbol: string;
  status: string;
  contractType?: string;
}

/**
 * Obtém a lista de símbolos de Futuros (USDT-M) e seus status.
 */
export async function getFuturesExchangeInfo(): Promise<FuturesSymbolInfo[]> {
  const context = getBinanceContext();
  const { futuresClient } = context;

  const resp = await schedule(() => futuresClient.get('/fapi/v1/exchangeInfo'));
  const data = resp.data as { symbols?: Array<{ symbol: string; status: string; contractType?: string }> };
  const symbols = (data.symbols ?? []).map((s) => ({
    symbol: s.symbol,
    status: s.status,
    contractType: s.contractType,
  }));
  return symbols;
}

// Filtros por símbolo (LOT_SIZE, MIN_NOTIONAL, PRICE_FILTER)
export interface SymbolFilters {
  minNotional?: number;
  stepSize?: number;
  minQty?: number;
  tickSize?: number;
}

export async function getSpotSymbolFilters(symbol: string): Promise<SymbolFilters> {
  const context = getBinanceContext();
  const { spotClient } = context;
  const resp = await schedule(() => spotClient.get('/api/v3/exchangeInfo'));
  const data = resp.data as { symbols?: Array<{ symbol: string; filters: Array<{ filterType: string; minNotional?: string; stepSize?: string; minQty?: string; tickSize?: string }> }> };
  const entry = (data.symbols ?? []).find((s) => s.symbol === symbol);
  const filters: SymbolFilters = {};
  entry?.filters?.forEach((f) => {
    if (f.filterType === 'MIN_NOTIONAL' && f.minNotional) filters.minNotional = Number.parseFloat(f.minNotional);
    if (f.filterType === 'LOT_SIZE') {
      if (f.stepSize) filters.stepSize = Number.parseFloat(f.stepSize);
      if (f.minQty) filters.minQty = Number.parseFloat(f.minQty);
    }
    if (f.filterType === 'PRICE_FILTER' && f.tickSize) filters.tickSize = Number.parseFloat(f.tickSize);
  });
  return filters;
}

async function placeSpotMarketBuy(
  context: BinanceContext,
  symbol: string,
  quantity: string
) {
  return signedRequest(context, context.spotClient, 'POST', '/api/v3/order', {
    symbol,
    side: 'BUY',
    type: 'MARKET',
    quantity,
    newOrderRespType: 'FULL'
  });
}

async function placeSpotMarketSell(
  context: BinanceContext,
  symbol: string,
  quantity: string
) {
  return signedRequest(context, context.spotClient, 'POST', '/api/v3/order', {
    symbol,
    side: 'SELL',
    type: 'MARKET',
    quantity,
    newOrderRespType: 'FULL'
  });
}

// MARKET com quoteOrderQty para usar valor em USDT diretamente
export async function spotMarketBuyByQuote(symbol: string, quoteOrderQty: number) {
  const context = getBinanceContext();
  if (context.simulation) throw new Error('Operação assinada indisponível em modo simulado. Configure as credenciais.');
  return signedRequest(context, context.spotClient, 'POST', '/api/v3/order', {
    symbol,
    side: 'BUY',
    type: 'MARKET',
    quoteOrderQty: formatQuantity(quoteOrderQty),
    newOrderRespType: 'FULL'
  });
}

export async function spotMarketSell(symbol: string, quantity: number) {
  const context = getBinanceContext();
  if (context.simulation) throw new Error('Operação assinada indisponível em modo simulado. Configure as credenciais.');
  return placeSpotMarketSell(context, symbol, formatQuantity(quantity));
}

async function placeFuturesMarketSell(
  context: BinanceContext,
  symbol: string,
  quantity: string
) {
  return signedRequest(context, context.futuresClient, 'POST', '/fapi/v1/order', {
    symbol,
    side: 'SELL',
    type: 'MARKET',
    quantity,
    reduceOnly: false
  });
}

async function placeFuturesMarketBuy(
  context: BinanceContext,
  symbol: string,
  quantity: string
) {
  return signedRequest(context, context.futuresClient, 'POST', '/fapi/v1/order', {
    symbol,
    side: 'BUY',
    type: 'MARKET',
    quantity,
    reduceOnly: false
  });
}

async function panicSellSpot(
  context: BinanceContext,
  symbol: string,
  quantity: string
): Promise<PanicSellResult> {
  try {
    const response = await placeSpotMarketSell(context, symbol, quantity);
    logger.warn('Venda de panico executada para desfazer posicao spot.', { symbol, quantity });
    return {
      attempted: true,
      success: true,
      response: response.data
    };
  } catch (panicError) {
    logger.error('Falha ao executar venda de panico no mercado spot.', {
      symbol,
      quantity,
      error: formatError(panicError)
    });
    return {
      attempted: true,
      success: false,
      error: (panicError as Error)?.message ?? String(panicError)
    };
  }
}

async function closeFuturesPosition(
  context: BinanceContext,
  symbol: string,
  quantity: string
): Promise<PanicSellResult> {
  try {
    const response = await placeFuturesMarketSell(context, symbol, quantity);
    logger.warn('Posicao futura revertida para desfazer operacao primaria.', { symbol, quantity });
    return {
      attempted: true,
      success: true,
      response: response.data
    };
  } catch (panicError) {
    logger.error('Falha ao desfazer posicao em futuros.', {
      symbol,
      quantity,
      error: formatError(panicError)
    });
    return {
      attempted: true,
      success: false,
      error: (panicError as Error)?.message ?? String(panicError)
    };
  }
}

export async function executeArbitrageOrder(
  trade: TradeParams,
  symbol: string
): Promise<OrderExecutionResult> {
  const context = getBinanceContext();

  if (context.simulation) {
    const profit = calculateProfit(trade);

    return {
      success: profit > 0,
      profit,
      executedAt: new Date(),
      details: {
        message: 'Simulacao executada. Configure as chaves para negociar de verdade.',
        direction: trade.side,
        spread: trade.spread
      },
    };
  }

  const quantity = formatQuantity(trade.amount);
  const executedAt = new Date();

  if (trade.side === 'SHORT_SPOT_LONG_PERP') {
    let futuresOrder;
    try {
      futuresOrder = await placeFuturesMarketBuy(context, symbol, quantity);
    } catch (futuresBuyError) {
      logger.error('Falha ao executar compra no mercado futuro.', { symbol, quantity, error: formatError(futuresBuyError) });
      return {
        success: false,
        profit: 0,
        executedAt,
        details: {
          stage: 'futures-buy',
          error: formatError(futuresBuyError)
        },
      };
    }

    let spotOrder;
    try {
      spotOrder = await placeSpotMarketSell(context, symbol, quantity);
    } catch (spotSellError) {
      logger.error('Falha ao executar venda no mercado spot.', { symbol, quantity, error: formatError(spotSellError) });
      const revertResult = await closeFuturesPosition(context, symbol, quantity);

      return {
        success: false,
        profit: 0,
        executedAt,
        details: {
          stage: 'spot-sell',
          error: formatError(spotSellError),
          revert: revertResult
        },
      };
    }

    const futuresData = futuresOrder.data as {
      orderId: number;
      status: string;
      avgPrice?: string;
      executedQty?: string;
    };
    const spotData = spotOrder.data as {
      orderId: number;
      status: string;
      executedQty: string;
      cummulativeQuoteQty: string;
      fills?: Array<{ price: string; qty: string; commission: string }>;
    };

    const futuresFilled = futuresData?.status === 'FILLED' || futuresData?.status === 'PARTIALLY_FILLED';
    const spotFilled = spotData?.status === 'FILLED' || spotData?.status === 'PARTIALLY_FILLED';
    const profit = calculateProfit(trade);

    return {
      success: futuresFilled && spotFilled,
      profit,
      executedAt,
      details: {
        direction: trade.side,
        spread: trade.spread,
        futuresOrderId: futuresData?.orderId,
        spotOrderId: spotData?.orderId,
        futuresStatus: futuresData?.status,
        spotStatus: spotData?.status,
        futuresExecutedQty: futuresData?.executedQty,
        spotExecutedQty: spotData?.executedQty,
        spotQuoteQty: spotData?.cummulativeQuoteQty,
        spotFills: spotData?.fills
      },
    };
  }

  if (trade.side === 'LONG_SPOT_SHORT_PERP') {
    let spotOrder;
    try {
      spotOrder = await placeSpotMarketBuy(context, symbol, quantity);
    } catch (spotBuyError) {
      logger.error('Falha ao executar compra no mercado spot.', { symbol, quantity, error: formatError(spotBuyError) });
      return {
        success: false,
        profit: 0,
        executedAt,
        details: {
          stage: 'spot-buy',
          error: formatError(spotBuyError)
        },
      };
    }

    let futuresOrder;
    try {
      futuresOrder = await placeFuturesMarketSell(context, symbol, quantity);
    } catch (futuresSellError) {
      logger.error('Falha ao executar venda no futuro.', { symbol, quantity, error: formatError(futuresSellError) });
      const panicSellResult = await panicSellSpot(context, symbol, quantity);

      return {
        success: false,
        profit: 0,
        executedAt,
        details: {
          stage: 'futures-sell',
          error: formatError(futuresSellError),
          panicSell: panicSellResult
        },
      };
    }

    const spotData = spotOrder.data as {
      orderId: number;
      status: string;
      executedQty: string;
      cummulativeQuoteQty: string;
      fills?: Array<{ price: string; qty: string; commission: string }>;
    };
    const futuresData = futuresOrder.data as {
      orderId: number;
      status: string;
      avgPrice?: string;
      executedQty?: string;
    };

    const spotFilled = spotData?.status === 'FILLED' || spotData?.status === 'PARTIALLY_FILLED';
    const futuresFilled = futuresData?.status === 'FILLED' || futuresData?.status === 'PARTIALLY_FILLED';
    const profit = calculateProfit(trade);

    return {
      success: spotFilled && futuresFilled,
      profit,
      executedAt,
      details: {
        direction: trade.side,
        spread: trade.spread,
        spotOrderId: spotData?.orderId,
        futuresOrderId: futuresData?.orderId,
        spotStatus: spotData?.status,
        futuresStatus: futuresData?.status,
        spotExecutedQty: spotData?.executedQty,
        spotQuoteQty: spotData?.cummulativeQuoteQty,
        spotFills: spotData?.fills,
        futuresAvgPrice: futuresData?.avgPrice,
        futuresExecutedQty: futuresData?.executedQty
      },
    };
  }

  throw new Error('Unsupported trade side: ' + trade.side);
}

export async function getSpotBalance(): Promise<number> {
  const context = getBinanceContext();

  // Em modo simulado, retornamos 0 para spot por segurança
  if (context.simulation) {
    return 0;
  }

  const response = await signedRequest(context, context.spotClient, 'GET', '/api/v3/account');
  const data = response.data as {
    balances?: Array<{ asset: string; free: string; locked: string }>;
  };

  const list = data?.balances ?? [];
  if (!Array.isArray(list)) {
    throw new Error('Resposta inesperada ao consultar saldo spot.');
  }

  const assetEntry = list.find((entry) => entry.asset === BALANCE_ASSET) ?? list[0];
  const freeAmount = Number.parseFloat(assetEntry?.free ?? '0');
  return Number.isFinite(freeAmount) ? freeAmount : 0;
}

/**
 * Retorna o valor estimado da carteira Spot em USDT (free + locked para cada ativo convertido para USDT).
 */
export async function getSpotPortfolioValueUSDT(): Promise<number> {
  const context = getBinanceContext();

  if (context.simulation) {
    return 0;
  }

  const response = await signedRequest(context, context.spotClient, 'GET', '/api/v3/account');
  const data = response.data as {
    balances?: Array<{ asset: string; free: string; locked: string }>;
  };

  const list = data?.balances ?? [];
  if (!Array.isArray(list) || list.length === 0) return 0;

  // Estáveis que podem ser tratados como ~1:1 com USDT
  const stableCoins = new Set(['USDT', 'USDC', 'BUSD', 'TUSD', 'FDUSD', 'DAI']);

  // Preços auxiliares para conversões indiretas (apenas quando necessário)
  async function getPrice(symbol: string): Promise<number> {
    try {
      const resp = await schedule(() => context.spotClient.get('/api/v3/ticker/price', { params: { symbol } }));
      const p = Number.parseFloat(resp.data?.price ?? '0');
      return Number.isFinite(p) && p > 0 ? p : 0;
    } catch {
      return 0;
    }
  }

  const busdUsdt = await getPrice('BUSDUSDT');
  const usdcUsdt = await getPrice('USDCUSDT');

  let totalUsdt = 0;
  for (const entry of list) {
    const asset = entry.asset;
    const amount = Number.parseFloat(entry.free ?? '0') + Number.parseFloat(entry.locked ?? '0');
    if (!Number.isFinite(amount) || amount <= 0) continue;

    // USDT direto
    if (asset === 'USDT') {
      totalUsdt += amount;
      continue;
    }

    // Estáveis: tentar par direto, senão assumir ~1:1
    if (stableCoins.has(asset)) {
      const directStable = await getPrice(`${asset}USDT`);
      if (directStable > 0) {
        totalUsdt += amount * directStable;
      } else {
        // fallback aproximado
        totalUsdt += amount;
      }
      continue;
    }

    // Tentar par direto com USDT
    let converted = 0;
    const direct = await getPrice(`${asset}USDT`);
    if (direct > 0) {
      converted = amount * direct;
    } else {
      // Tentar via BUSD
      const viaBusd = await getPrice(`${asset}BUSD`);
      if (viaBusd > 0 && busdUsdt > 0) {
        converted = amount * viaBusd * busdUsdt;
      } else {
        // Tentar via USDC
        const viaUsdc = await getPrice(`${asset}USDC`);
        if (viaUsdc > 0 && usdcUsdt > 0) {
          converted = amount * viaUsdc * usdcUsdt;
        }
      }
    }

    if (converted > 0) {
      totalUsdt += converted;
    }
  }

  return Number.isFinite(totalUsdt) ? totalUsdt : 0;
}

/**
 * Retorna o total da carteira de Futuros em USDT.
 */
export async function getFuturesTotalUSDT(): Promise<number> {
  const context = getBinanceContext();

  if (context.simulation) {
    return SIMULATED_BALANCE;
  }

  const resp = await signedRequest(context, context.futuresClient, 'GET', '/fapi/v2/account');
  const data = resp.data as { totalWalletBalance?: string };
  const total = Number.parseFloat(data?.totalWalletBalance ?? '0');
  return Number.isFinite(total) ? total : 0;
}

/**
 * Retorna lista crua dos saldos Spot (free/locked) por ativo, diretamente da Binance.
 */
export async function getSpotBalancesRaw(): Promise<Array<{ asset: string; free: number; locked: number }>> {
  const context = getBinanceContext();

  if (context.simulation) {
    return [];
  }

  const response = await signedRequest(context, context.spotClient, 'GET', '/api/v3/account');
  const data = response.data as {
    balances?: Array<{ asset: string; free: string; locked: string }>;
  };

  const list = data?.balances ?? [];
  if (!Array.isArray(list)) return [];

  return list.map((b) => ({
    asset: b.asset,
    free: Number.parseFloat(b.free ?? '0'),
    locked: Number.parseFloat(b.locked ?? '0')
  }));
}
export async function fetchFundingRateBpsPer8h(symbol: string): Promise<number> {
  const context = getBinanceContext();

  if (context.simulation) {
    return 0;
  }

  try {
    const response = await schedule(() =>
      context.futuresClient.get('/fapi/v1/fundingRate', {
        params: { symbol, limit: 1 }
      })
    );

    const entries = Array.isArray(response.data) ? response.data : [response.data];
    const firstEntry = entries[0] ?? {};
    const rate = Number.parseFloat(firstEntry.fundingRate ?? firstEntry.lastFundingRate ?? '0');

    return Number.isFinite(rate) ? rate * 10000 : 0;
  } catch (error) {
    logger.warn('Nao foi possivel obter funding rate. Usando 0.', { symbol, error: formatError(error) });
    return 0;
  }
}

export async function fetchBorrowAprPct(baseAsset: string): Promise<number> {
  const context = getBinanceContext();

  if (context.simulation) {
    return 0;
  }

  void baseAsset;
  // TODO: Integrar consulta da taxa de borrow do mercado spot/margin da Binance.
  return 0;
}









