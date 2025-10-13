// src/shared/types.ts

export type Side = 'LONG_SPOT_SHORT_PERP' | 'SHORT_SPOT_LONG_PERP' | 'NONE';

export interface FeesBpsConfig {
  spotTaker: number;
  futuresTaker: number;
}

export type TradeParams = {
  buyPrice: number;
  sellPrice: number;
  amount: number;
  feePercentage: number;
  spread: number;
  side: Exclude<Side, 'NONE'>;
};

export const __arbTypes = true;

