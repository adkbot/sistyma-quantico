import { useState, useEffect, useCallback } from 'react';
import { backendClient } from '@/lib/backendClient';
import type { ApiBotSnapshot } from '@/types/api';

type RealTimeBalance = ApiBotSnapshot['balances'][number];
type RealTimeTrade = ApiBotSnapshot['trades'][number];
const emptySnapshot: ApiBotSnapshot = {
  balances: [],
  trades: [],
  metrics: {
    total_pnl: 0,
    daily_pnl: 0,
    total_trades: 0,
    success_rate: 0,
    avg_latency: 0,
    active_pairs: 0,
    ai_confidence: 0,
  },
  status: {
    running: false,
    tradingPair: 'BTCUSDT',
    pollIntervalMs: 5000,
    lastCycleAt: null,
    lastTradeAt: null,
  },
};

export const useRealTimeData = () => {
  const [snapshot, setSnapshot] = useState<ApiBotSnapshot>(emptySnapshot);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let closed = false;
    let eventSource: EventSource | null = null;

    const loadInitial = async () => {
      setIsLoading(true);
      try {
        const initial = await backendClient.getState();
        if (!closed) {
          setSnapshot(initial);
          setError(null);
        }
      } catch (err) {
        if (!closed) {
          setError((err as Error).message ?? 'Erro ao carregar dados em tempo real.');
        }
      } finally {
        if (!closed) {
          setIsLoading(false);
        }
      }

      if (closed) {
        return;
      }

      eventSource = backendClient.createEventSource();
      eventSource.onmessage = (event) => {
        if (!event?.data) return;
        try {
          const data = JSON.parse(event.data) as ApiBotSnapshot;
          setSnapshot(data);
          setError(null);
        } catch (parseError) {
          console.error('Falha ao interpretar atualiza��o do bot.', parseError);
        }
      };
      eventSource.onerror = () => {
        setError('Conex�o em tempo real perdida. Tentando reconectar...');
      };
    };

    loadInitial();

    return () => {
      closed = true;
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  const startBot = useCallback(async () => {
    try {
      const updated = await backendClient.startBot();
      setSnapshot(updated);
      setError(null);
    } catch (err) {
      setError((err as Error).message ?? 'Erro ao iniciar o bot.');
      throw err;
    }
  }, []);

  const stopBot = useCallback(async () => {
    try {
      const updated = await backendClient.stopBot();
      setSnapshot(updated);
      setError(null);
    } catch (err) {
      setError((err as Error).message ?? 'Erro ao parar o bot.');
      throw err;
    }
  }, []);

  const syncWithBackend = useCallback(async () => {
    try {
      const updated = await backendClient.sync();
      setSnapshot(updated);
      setError(null);
    } catch (err) {
      setError((err as Error).message ?? 'Erro ao sincronizar com a corretora.');
      throw err;
    }
  }, []);

  const refreshData = useCallback(async () => {
    try {
      const updated = await backendClient.getState();
      setSnapshot(updated);
      setError(null);
    } catch (err) {
      setError((err as Error).message ?? 'Erro ao atualizar dados.');
      throw err;
    }
  }, []);

  return {
    balances: snapshot.balances as RealTimeBalance[],
    trades: snapshot.trades as RealTimeTrade[],
    metrics: snapshot.metrics,
    status: snapshot.status,
    isLoading,
    error,
    syncWithBinance: syncWithBackend,
    refreshData,
    startBot,
    stopBot,
  };
};
