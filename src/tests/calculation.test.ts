// src/tests/calculation.test.ts

import type { TradeParams } from '@/shared/types';
import { calculateProfit } from '../logic/calculation';

describe('Testes para a fun��o calculateProfit', () => {
  test('calcula lucro para arbitragem forward', () => {
    const trade: TradeParams = {
      buyPrice: 51000,
      sellPrice: 50000,
      amount: 1,
      feePercentage: 0.001,
      spread: 1000,
      side: 'SHORT_SPOT_LONG_PERP',
    };

    const profit = calculateProfit(trade);
    // Gross: 1000 * 1 = 1000
    // Buy fees: 51000 * 1 * 0.001 = 51
    // Sell fees: 50000 * 1 * 0.001 = 50
    // Total fees: 101
    // Profit: 1000 - 101 = 899
    expect(profit).toBeCloseTo(899, 1);
  });

  test('calcula lucro para arbitragem reversa', () => {
    const trade: TradeParams = {
      buyPrice: 50000,
      sellPrice: 49200,
      amount: 2,
      feePercentage: 0.001,
      spread: -800,
      side: 'LONG_SPOT_SHORT_PERP',
    };

    const profit = calculateProfit(trade);
    // Gross: 800 * 2 = 1600
    // Buy fees: 50000 * 2 * 0.001 = 100
    // Sell fees: 49200 * 2 * 0.001 = 98.4
    // Total fees: 198.4
    // Profit: 1600 - 198.4 = 1401.6
    expect(profit).toBeCloseTo(1401.6, 1);
  });

  test('retorna zero quando dados s�o inv�lidos', () => {
    const cases: TradeParams[] = [
      { buyPrice: 51000, sellPrice: 0, amount: 1, feePercentage: 0.001, spread: 1000, side: 'SHORT_SPOT_LONG_PERP' },
      { buyPrice: 0, sellPrice: 50000, amount: 1, feePercentage: 0.001, spread: -1000, side: 'LONG_SPOT_SHORT_PERP' },
      { buyPrice: 100, sellPrice: 120, amount: 0, feePercentage: 0.001, spread: 20, side: 'SHORT_SPOT_LONG_PERP' },
    ];

    for (const trade of cases) {
      expect(calculateProfit(trade)).toBe(0);
    }
  });
});









