// src/engine/arbDecision.ts

import type { FeesBpsConfig, Side } from '@/shared/types';

interface ComputeNetEdgeParams {
  spot: number;
  futures: number;
  feesBps: FeesBpsConfig;
  slippageBpsPerLeg: number;
  considerFunding: boolean;
  fundingRateBpsPer8h: number;
  fundingHorizonHours: number;
  borrowAprPct: number;
}

export interface ComputeNetEdgeResult {
  basisBps: number;
  fundingBps: number;
  borrowBps: number;
  netLongCarry: number;
  netReverseCarry: number;
}

interface DecideSideParams {
  spot: number;
  futures: number;
  cfg: {
    feesBps: FeesBpsConfig;
    slippageBpsPerLeg: number;
    considerFunding: boolean;
    fundingHorizonHours: number;
    minSpreadBpsLongCarry: number;
    minSpreadBpsReverse: number;
    allowReverse: boolean;
    spotMarginEnabled: boolean;
    maxBorrowAprPct: number;
  };
  fundingRateBpsPer8h: number;
  borrowAprPct: number;
}

const HOURS_PER_YEAR = 24 * 365;

export function bps(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return value * 10000;
}

function sanitizeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function computeNetEdgeBps(params: ComputeNetEdgeParams): ComputeNetEdgeResult {
  const spot = sanitizeNumber(params.spot);
  const futures = sanitizeNumber(params.futures);
  const fundingHorizonHours = Math.max(0, sanitizeNumber(params.fundingHorizonHours));
  const fundingRateBpsPer8h = sanitizeNumber(params.fundingRateBpsPer8h);
  const borrowAprPct = Math.max(0, sanitizeNumber(params.borrowAprPct));

  if (spot <= 0) {
    return { basisBps: 0, fundingBps: 0, borrowBps: 0, netLongCarry: 0, netReverseCarry: 0 };
  }

  const basisBps = bps((futures - spot) / spot);
  const feesBps = sanitizeNumber(params.feesBps?.spotTaker) + sanitizeNumber(params.feesBps?.futuresTaker);
  const slippageBps = sanitizeNumber(params.slippageBpsPerLeg) * 2;
  const considerFunding = Boolean(params.considerFunding);
  const fundingMultiplier = fundingHorizonHours / 8;
  const fundingBps = considerFunding ? fundingRateBpsPer8h * fundingMultiplier : 0;
  const borrowBps = borrowAprPct > 0
    ? borrowAprPct * 100 * (fundingHorizonHours / HOURS_PER_YEAR)
    : 0;

  const netLongCarry = basisBps - feesBps - slippageBps + fundingBps;
  const netReverseCarry = -basisBps - feesBps - slippageBps - borrowBps - fundingBps;

  return { basisBps, fundingBps, borrowBps, netLongCarry, netReverseCarry };
}

export function decideSide(params: DecideSideParams): Side {
  const spot = sanitizeNumber(params.spot);
  const futures = sanitizeNumber(params.futures);
  const borrowAprPct = Math.max(0, sanitizeNumber(params.borrowAprPct));

  if (spot <= 0 || futures <= 0) {
    return 'NONE';
  }

  const metrics = computeNetEdgeBps({
    spot,
    futures,
    feesBps: params.cfg.feesBps,
    slippageBpsPerLeg: params.cfg.slippageBpsPerLeg,
    considerFunding: params.cfg.considerFunding,
    fundingRateBpsPer8h: params.fundingRateBpsPer8h,
    fundingHorizonHours: params.cfg.fundingHorizonHours,
    borrowAprPct
  });

  if (futures > spot && metrics.netLongCarry >= params.cfg.minSpreadBpsLongCarry) {
    return 'LONG_SPOT_SHORT_PERP';
  }

  const reverseAllowed =
    futures < spot &&
    params.cfg.allowReverse &&
    params.cfg.spotMarginEnabled &&
    borrowAprPct <= params.cfg.maxBorrowAprPct &&
    metrics.netReverseCarry >= params.cfg.minSpreadBpsReverse;

  if (reverseAllowed) {
    return 'SHORT_SPOT_LONG_PERP';
  }

  return 'NONE';
}