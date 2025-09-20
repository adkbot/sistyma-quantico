import React, { useState } from 'react';
import HeroSection from '@/components/HeroSection';
import Dashboard from '@/components/Dashboard';
import AIPanel from '@/components/AIPanel';
import TradeHistory from '@/components/TradeHistory';
import SettingsModal from '@/components/SettingsModal';
import RealTimeBalances from '@/components/RealTimeBalances';
import SystemStatusPanel from '@/components/SystemStatusPanel';
import { useRealTimeData } from '@/hooks/useRealTimeData';

const Index = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Dados reais em tempo real
  const { trades, metrics, isLoading } = useRealTimeData();

  const [aiData] = useState({
    aiStatus: 'optimizing' as const,
    confidence: metrics.ai_confidence || 0,
    learningProgress: 76,
    predictions: {
      accuracy: 94.2,
      totalPredictions: 15420,
      successRate: metrics.success_rate || 0,
    },
  });

  const handleToggleBot = () => {
    setIsRunning(!isRunning);
  };

  const handleStopBot = () => {
    setIsRunning(false);
  };

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
        <SystemStatusPanel />
      </div>
      
      <RealTimeBalances />
      
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
