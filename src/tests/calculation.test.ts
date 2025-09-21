// src/tests/calculation.test.ts

import type { TradeParams } from '../types';
import { calculateProfit } from '../logic/calculation';

describe('Testes para a função calculateProfit', () => {
  // Teste 1: Um cenário com lucro claro
  test('deve calcular o lucro corretamente para uma negociação vantajosa', () => {
    const trade: TradeParams = {
      buyPrice: 50000,
      sellPrice: 51000,
      amount: 1,
      feePercentage: 0.001
    };

    const profit = calculateProfit(trade);

    expect(profit).toBeCloseTo(949);
  });

  // Teste 2: Um cenário com prejuízo por causa das taxas
  test('deve calcular o prejuízo corretamente quando as taxas tornam a negociação inviável', () => {
    const trade: TradeParams = {
      buyPrice: 50000,
      sellPrice: 50020,
      amount: 1,
      feePercentage: 0.001
    };

    const profit = calculateProfit(trade);

    expect(profit).toBeCloseTo(-30.02);
  });

  // Teste 3: Um cenário com valores fracionados (decimais)
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

  // Teste 4: Um cenário de borda com taxa zero
  test('deve calcular o lucro corretamente quando a taxa é zero', () => {
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
    { trade: { buyPrice: 0, sellPrice: 50000, amount: 1, feePercentage: 0.001 }, reason: 'preço de compra zero' },
    { trade: { buyPrice: 50000, sellPrice: -100, amount: 1, feePercentage: 0.001 }, reason: 'preço de venda negativo' },
    { trade: { buyPrice: 50000, sellPrice: 51000, amount: 0, feePercentage: 0.001 }, reason: 'quantidade zero' }
  ];

  // Teste 5: Cenários com entradas inválidas
  test.each(invalidCases)('deve retornar 0 quando a entrada é inválida ($reason)', ({ trade }) => {
    const profit = calculateProfit(trade);

    expect(profit).toBe(0);
  });
});
