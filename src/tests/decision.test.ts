// src/tests/decision.test.ts

import { shouldExecuteTrade } from '../logic/decision';
import type { TradeParams } from '../types';

describe('Testes para a função de decisão shouldExecuteTrade', () => {
  // Cenário 1: Deve executar, pois o lucro é maior que o mínimo
  test('deve retornar TRUE quando o lucro excede o limite mínimo', () => {
    const trade: TradeParams = { buyPrice: 50000, sellPrice: 50150, amount: 1, feePercentage: 0.001 };
    const minProfitPercentage = 0.05;

    const decision = shouldExecuteTrade(trade, minProfitPercentage);

    expect(decision).toBe(true);
  });

  // Cenário 2: Não deve executar, pois o lucro é muito baixo
  test('deve retornar FALSE quando o lucro é positivo, mas abaixo do limite mínimo', () => {
    const trade: TradeParams = { buyPrice: 50000, sellPrice: 50070, amount: 1, feePercentage: 0.001 };
    const minProfitPercentage = 0.05;

    const decision = shouldExecuteTrade(trade, minProfitPercentage);

    expect(decision).toBe(false);
  });

  // Cenário 3: Não deve executar, pois o preço do Futuro é menor
  test('deve retornar FALSE quando o preço do Spot é maior ou igual ao do Futuro', () => {
    const trade: TradeParams = { buyPrice: 50100, sellPrice: 50000, amount: 1, feePercentage: 0.001 };
    const minProfitPercentage = 0.05;

    const decision = shouldExecuteTrade(trade, minProfitPercentage);

    expect(decision).toBe(false);
  });
});
