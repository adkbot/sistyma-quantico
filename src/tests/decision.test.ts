// src/tests/decision.test.ts

import { shouldExecuteTrade } from '../logic/decision';
import type { TradeParams } from '../types';

describe('Testes para a fun��o de decis�o shouldExecuteTrade', () => {
  // Cen�rio 1: Deve executar, pois o lucro � maior que o m�nimo
  test('deve retornar TRUE quando o lucro excede o limite m�nimo', () => {
    const trade: TradeParams = { buyPrice: 50000, sellPrice: 50150, amount: 1, feePercentage: 0.001 };
    const minProfitPercentage = 0.05;

    const decision = shouldExecuteTrade(trade, minProfitPercentage);

    expect(decision).toBe(true);
  });

  // Cen�rio 2: N�o deve executar, pois o lucro � muito baixo
  test('deve retornar FALSE quando o lucro � positivo, mas abaixo do limite m�nimo', () => {
    const trade: TradeParams = { buyPrice: 50000, sellPrice: 50070, amount: 1, feePercentage: 0.001 };
    const minProfitPercentage = 0.05;

    const decision = shouldExecuteTrade(trade, minProfitPercentage);

    expect(decision).toBe(false);
  });

  // Cen�rio 3: N�o deve executar, pois o pre�o do Futuro � menor
  test('deve retornar FALSE quando o pre�o do Spot � maior ou igual ao do Futuro', () => {
    const trade: TradeParams = { buyPrice: 50100, sellPrice: 50000, amount: 1, feePercentage: 0.001 };
    const minProfitPercentage = 0.05;

    const decision = shouldExecuteTrade(trade, minProfitPercentage);

    expect(decision).toBe(false);
  });
});
