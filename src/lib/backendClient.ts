// src/lib/backendClient.ts

import type { ApiBotSnapshot, ApiSettingsState, ApiSettingsUpdate } from '@/types/api';

const API_BASE = import.meta.env.VITE_BACKEND_URL ?? import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

interface RequestOptions extends RequestInit {
  parse?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { parse = true, ...init } = options;
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request to ${path} failed with status ${response.status}`);
  }

  if (!parse) {
    return undefined as unknown as T;
  }

  return (await response.json()) as T;
}

export const backendClient = {
  async getState(): Promise<ApiBotSnapshot> {
    const data = await request<{ snapshot: ApiBotSnapshot }>('/api/state');
    return data.snapshot;
  },

  startBot(options: Record<string, unknown> = {}): Promise<ApiBotSnapshot> {
    return request<{ snapshot: ApiBotSnapshot }>('/api/bot/start', {
      method: 'POST',
      body: JSON.stringify(options),
    }).then((data) => data.snapshot);
  },

  stopBot(): Promise<ApiBotSnapshot> {
    return request<{ snapshot: ApiBotSnapshot }>('/api/bot/stop', {
      method: 'POST',
    }).then((data) => data.snapshot);
  },

  sync(): Promise<ApiBotSnapshot> {
    return request<{ snapshot: ApiBotSnapshot }>('/api/sync', {
      method: 'POST',
    }).then((data) => data.snapshot);
  },

  getConfig(): Promise<{ config: Record<string, unknown> }> {
    return request('/api/config');
  },

  updateConfig(config: Record<string, unknown>): Promise<{ config: Record<string, unknown> }> {
    return request('/api/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  },

  getSettings(): Promise<ApiSettingsState> {
    return request<{ settings: ApiSettingsState }>('/api/settings').then((data) => data.settings);
  },

  updateSettings(payload: ApiSettingsUpdate): Promise<ApiSettingsState> {
    return request<{ settings: ApiSettingsState }>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }).then((data) => data.settings);
  },

  manageApiKeys(action: 'get' | 'save' | 'delete', payload?: { apiKey?: string; apiSecret?: string; testnet?: boolean }): Promise<ApiSettingsState> {
    return request<{ settings: ApiSettingsState }>('/api/settings/api-keys', {
      method: 'POST',
      body: JSON.stringify({ action, ...payload }),
    }).then((data) => data.settings);
  },

  getSystemStatus(): Promise<{
    status: {
      binanceConnection: 'connected' | 'disconnected' | 'error';
      regionalStatus: 'full' | 'partial' | 'restricted';
      websocketStatus: 'connected' | 'disconnected';
      apiKeys: 'configured' | 'missing' | 'invalid';
      region: string;
      restrictions: string[];
      connectivity: boolean;
    };
  }> {
    return request('/api/system/status');
  },

  createEventSource(): EventSource {
    return new EventSource(`${API_BASE}/api/stream`);
  },
};









