// src/logic/decision.ts

import type { TradeParams } from '../types';
import { calculateProfit } from './calculation';

/**
 * Decide se uma operação de arbitragem Spot->Futuros deve ser executada.
 */
export function shouldExecuteTrade(trade: TradeParams, minProfitPercentage: number): boolean {
  if (trade.sellPrice <= trade.buyPrice) {
    return false;
  }

  const netProfit = calculateProfit(trade);

  if (netProfit <= 0) {
    return false;
  }

  const totalCost = trade.buyPrice * trade.amount;
  if (totalCost <= 0) {
    return false;
  }

  const profitPercentage = (netProfit / totalCost) * 100;

  return profitPercentage >= minProfitPercentage;
}
