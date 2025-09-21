// src/bot.ts

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { botState } from './state/botState';
import { executeArbitrageOrder, getFuturesBalance, getMarketPrices } from './api/exchange';
import { shouldExecuteTrade } from './logic/decision';
import { logger } from './logger';
import type { TradeParams } from './types';

export interface BotConfig {
  tradingPair: string;
  minProfitPercentage: number;
  exchangeFeePercentage: number;
  checkIntervalSeconds: number;
}

export interface StartBotOptions {
  symbol?: string;
  pollIntervalMs?: number;
  minProfitPercentage?: number;
  feePercentage?: number;
}

const CONFIG_PATH = new URL('../config.json', import.meta.url);

export function loadConfig(): BotConfig {
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<BotConfig>;

    return {
      tradingPair: parsed.tradingPair ?? 'BTCUSDT',
      minProfitPercentage: parsed.minProfitPercentage ?? 0.05,
      exchangeFeePercentage: parsed.exchangeFeePercentage ?? 0.001,
      checkIntervalSeconds: parsed.checkIntervalSeconds ?? 5,
    };
  } catch (error) {
    logger.error('Falha ao carregar config.json. Usando padrões de contingência.', { error });
    return {
      tradingPair: 'BTCUSDT',
      minProfitPercentage: 0.05,
      exchangeFeePercentage: 0.001,
      checkIntervalSeconds: 5,
    };
  }
}

export function writeConfig(config: BotConfig): void {
  writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, 'utf-8');
}

function mergeOptions(base: BotConfig, options: StartBotOptions = {}): BotConfig {
  return {
    tradingPair: options.symbol ?? base.tradingPair,
    minProfitPercentage: options.minProfitPercentage ?? base.minProfitPercentage,
    exchangeFeePercentage: options.feePercentage ?? base.exchangeFeePercentage,
    checkIntervalSeconds: options.pollIntervalMs
      ? Math.max(1, Math.round(options.pollIntervalMs / 1000))
      : base.checkIntervalSeconds,
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

async function botLoop(config: BotConfig, signal: AbortSignal): Promise<void> {
  const pollIntervalMs = config.checkIntervalSeconds * 1000;
  const symbol = config.tradingPair;
  const minProfitPercentage = config.minProfitPercentage;
  const feePercentage = config.exchangeFeePercentage;

  botState.initialize(symbol, pollIntervalMs);
  botState.setRunning(true);

  while (!signal.aborted) {
    try {
      const capital = await getFuturesBalance();

      if (signal.aborted) {
        break;
      }

      if (capital <= 0) {
        logger.warn('Sem capital disponível na carteira de futuros. Aguardando...');
        botState.updateBalanceFromFutures(0, 0);
        botState.setLastCycle();
        await waitWithAbort(pollIntervalMs, signal);
        continue;
      }

      const prices = await getMarketPrices(symbol);

      if (signal.aborted) {
        break;
      }

      if (prices.spot <= 0) {
        logger.warn('Preço do spot inválido recebido. Ignorando ciclo.', prices);
        botState.updateBalanceFromFutures(capital, 0);
        botState.setLastCycle();
        await waitWithAbort(pollIntervalMs, signal);
        continue;
      }

      botState.updateBalanceFromFutures(capital, prices.spot);

      const amount = capital / prices.spot;

      if (!Number.isFinite(amount) || amount <= 0) {
        logger.warn('Quantidade calculada inválida. Aguardando próximo ciclo.', { amount, capital, prices });
        botState.setLastCycle();
        await waitWithAbort(pollIntervalMs, signal);
        continue;
      }

      const tradeParams: TradeParams = {
        buyPrice: prices.spot,
        sellPrice: prices.futuros,
        amount,
        feePercentage,
      };

      if (shouldExecuteTrade(tradeParams, minProfitPercentage)) {
        logger.info('Oportunidade encontrada. Executando arbitragem...', { tradeParams });

        const tradeStart = performance.now();
        const result = await executeArbitrageOrder(tradeParams, symbol);
        const latencyMs = performance.now() - tradeStart;

        if (result.success) {
          logger.info(`Operação concluída com lucro estimado de ${result.profit.toFixed(2)}.`, {
            executedAt: result.executedAt.toISOString(),
            details: result.details,
          });

          botState.recordTrade({
            trade: tradeParams,
            pair: symbol,
            resultProfit: result.profit,
            latencyMs,
            feesUsd: tradeParams.amount * tradeParams.buyPrice * tradeParams.feePercentage,
            slippage: Math.abs(tradeParams.sellPrice - tradeParams.buyPrice) * 0.0001,
          });

          const updatedBalance = await getFuturesBalance();
          botState.updateBalanceFromFutures(updatedBalance, prices.spot);
          logger.info('Saldo atualizado após execução.', { updatedBalance });
        } else {
          logger.warn('Execução retornou sem sucesso. Verifique o retorno da corretora.', result.details);
        }
      } else {
        logger.info('Nenhuma oportunidade encontrada nesse ciclo.', { spread: prices.futuros - prices.spot });
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
      logger.warn('Solicitação de start ignorada: bot já está em execução.');
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
      logger.info('Solicitação de stop ignorada: bot já está parado.');
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

