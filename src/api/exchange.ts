// src/api/exchange.ts

import 'dotenv/config';
import axios, { type AxiosInstance } from 'axios';
import Bottleneck from 'bottleneck';
import { createHmac } from 'node:crypto';
import { logger } from '../logger';
import { calculateProfit } from '../logic/calculation';
import type { TradeParams } from '../types';

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

const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: MIN_TIME_BETWEEN_CALLS_MS
});

const schedule = <T>(fn: () => Promise<T>): Promise<T> => limiter.schedule(fn);

const API_KEY = process.env.API_KEY;
const SECRET_KEY = process.env.SECRET_KEY;
const SPOT_API_BASE = process.env.SPOT_API_BASE ?? 'https://api.binance.com';
const FUTURES_API_BASE = process.env.FUTURES_API_BASE ?? 'https://fapi.binance.com';

if (!API_KEY || !SECRET_KEY) {
  logger.warn(
    'API_KEY e/ou SECRET_KEY não configurados. Operações reais permanecerão em modo de simulação até que as credenciais sejam definidas.'
  );
}

const spotClient = axios.create({
  baseURL: SPOT_API_BASE,
  timeout: Number.parseInt(process.env.API_TIMEOUT_MS ?? '10000', 10)
});

const futuresClient = axios.create({
  baseURL: FUTURES_API_BASE,
  timeout: Number.parseInt(process.env.API_TIMEOUT_MS ?? '10000', 10)
});

if (API_KEY) {
  spotClient.defaults.headers.common['X-MBX-APIKEY'] = API_KEY;
  futuresClient.defaults.headers.common['X-MBX-APIKEY'] = API_KEY;
}

type HttpMethod = 'GET' | 'POST' | 'DELETE';
type RawParams = Record<string, string | number | boolean | undefined>;

function ensureCredentials(): asserts API_KEY is string & { length: number } {
  if (!API_KEY || !SECRET_KEY) {
    throw new Error('Credenciais da API não configuradas. Defina API_KEY e SECRET_KEY no arquivo .env.');
  }
}

function trimZeros(value: string): string {
  return value.replace(/(\.\d*?[1-9])0+$/u, '$1').replace(/\.0+$/u, '');
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

function buildSignedQuery(params: RawParams = {}): URLSearchParams {
  ensureCredentials();

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

  const signature = createHmac('sha256', SECRET_KEY!)
    .update(query.toString())
    .digest('hex');

  query.append('signature', signature);

  return query;
}

async function signedRequest(
  client: AxiosInstance,
  method: HttpMethod,
  path: string,
  params: RawParams = {}
) {
  const query = buildSignedQuery(params);
  const headers = {
    'X-MBX-APIKEY': API_KEY ?? '',
    'Content-Type': 'application/x-www-form-urlencoded'
  };

  if (method === 'GET' || method === 'DELETE') {
    const url = `${path}?${query.toString()}`;
    return schedule(() => client.request({ method, url, headers }));
  }

  if (method === 'POST') {
    return schedule(() => client.post(path, query.toString(), { headers }));
  }

  throw new Error(`Método HTTP não suportado: ${method}`);
}

export async function getFuturesBalance(): Promise<number> {
  if (!API_KEY || !SECRET_KEY) {
    logger.warn('Retornando saldo simulado porque as credenciais não estão configuradas.');
    return 20;
  }

  const response = await signedRequest(futuresClient, 'GET', '/fapi/v2/balance');
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

  if (!Number.isFinite(spotPrice) || !Number.isFinite(futuresPrice)) {
    throw new Error('Preços inválidos recebidos da corretora.');
  }

  return {
    spot: spotPrice,
    futuros: futuresPrice
  };
}

async function placeSpotMarketBuy(symbol: string, quantity: string) {
  return signedRequest(spotClient, 'POST', '/api/v3/order', {
    symbol,
    side: 'BUY',
    type: 'MARKET',
    quantity,
    newOrderRespType: 'FULL'
  });
}

async function placeSpotMarketSell(symbol: string, quantity: string) {
  return signedRequest(spotClient, 'POST', '/api/v3/order', {
    symbol,
    side: 'SELL',
    type: 'MARKET',
    quantity,
    newOrderRespType: 'FULL'
  });
}

async function placeFuturesMarketSell(symbol: string, quantity: string) {
  return signedRequest(futuresClient, 'POST', '/fapi/v1/order', {
    symbol,
    side: 'SELL',
    type: 'MARKET',
    quantity,
    reduceOnly: false
  });
}

async function panicSellSpot(symbol: string, quantity: string): Promise<PanicSellResult> {
  try {
    const response = await placeSpotMarketSell(symbol, quantity);
    logger.warn('Venda de pânico executada para desfazer posição spot.', { symbol, quantity });
    return {
      attempted: true,
      success: true,
      response: response.data
    };
  } catch (panicError) {
    logger.error('Falha ao executar venda de pânico no mercado spot.', {
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
  if (!API_KEY || !SECRET_KEY) {
    logger.info('Execução simulada porque as credenciais não estão configuradas.');

    const profit = calculateProfit(trade);

    return {
      success: profit > 0,
      profit,
      executedAt: new Date(),
      details: {
        message: 'Simulação executada. Configure API_KEY/SECRET_KEY para negociar de verdade.'
      }
    };
  }

  const quantity = formatQuantity(trade.amount);

  let spotOrder;
  try {
    spotOrder = await placeSpotMarketBuy(symbol, quantity);
  } catch (spotError) {
    logger.error('Falha ao executar ordem de compra no mercado spot.', {
      symbol,
      quantity,
      error: formatError(spotError)
    });

    return {
      success: false,
      profit: 0,
      executedAt: new Date(),
      details: {
        stage: 'spot-buy',
        error: formatError(spotError)
      }
    };
  }

  let futuresOrder;
  try {
    futuresOrder = await placeFuturesMarketSell(symbol, quantity);
  } catch (futuresError) {
    logger.error('Falha ao executar ordem de venda no futuro.', {
      symbol,
      quantity,
      error: formatError(futuresError)
    });

    const panicSellResult = await panicSellSpot(symbol, quantity);

    return {
      success: false,
      profit: 0,
      executedAt: new Date(),
      details: {
        stage: 'futures-sell',
        error: formatError(futuresError),
        panicSell: panicSellResult
      }
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
    executedAt: new Date(),
    details: {
      spotOrderId: spotData?.orderId,
      futuresOrderId: futuresData?.orderId,
      spotStatus: spotData?.status,
      futuresStatus: futuresData?.status,
      spotExecutedQty: spotData?.executedQty,
      spotQuoteQty: spotData?.cummulativeQuoteQty,
      spotFills: spotData?.fills,
      futuresAvgPrice: futuresData?.avgPrice,
      futuresExecutedQty: futuresData?.executedQty
    }
  };
}
