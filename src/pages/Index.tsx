import React, { useMemo, useState, useCallback, useEffect } from 'react';
import HeroSection from '@/components/HeroSection';
import Dashboard from '@/components/Dashboard';
import AIPanel from '@/components/AIPanel';
import TradeHistory from '@/components/TradeHistory';
import SettingsModal from '@/components/SettingsModal';
import RealTimeBalances from '@/components/RealTimeBalances';
import SystemStatusPanel from '@/components/SystemStatusPanel';
import { useRealTimeData } from '@/hooks/useRealTimeData';
import { backendClient } from '@/lib/backendClient';
import { toast as notifyToast } from '@/components/ui/sonner';

const Index = () => {
  const [showSettings, setShowSettings] = useState(false);
  const [aiEnabled, setAiEnabled] = useState<boolean>(false);

  const {
    balances,
    trades,
    metrics,
    status,
    isLoading,
    error,
    syncWithBinance,
    startBot,
    stopBot,
  } = useRealTimeData();

  // Notificação quando uma arbitragem é executada (novo trade)
  const [prevTradesCount, setPrevTradesCount] = useState(0);
  useEffect(() => {
    if (trades.length > prevTradesCount) {
      const latest = trades[0];
      const directionLabel = latest.type === 'spot-futures' ? 'Spot → Futuros' : 'Futuros → Spot';
      const pnlStr = `${latest.pnl.toFixed(2)} USDT`;
      const volStr = `${latest.volume.toFixed(2)} USDT`;

      notifyToast.success('Arbitragem executada', {
        description: `${latest.pair} • ${directionLabel} • PnL: ${pnlStr} • Volume: ${volStr}`,
      });

      // Tentativa de notificação do sistema (se permitido)
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          try {
            new Notification('Arbitragem executada', {
              body: `${latest.pair} • ${directionLabel} • PnL: ${pnlStr}`,
            });
          } catch (_) {
            // silencioso
          }
        } else if (Notification.permission === 'default') {
          // Solicitar permissão uma única vez quando ocorrer o primeiro trade
          Notification.requestPermission().then((perm) => {
            if (perm === 'granted') {
              try {
                new Notification('Arbitragem executada', {
                  body: `${latest.pair} • ${directionLabel} • PnL: ${pnlStr}`,
                });
              } catch (_) {
                // silencioso
              }
            }
          }).catch(() => {
            // silencioso
          });
        }
      }

      setPrevTradesCount(trades.length);
    } else if (trades.length !== prevTradesCount) {
      setPrevTradesCount(trades.length);
    }
  }, [trades, prevTradesCount]);

  // Load AI settings initially so AIPanel reflects the toggle state
  useEffect(() => {
    backendClient
      .getSettings()
      .then((settings) => {
        setAiEnabled(Boolean(settings?.aiSettings?.enabled));
      })
      .catch((err) => {
        console.error('Erro ao carregar configurações de IA', err);
      });
  }, []);

  const isRunning = status.running;

  const aiData = useMemo(() => {
    const learningProgress = Math.min(100, Math.round(metrics.success_rate));
    // Estado da IA agora respeita a configuração "IA Ativa" e o status do bot
    const aiStatus = (() => {
      if (!aiEnabled) return 'idle' as const;
      if (isRunning && (metrics.total_trades > 0 || metrics.success_rate > 0)) return 'optimizing' as const;
      if (isRunning) return 'learning' as const;
      return 'idle' as const;
    })();

    return {
      aiStatus,
      confidence: Number(metrics.ai_confidence.toFixed(2)),
      learningProgress,
      predictions: {
        accuracy: Number(metrics.ai_confidence.toFixed(2)),
        totalPredictions: metrics.total_trades,
        successRate: Number(metrics.success_rate.toFixed(2)),
      },
    };
  }, [metrics, aiEnabled, isRunning]);

  const handleToggleBot = useCallback(() => {
    if (isRunning) {
      stopBot().catch((err) => {
        console.error('Erro ao pausar o bot', err);
      });
    } else {
      startBot().catch((err) => {
        console.error('Erro ao iniciar o bot', err);
      });
    }
  }, [isRunning, startBot, stopBot]);

  const handleStopBot = useCallback(() => {
    stopBot().catch((err) => {
      console.error('Erro ao parar o bot', err);
    });
  }, [stopBot]);

  const handleOpenSettings = () => {
    setShowSettings(true);
  };

  // Notificar quando o sistema encontrar uma oportunidade (antes da execução)
  const [prevLastMessage, setPrevLastMessage] = useState<string | null>(null);
  useEffect(() => {
    const msg = status.lastMessage as string | undefined;
    if (msg && msg !== prevLastMessage && msg.toLowerCase().includes('oportunidade')) {
      notifyToast('Oportunidade encontrada', {
        description: msg,
      });
      setPrevLastMessage(msg);
    } else if (msg && msg !== prevLastMessage) {
      setPrevLastMessage(msg);
    }
  }, [status.lastMessage, prevLastMessage]);

  return (
    <div className="min-h-screen bg-background">
      <HeroSection
        isRunning={isRunning}
        onToggleBot={handleToggleBot}
        onStopBot={handleStopBot}
        onOpenSettings={handleOpenSettings}
      />

      <Dashboard
        isRunning={isRunning}
        pnl={metrics.total_pnl}
        latency={metrics.avg_latency}
        activePairs={metrics.active_pairs}
        totalTrades={metrics.total_trades}
        aiConfidence={metrics.ai_confidence}
      />

      <div className="container mx-auto px-6 py-8">
        <SystemStatusPanel isRunning={isRunning} />
      </div>

      <RealTimeBalances
        balances={balances}
        isLoading={isLoading}
        error={error}
        onSync={syncWithBinance}
      />

      <AIPanel
        aiStatus={aiData.aiStatus}
        confidence={aiData.confidence}
        learningProgress={aiData.learningProgress}
        predictions={aiData.predictions}
      />

      <TradeHistory trades={trades} />

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        // Atualiza o estado local quando o usuário alterna "IA Ativa" no modal
        onAiEnabledChange={(enabled) => setAiEnabled(Boolean(enabled))}
      />
    </div>
  );
};

export default Index;

