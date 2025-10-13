// src/logic/calculation.ts

import type { TradeParams } from '@/shared/types';

/**
 * Calcula o lucro l�quido de uma opera��o de arbitragem, considerando as taxas.
 */
export function calculateProfit({ spread, amount, feePercentage, sellPrice, buyPrice }: TradeParams): number {
  if (!Number.isFinite(spread) || amount <= 0 || sellPrice <= 0 || buyPrice <= 0) {
    return 0;
  }

  const gross = Math.abs(spread) * amount;
  // Taxas aplicadas em ambos os lados da operação
  const buyFees = buyPrice * amount * feePercentage;
  const sellFees = sellPrice * amount * feePercentage;
  const totalFees = buyFees + sellFees;

  return gross - totalFees;
}









