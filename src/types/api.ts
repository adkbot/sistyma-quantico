// src/types/api.ts

export interface ApiBotBalance {
  asset: string;
  spot_balance: number;
  futures_balance: number;
  total_balance: number;
}

export interface ApiBotTrade {
  id: string;
  timestamp: string;
  pair: string;
  type: 'LONG_SPOT_SHORT_PERP' | 'SHORT_SPOT_LONG_PERP';
  direction: 'LONG_SPOT_SHORT_PERP' | 'SHORT_SPOT_LONG_PERP';
  spread: number;
  entryPrice: number;
  exitPrice: number;
  volume: number;
  pnl: number;
  fees: number;
  slippage: number;
  duration: number;
  aiConfidence: number;
}

export interface ApiBotMetrics {
  total_pnl: number;
  daily_pnl: number;
  total_trades: number;
  success_rate: number;
  avg_latency: number;
  active_pairs: number;
  ai_confidence: number;
}

export interface ApiBotStatus {
  running: boolean;
  tradingPair: string;
  pollIntervalMs: number;
  lastCycleAt: string | null;
  lastTradeAt: string | null;
  lastMessage?: string;
  lastError?: {
    message: string;
    timestamp: string;
  };
}

export interface ApiBotSnapshot {
  balances: ApiBotBalance[];
  trades: ApiBotTrade[];
  metrics: ApiBotMetrics;
  status: ApiBotStatus;
}

export interface ApiKeysSettings {
  configured: boolean;
  testnet: boolean;
  lastUpdatedAt: string | null;
  mode: 'spot' | 'futures';
  apiKeyMask: string;
}

export interface ApiTradingParamsSettings {
  minSpread: number;
  maxPosition: number;
  stopLoss: number;
  timeout: number;
}

export interface ApiAiSettings {
  enabled: boolean;
  learningRate: number;
  confidence: number;
  retraining: boolean;
}

export interface ApiRiskSettings {
  maxDailyLoss: number;
  maxConcurrentTrades: number;
  emergencyStop: boolean;
}

export interface ApiSettingsState {
  apiKeys: ApiKeysSettings;
  tradingParams: ApiTradingParamsSettings;
  aiSettings: ApiAiSettings;
  riskSettings: ApiRiskSettings;
}

export interface ApiSettingsUpdate {
  tradingParams?: Partial<ApiTradingParamsSettings>;
  aiSettings?: Partial<ApiAiSettings>;
  riskSettings?: Partial<ApiRiskSettings>;
}









