import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Brain, Cpu, Activity, Target, Zap, TrendingUp } from "lucide-react";

interface AIPanelProps {
  aiStatus: 'learning' | 'optimizing' | 'predicting' | 'idle';
  confidence: number;
  learningProgress: number;
  predictions: {
    accuracy: number;
    totalPredictions: number;
    successRate: number;
  };
}

const AIPanel: React.FC<AIPanelProps> = ({
  aiStatus,
  confidence,
  learningProgress,
  predictions,
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'learning': return 'bg-primary';
      case 'optimizing': return 'bg-secondary';
      case 'predicting': return 'bg-accent';
      default: return 'bg-muted-foreground';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'learning': return 'Aprendendo';
      case 'optimizing': return 'Otimizando';
      case 'predicting': return 'Prevendo';
      default: return 'Inativo';
    }
  };

  return (
    <section className="py-16 px-6 bg-gradient-to-br from-background to-muted/20">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4 text-neural">
            Módulo de Inteligência Artificial
          </h2>
          <p className="text-lg text-muted-foreground">
            Sistema de aprendizado adaptativo em tempo real
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* AI Status and Control */}
          <div className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Brain className="h-5 w-5 text-primary" />
                  <span>Estado da IA</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(aiStatus)} animate-pulse`} />
                    <span className="text-lg font-medium">{getStatusText(aiStatus)}</span>
                  </div>
                  <Badge variant="outline" className="text-neural">
                    {confidence}% Confiança
                  </Badge>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Progresso de Aprendizado</span>
                      <span>{learningProgress}%</span>
                    </div>
                    <Progress value={learningProgress} className="h-2" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <div className="text-center p-3 rounded-lg bg-muted/30">
                      <div className="text-2xl font-bold text-primary">
                        {predictions.totalPredictions.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Predições Totais
                      </div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/30">
                      <div className="text-2xl font-bold text-accent">
                        {predictions.successRate.toFixed(1)}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Taxa de Sucesso
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Cpu className="h-5 w-5 text-secondary" />
                  <span>Parâmetros Adaptativos</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Spread Mínimo</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-mono">0.15%</span>
                      <TrendingUp className="h-3 w-3 text-accent" />
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Tamanho da Posição</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-mono">$25,000</span>
                      <Activity className="h-3 w-3 text-primary" />
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Timeout de Posição</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-mono">45s</span>
                      <Zap className="h-3 w-3 text-secondary" />
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Stop Loss</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-mono">-0.8%</span>
                      <Target className="h-3 w-3 text-destructive" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Neural Network Visualization */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5 text-accent" />
                <span>Rede Neural em Ação</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div className="relative">
                {/* Input Layer */}
                <div className="flex justify-between mb-8">
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-2">Entradas</div>
                    {['Preço', 'Volume', 'Spread', 'GEX', 'Wyckoff'].map((input, i) => (
                      <div
                        key={input}
                        className="w-12 h-12 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center mb-2 text-xs"
                        style={{
                          animation: `quantum-pulse ${1.5 + i * 0.2}s infinite`,
                        }}
                      >
                        {input.slice(0, 3)}
                      </div>
                    ))}
                  </div>

                  {/* Hidden Layers */}
                  <div className="flex space-x-8">
                    {[1, 2].map((layer) => (
                      <div key={layer} className="text-center">
                        <div className="text-xs text-muted-foreground mb-2">Camada {layer}</div>
                        {[...Array(4)].map((_, i) => (
                          <div
                            key={i}
                            className="w-10 h-10 rounded-full bg-secondary/20 border-2 border-secondary flex items-center justify-center mb-2"
                            style={{
                              animation: `quantum-pulse ${2 + i * 0.3}s infinite`,
                              animationDelay: `${layer * 0.5 + i * 0.1}s`,
                            }}
                          />
                        ))}
                      </div>
                    ))}
                  </div>

                  {/* Output Layer */}
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-2">Decisão</div>
                    <div className="w-16 h-16 rounded-full bg-accent/20 border-2 border-accent flex items-center justify-center text-xs font-bold">
                      {aiStatus === 'predicting' ? 'TRADE' : 'WAIT'}
                    </div>
                  </div>
                </div>

                {/* Performance Metrics */}
                <div className="grid grid-cols-2 gap-4 mt-8">
                  <div className="text-center p-4 rounded-lg bg-muted/20">
                    <div className="text-lg font-bold text-primary">
                      {predictions.accuracy.toFixed(1)}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Precisão do Modelo
                    </div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/20">
                    <div className="text-lg font-bold text-secondary">
                      12.3s
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Tempo de Resposta
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default AIPanel;