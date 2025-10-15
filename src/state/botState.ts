// src/state/botState.ts

import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { ApiBotBalance, ApiBotMetrics, ApiBotSnapshot, ApiBotStatus, ApiBotTrade } from '../types/api';
import type { TradeParams } from '@/shared/types';

export type BotBalance = ApiBotBalance;
export type BotTrade = ApiBotTrade;
export type BotMetrics = ApiBotMetrics;
export type BotStatus = ApiBotStatus;
export type BotSnapshot = ApiBotSnapshot;

const defaultMetrics: BotMetrics = {
  total_pnl: 0,
  daily_pnl: 0,
  total_trades: 0,
  success_rate: 0,
  avg_latency: 0,
  active_pairs: 0,
  ai_confidence: 0,
};

const defaultStatus: BotStatus = {
  running: false,
  tradingPair: 'BTCUSDT',
  pollIntervalMs: 5000,
  lastCycleAt: null,
  lastTradeAt: null,
};

class BotState {
  private balances: BotBalance[] = [];
  private trades: BotTrade[] = [];
  private metrics: BotMetrics = { ...defaultMetrics };
  private status: BotStatus = { ...defaultStatus };
  private emitter = new EventEmitter();

  initialize(pair: string, pollIntervalMs: number): void {
    this.status.tradingPair = pair;
    this.status.pollIntervalMs = pollIntervalMs;
    this.emitChange();
  }

  setRunning(running: boolean): void {
    if (this.status.running === running) {
      return;
    }

    this.status.running = running;
    this.status.lastMessage = running ? 'Bot iniciado.' : 'Bot pausado.';
    this.emitChange();
  }

  setLastCycle(date = new Date()): void {
    this.status.lastCycleAt = date.toISOString();
    this.emitChange();
  }

  setMessage(message: string): void {
    this.status.lastMessage = message;
    this.emitChange();
  }

  recordError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.status.lastError = {
      message,
      timestamp: new Date().toISOString(),
    };
    this.status.lastMessage = 'Erro durante o ciclo do bot.';
    this.emitChange();
  }

  updateBalanceFromFutures(balance: number, spotPrice: number): void {
    const roundedBalance = Number(balance.toFixed(2));
    this.balances = [
      {
        asset: 'USDT',
        spot_balance: 0,
        futures_balance: roundedBalance,
        total_balance: roundedBalance,
      },
    ];

    this.status.lastMessage = `Saldo atualizado: ${roundedBalance.toFixed(2)} USDT em futuros.`;

    if (spotPrice > 0) {
      this.metrics.active_pairs = Math.max(this.metrics.active_pairs, 1);
    }

    this.updateMetrics(false);
    this.emitChange();
  }

  updateBalances(spotBalance: number, futuresBalance: number, spotPrice: number): void {
    const roundedSpot = Number(spotBalance.toFixed(2));
    const roundedFut = Number(futuresBalance.toFixed(2));
    const total = Number((roundedSpot + roundedFut).toFixed(2));

    this.balances = [
      {
        asset: 'USDT',
        spot_balance: roundedSpot,
        futures_balance: roundedFut,
        total_balance: total,
      },
    ];

    this.status.lastMessage = `Saldo atualizado: ${roundedSpot.toFixed(2)} USDT spot e ${roundedFut.toFixed(2)} USDT em futuros.`;

    if (spotPrice > 0) {
      this.metrics.active_pairs = Math.max(this.metrics.active_pairs, 1);
    }

    this.updateMetrics(false);
    this.emitChange();
  }

  recordTrade(params: {
    trade: TradeParams;
    pair: string;
    resultProfit: number;
    latencyMs: number;
    feesUsd?: number;
    slippage?: number;
  }): BotTrade {
    const { trade, pair, resultProfit, latencyMs, feesUsd = trade.amount * trade.sellPrice * trade.feePercentage, slippage = Math.abs(trade.spread) * 0.0001 } = params;

    const newTrade: BotTrade = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      pair,
      type: trade.side === 'LONG_SPOT_SHORT_PERP' ? 'spot-futures' : 'futures-spot',
      direction: trade.side,
      spread: trade.spread,
      entryPrice: trade.buyPrice,
      exitPrice: trade.sellPrice,
      volume: trade.amount,
      pnl: resultProfit,
      fees: feesUsd,
      slippage,
      duration: latencyMs,
      aiConfidence: Math.min(100, Math.max(5, 80 + Math.random() * 20)),
    };

    this.trades = [newTrade, ...this.trades].slice(0, 200);
    this.status.lastTradeAt = newTrade.timestamp;
    this.status.lastMessage = `Trade executado com PnL de ${resultProfit.toFixed(2)}.`;

    this.updateMetrics(true);
    this.emitChange();

    return newTrade;
  }

  private updateMetrics(recalculateActivePairs: boolean): void {
    if (this.trades.length === 0) {
      this.metrics = {
        ...defaultMetrics,
        active_pairs: recalculateActivePairs ? 0 : this.metrics.active_pairs,
      };
      return;
    }

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const totalPnl = this.trades.reduce((acc, trade) => acc + trade.pnl, 0);
    const dailyPnl = this.trades
      .filter((trade) => new Date(trade.timestamp) >= startOfDay)
      .reduce((acc, trade) => acc + trade.pnl, 0);

    const successTrades = this.trades.filter((trade) => trade.pnl > 0);
    const avgLatency = this.trades.reduce((acc, trade) => acc + trade.duration, 0) / this.trades.length;
    const avgConfidence = this.trades.reduce((acc, trade) => acc + trade.aiConfidence, 0) / this.trades.length;
    const uniquePairs = new Set(this.trades.map((trade) => trade.pair)).size;

    this.metrics = {
      total_pnl: totalPnl,
      daily_pnl: dailyPnl,
      total_trades: this.trades.length,
      success_rate: (successTrades.length / this.trades.length) * 100,
      avg_latency: avgLatency,
      active_pairs: recalculateActivePairs ? uniquePairs : Math.max(this.metrics.active_pairs, uniquePairs),
      ai_confidence: avgConfidence,
    };
  }

  getSnapshot(): BotSnapshot {
    return {
      balances: this.balances,
      trades: this.trades,
      metrics: this.metrics,
      status: this.status,
    };
  }

  onChange(listener: (snapshot: BotSnapshot) => void): () => void {
    this.emitter.on('change', listener);
    return () => {
      this.emitter.off('change', listener);
    };
  }

  private emitChange(): void {
    this.emitter.emit('change', this.getSnapshot());
  }
}

export const botState = new BotState();









