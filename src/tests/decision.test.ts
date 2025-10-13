// src/tests/decision.test.ts

import { computeNetEdgeBps, decideSide } from '../engine/arbDecision';

const baseCfg = {
  feesBps: { spotTaker: 10, futuresTaker: 4 },
  slippageBpsPerLeg: 5,
  considerFunding: true,
  fundingHorizonHours: 8,
  minSpreadBpsLongCarry: 20,
  minSpreadBpsReverse: 25,
  allowReverse: true,
  spotMarginEnabled: true,
  maxBorrowAprPct: 25
};

describe('arbDecision helpers', () => {
  test('computeNetEdgeBps calcula basis em bps corretamente', () => {
    const metrics = computeNetEdgeBps({
      spot: 100,
      futures: 101,
      feesBps: baseCfg.feesBps,
      slippageBpsPerLeg: baseCfg.slippageBpsPerLeg,
      considerFunding: false,
      fundingRateBpsPer8h: 0,
      fundingHorizonHours: baseCfg.fundingHorizonHours,
      borrowAprPct: 0
    });

    expect(metrics.basisBps).toBeCloseTo(100);
    expect(metrics.netLongCarry).toBeLessThan(metrics.basisBps);
  });

  test('decideSide retorna LONG_SPOT_SHORT_PERP quando spread atende o limiar', () => {
    const side = decideSide({
      spot: 100,
      futures: 101,
      cfg: baseCfg,
      fundingRateBpsPer8h: 8,
      borrowAprPct: 0
    });

    expect(side).toBe('LONG_SPOT_SHORT_PERP');
  });

  test('decideSide retorna SHORT_SPOT_LONG_PERP quando reverso esta permitido e atrativo', () => {
    const side = decideSide({
      spot: 101,
      futures: 99.5,
      cfg: { ...baseCfg, spotMarginEnabled: true },
      fundingRateBpsPer8h: -4,
      borrowAprPct: 5
    });

    expect(side).toBe('SHORT_SPOT_LONG_PERP');
  });

  test('decideSide retorna NONE quando thresholds nao sao atendidos', () => {
    const side = decideSide({
      spot: 100,
      futures: 100.1,
      cfg: baseCfg,
      fundingRateBpsPer8h: 0,
      borrowAprPct: 0
    });

    expect(side).toBe('NONE');
  });
});