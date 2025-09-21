// src/logic/calculation.ts

import type { TradeParams } from '../types';

/**
 * Calcula o lucro líquido de uma operação de arbitragem, considerando as taxas.
 */
export function calculateProfit({ buyPrice, sellPrice, amount, feePercentage }: TradeParams): number {
  if (buyPrice <= 0 || sellPrice <= 0 || amount <= 0) {
    return 0;
  }

  const totalBuyCost = buyPrice * amount;
  const totalSellValue = sellPrice * amount;

  // A taxa é geralmente cobrada sobre o valor total da transação
  const sellFee = totalSellValue * feePercentage;

  const netProfit = totalSellValue - totalBuyCost - sellFee;

  return netProfit;
}
