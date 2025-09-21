// src/state/settingsStore.ts

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type {
  ApiAiSettings,
  ApiKeysSettings,
  ApiRiskSettings,
  ApiSettingsState,
  ApiTradingParamsSettings,
} from '../types/api';

export type SettingsState = ApiSettingsState;
export type TradingParamsSettings = ApiTradingParamsSettings;
export type AiSettings = ApiAiSettings;
export type RiskSettings = ApiRiskSettings;
export type ApiKeySettings = ApiKeysSettings;

interface SettingsFileSchema {
  tradingParams: TradingParamsSettings;
  aiSettings: AiSettings;
  riskSettings: RiskSettings;
  apiKeys?: {
    configured: boolean;
    testnet: boolean;
    lastUpdatedAt?: string | null;
  };
}

const SETTINGS_PATH = new URL('../settings.json', import.meta.url);
const ENV_PATH = new URL('../.env', import.meta.url);

const DEFAULT_SETTINGS: SettingsState = {
  apiKeys: {
    configured: Boolean(process.env.API_KEY && process.env.SECRET_KEY),
    testnet: process.env.BINANCE_TESTNET === 'true',
    lastUpdatedAt: null,
  },
  tradingParams: {
    minSpread: 0.15,
    maxPosition: 25000,
    stopLoss: 0.8,
    timeout: 45,
  },
  aiSettings: {
    enabled: true,
    learningRate: 0.01,
    confidence: 85,
    retraining: true,
  },
  riskSettings: {
    maxDailyLoss: 1000,
    maxConcurrentTrades: 5,
    emergencyStop: true,
  },
};

function readSettingsFile(): SettingsFileSchema {
  if (!existsSync(SETTINGS_PATH)) {
    return {
      tradingParams: DEFAULT_SETTINGS.tradingParams,
      aiSettings: DEFAULT_SETTINGS.aiSettings,
      riskSettings: DEFAULT_SETTINGS.riskSettings,
      apiKeys: {
        configured: DEFAULT_SETTINGS.apiKeys.configured,
        testnet: DEFAULT_SETTINGS.apiKeys.testnet,
        lastUpdatedAt: DEFAULT_SETTINGS.apiKeys.lastUpdatedAt,
      },
    };
  }

  try {
    const raw = readFileSync(SETTINGS_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<SettingsFileSchema>;

    return {
      tradingParams: {
        ...DEFAULT_SETTINGS.tradingParams,
        ...(parsed?.tradingParams ?? {}),
      },
      aiSettings: {
        ...DEFAULT_SETTINGS.aiSettings,
        ...(parsed?.aiSettings ?? {}),
      },
      riskSettings: {
        ...DEFAULT_SETTINGS.riskSettings,
        ...(parsed?.riskSettings ?? {}),
      },
      apiKeys: parsed?.apiKeys ?? undefined,
    };
  } catch (error) {
    return {
      tradingParams: DEFAULT_SETTINGS.tradingParams,
      aiSettings: DEFAULT_SETTINGS.aiSettings,
      riskSettings: DEFAULT_SETTINGS.riskSettings,
      apiKeys: {
        configured: DEFAULT_SETTINGS.apiKeys.configured,
        testnet: DEFAULT_SETTINGS.apiKeys.testnet,
        lastUpdatedAt: DEFAULT_SETTINGS.apiKeys.lastUpdatedAt,
      },
    };
  }
}

function writeSettingsFile(schema: SettingsFileSchema): void {
  const payload = {
    tradingParams: schema.tradingParams,
    aiSettings: schema.aiSettings,
    riskSettings: schema.riskSettings,
    apiKeys: schema.apiKeys,
  } satisfies SettingsFileSchema;

  writeFileSync(SETTINGS_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
}

function readEnvLines(): string[] {
  if (!existsSync(ENV_PATH)) {
    return [
      '# Environment secrets',
    ];
  }

  const raw = readFileSync(ENV_PATH, 'utf-8');
  return raw.split(/\r?\n/);
}

function writeEnvLines(lines: string[]): void {
  const withoutTrailing = [...lines];
  while (withoutTrailing.length > 0 && withoutTrailing[withoutTrailing.length - 1] === '') {
    withoutTrailing.pop();
  }
  const content = `${withoutTrailing.join('\n')}\n`;
  writeFileSync(ENV_PATH, content, 'utf-8');
}

function upsertEnvLine(lines: string[], key: string, value?: string): string[] {
  let updated = false;
  const result: string[] = [];

  for (const line of lines) {
    if (line.startsWith(`${key}=`)) {
      if (value !== undefined) {
        result.push(`${key}=${value}`);
      }
      updated = true;
    } else {
      result.push(line);
    }
  }

  if (!updated && value !== undefined) {
    if (result.length > 0 && result[result.length - 1] !== '') {
      result.push('');
    }
    result.push(`${key}=${value}`);
  }

  return result;
}

function applyEnvUpdates(updates: Record<string, string | undefined>): void {
  let lines = readEnvLines();

  for (const [key, value] of Object.entries(updates)) {
    lines = upsertEnvLine(lines, key, value);

    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  const cleaned: string[] = [];
  for (const line of lines) {
    if (line === '' && cleaned[cleaned.length - 1] === '') {
      continue;
    }
    cleaned.push(line);
  }

  writeEnvLines(cleaned);
}

function normalizeApiKeyState(fileValue: SettingsFileSchema['apiKeys']): ApiKeySettings {
  const configured = Boolean(process.env.API_KEY && process.env.SECRET_KEY);
  const testnetFlag = process.env.BINANCE_TESTNET === 'true';

  return {
    configured,
    testnet: fileValue?.testnet ?? testnetFlag,
    lastUpdatedAt: fileValue?.lastUpdatedAt ?? null,
  };
}

export function getSettings(): SettingsState {
  const fileSettings = readSettingsFile();

  return {
    apiKeys: normalizeApiKeyState(fileSettings.apiKeys),
    tradingParams: fileSettings.tradingParams,
    aiSettings: fileSettings.aiSettings,
    riskSettings: fileSettings.riskSettings,
  };
}

export function updateSettings(partial: Partial<Omit<SettingsState, 'apiKeys'>>): SettingsState {
  const current = readSettingsFile();

  const merged: SettingsFileSchema = {
    tradingParams: {
      ...current.tradingParams,
      ...(partial.tradingParams ?? {}),
    },
    aiSettings: {
      ...current.aiSettings,
      ...(partial.aiSettings ?? {}),
    },
    riskSettings: {
      ...current.riskSettings,
      ...(partial.riskSettings ?? {}),
    },
    apiKeys: current.apiKeys,
  };

  writeSettingsFile(merged);
  return getSettings();
}

export function saveApiKeys(params: { apiKey: string; apiSecret: string; testnet: boolean }): SettingsState {
  applyEnvUpdates({
    API_KEY: params.apiKey,
    SECRET_KEY: params.apiSecret,
    BINANCE_TESTNET: params.testnet ? 'true' : 'false',
  });

  const current = readSettingsFile();
  const updated: SettingsFileSchema = {
    ...current,
    apiKeys: {
      configured: true,
      testnet: params.testnet,
      lastUpdatedAt: new Date().toISOString(),
    },
  };

  writeSettingsFile(updated);
  return getSettings();
}

export function clearApiKeys(): SettingsState {
  applyEnvUpdates({
    API_KEY: undefined,
    SECRET_KEY: undefined,
  });

  const current = readSettingsFile();
  const updated: SettingsFileSchema = {
    ...current,
    apiKeys: {
      configured: false,
      testnet: current.apiKeys?.testnet ?? false,
      lastUpdatedAt: new Date().toISOString(),
    },
  };

  writeSettingsFile(updated);
  return getSettings();
}

