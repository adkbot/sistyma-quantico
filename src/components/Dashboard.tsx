import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Zap, Brain, Network, DollarSign } from "lucide-react";

interface DashboardProps {
  isRunning: boolean;
  pnl: number;
  latency: number;
  activePairs: number;
  totalTrades: number;
  aiConfidence: number;
}

const Dashboard: React.FC<DashboardProps> = ({
  isRunning,
  pnl,
  latency,
  activePairs,
  totalTrades,
  aiConfidence,
}) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const getLatencyColor = (ms: number) => {
    if (ms < 10) return 'text-accent';
    if (ms < 20) return 'text-yellow-500';
    return 'text-destructive';
  };

  return (
    <section className="py-16 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4 text-quantum">
            Dashboard Principal
          </h2>
          <p className="text-lg text-muted-foreground">
            Monitoramento em tempo real do sistema de arbitragem
          </p>
        </div>

        {/* Main Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {/* P&L Card */}
          <Card className="glass-card data-stream">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">P&L Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <div className="text-2xl font-bold">
                  {formatCurrency(pnl)}
                </div>
                {pnl >= 0 ? (
                  <TrendingUp className="ml-2 h-4 w-4 text-accent" />
                ) : (
                  <TrendingDown className="ml-2 h-4 w-4 text-destructive" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {pnl >= 0 ? '+' : ''}{((pnl / 10000) * 100).toFixed(2)}% hoje
              </p>
            </CardContent>
          </Card>

          {/* Latency Card */}
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Latência de Rede</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getLatencyColor(latency)}`}>
                {latency}ms
              </div>
              <p className="text-xs text-muted-foreground">
                Round-trip para Binance
              </p>
            </CardContent>
          </Card>

          {/* AI Confidence */}
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Confiança da IA</CardTitle>
              <Brain className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-neural">
                {aiConfidence}%
              </div>
              <div className="w-full bg-muted rounded-full h-2 mt-2">
                <div 
                  className="bg-gradient-to-r from-secondary to-accent h-2 rounded-full transition-all duration-300"
                  style={{ width: `${aiConfidence}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Active Pairs */}
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pares Ativos</CardTitle>
              <Network className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {activePairs}
              </div>
              <p className="text-xs text-muted-foreground">
                Monitorando oportunidades
              </p>
            </CardContent>
          </Card>

          {/* Total Trades */}
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Trades Executados</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totalTrades.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Total desde início
              </p>
            </CardContent>
          </Card>

          {/* System Status */}
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Status do Sistema</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Badge 
                  variant={isRunning ? "default" : "secondary"}
                  className={isRunning ? "bg-accent" : ""}
                >
                  {isRunning ? 'ATIVO' : 'INATIVO'}
                </Badge>
                <div className={`w-2 h-2 rounded-full ${
                  isRunning ? 'bg-accent animate-pulse' : 'bg-muted-foreground'
                }`} />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {isRunning ? 'Todos os sistemas operacionais' : 'Sistema pausado'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Aviso de Dados Reais */}
        <Card className="glass-card border-accent">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-accent animate-pulse" />
              <span>Sistema Operacional - Dados 100% Reais</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Todos os dados exibidos são reais e sincronizados diretamente com a Binance. 
              Não há simulações ou dados fictícios neste sistema.
            </p>
            <div className="mt-4 p-3 rounded-lg bg-accent/10 border border-accent/20">
              <p className="text-xs text-accent font-medium">
                ⚡ Sistema conectado à API oficial da Binance para operações reais
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default Dashboard;