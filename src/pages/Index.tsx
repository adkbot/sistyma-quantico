import React, { useMemo, useState, useCallback } from 'react';
import HeroSection from '@/components/HeroSection';
import Dashboard from '@/components/Dashboard';
import AIPanel from '@/components/AIPanel';
import TradeHistory from '@/components/TradeHistory';
import SettingsModal from '@/components/SettingsModal';
import RealTimeBalances from '@/components/RealTimeBalances';
import SystemStatusPanel from '@/components/SystemStatusPanel';
import { useRealTimeData } from '@/hooks/useRealTimeData';

const Index = () => {
  const [showSettings, setShowSettings] = useState(false);

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

  const isRunning = status.running;

  const aiData = useMemo(() => {
    const learningProgress = Math.min(100, Math.round(metrics.success_rate));
    return {
      aiStatus: metrics.success_rate > 0 ? 'optimizing' as const : 'idle' as const,
      confidence: Number(metrics.ai_confidence.toFixed(2)),
      learningProgress,
      predictions: {
        accuracy: Number(metrics.ai_confidence.toFixed(2)),
        totalPredictions: metrics.total_trades,
        successRate: Number(metrics.success_rate.toFixed(2)),
      },
    };
  }, [metrics]);

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
      />
    </div>
  );
};

export default Index;
