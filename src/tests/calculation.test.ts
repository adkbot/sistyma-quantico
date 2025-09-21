// src/tests/calculation.test.ts

import type { TradeParams } from '../types';
import { calculateProfit } from '../logic/calculation';

describe('Testes para a fun��o calculateProfit', () => {
  // Teste 1: Um cen�rio com lucro claro
  test('deve calcular o lucro corretamente para uma negocia��o vantajosa', () => {
    const trade: TradeParams = {
      buyPrice: 50000,
      sellPrice: 51000,
      amount: 1,
      feePercentage: 0.001
    };

    const profit = calculateProfit(trade);

    expect(profit).toBeCloseTo(949);
  });

  // Teste 2: Um cen�rio com preju�zo por causa das taxas
  test('deve calcular o preju�zo corretamente quando as taxas tornam a negocia��o invi�vel', () => {
    const trade: TradeParams = {
      buyPrice: 50000,
      sellPrice: 50020,
      amount: 1,
      feePercentage: 0.001
    };

    const profit = calculateProfit(trade);

    expect(profit).toBeCloseTo(-30.02);
  });

  // Teste 3: Um cen�rio com valores fracionados (decimais)
  test('deve lidar corretamente com valores fracionados', () => {
    const trade: TradeParams = {
      buyPrice: 65123.45,
      sellPrice: 65800.99,
      amount: 0.05,
      feePercentage: 0.001
    };

    const profit = calculateProfit(trade);

    expect(profit).toBeCloseTo(30.587);
  });

  // Teste 4: Um cen�rio de borda com taxa zero
  test('deve calcular o lucro corretamente quando a taxa � zero', () => {
    const trade: TradeParams = {
      buyPrice: 50000,
      sellPrice: 51000,
      amount: 2,
      feePercentage: 0
    };

    const profit = calculateProfit(trade);

    expect(profit).toBe(2000);
  });

  const invalidCases: Array<{ trade: TradeParams; reason: string }> = [
    { trade: { buyPrice: 0, sellPrice: 50000, amount: 1, feePercentage: 0.001 }, reason: 'pre�o de compra zero' },
    { trade: { buyPrice: 50000, sellPrice: -100, amount: 1, feePercentage: 0.001 }, reason: 'pre�o de venda negativo' },
    { trade: { buyPrice: 50000, sellPrice: 51000, amount: 0, feePercentage: 0.001 }, reason: 'quantidade zero' }
  ];

  // Teste 5: Cen�rios com entradas inv�lidas
  test.each(invalidCases)('deve retornar 0 quando a entrada � inv�lida ($reason)', ({ trade }) => {
    const profit = calculateProfit(trade);

    expect(profit).toBe(0);
  });
});
