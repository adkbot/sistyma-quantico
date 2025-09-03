import React, { useState } from 'react';
import HeroSection from '@/components/HeroSection';
import Dashboard from '@/components/Dashboard';
import AIPanel from '@/components/AIPanel';
import TradeHistory from '@/components/TradeHistory';
import SettingsModal from '@/components/SettingsModal';

// Mock data for demonstration
const mockTrades = [
  {
    id: '1',
    timestamp: '2024-03-10T14:30:15Z',
    pair: 'BTC/USDT',
    type: 'spot-futures' as const,
    entryPrice: 71250.50,
    exitPrice: 71380.25,
    volume: 15000,
    pnl: 195.75,
    fees: 22.50,
    slippage: 0.025,
    duration: 34,
    aiConfidence: 92,
  },
  {
    id: '2',
    timestamp: '2024-03-10T14:28:42Z',
    pair: 'ETH/USDT',
    type: 'futures-spot' as const,
    entryPrice: 3850.75,
    exitPrice: 3865.20,
    volume: 20000,
    pnl: 285.30,
    fees: 30.00,
    slippage: 0.018,
    duration: 28,
    aiConfidence: 89,
  },
  {
    id: '3',
    timestamp: '2024-03-10T14:25:18Z',
    pair: 'BNB/USDT',
    type: 'spot-futures' as const,
    entryPrice: 580.25,
    exitPrice: 582.15,
    volume: 12000,
    pnl: 156.80,
    fees: 18.00,
    slippage: 0.031,
    duration: 42,
    aiConfidence: 85,
  },
];

const Index = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Mock real-time data
  const [dashboardData] = useState({
    pnl: 2847.65,
    latency: 12,
    activePairs: 8,
    totalTrades: 1247,
    aiConfidence: 88,
  });

  const [aiData] = useState({
    aiStatus: 'optimizing' as const,
    confidence: 88,
    learningProgress: 76,
    predictions: {
      accuracy: 94.2,
      totalPredictions: 15420,
      successRate: 91.8,
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
        pnl={dashboardData.pnl}
        latency={dashboardData.latency}
        activePairs={dashboardData.activePairs}
        totalTrades={dashboardData.totalTrades}
        aiConfidence={dashboardData.aiConfidence}
      />
      
      <AIPanel
        aiStatus={aiData.aiStatus}
        confidence={aiData.confidence}
        learningProgress={aiData.learningProgress}
        predictions={aiData.predictions}
      />
      
      <TradeHistory trades={mockTrades} />
      
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
};

export default Index;
