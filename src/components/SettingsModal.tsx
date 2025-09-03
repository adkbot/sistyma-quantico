import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Key, Settings, Shield, Zap, Brain, AlertTriangle } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [apiKeys, setApiKeys] = useState({
    binanceKey: '',
    binanceSecret: '',
    laevitasKey: '',
  });

  const [tradingParams, setTradingParams] = useState({
    minSpread: 0.15,
    maxPosition: 25000,
    stopLoss: 0.8,
    timeout: 45,
  });

  const [aiSettings, setAiSettings] = useState({
    enabled: true,
    learningRate: 0.01,
    confidence: 85,
    retraining: true,
  });

  const [riskSettings, setRiskSettings] = useState({
    maxDailyLoss: 1000,
    maxConcurrentTrades: 5,
    emergencyStop: true,
  });

  const handleSave = () => {
    // Here you would typically save to localStorage or send to backend
    console.log('Saving settings:', { apiKeys, tradingParams, aiSettings, riskSettings });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto glass-card">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-quantum flex items-center">
            <Settings className="mr-2 h-6 w-6" />
            Configurações do Sistema
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="api" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="api" className="flex items-center">
              <Key className="mr-2 h-4 w-4" />
              APIs
            </TabsTrigger>
            <TabsTrigger value="trading" className="flex items-center">
              <Zap className="mr-2 h-4 w-4" />
              Trading
            </TabsTrigger>
            <TabsTrigger value="ai" className="flex items-center">
              <Brain className="mr-2 h-4 w-4" />
              IA
            </TabsTrigger>
            <TabsTrigger value="risk" className="flex items-center">
              <Shield className="mr-2 h-4 w-4" />
              Risco
            </TabsTrigger>
          </TabsList>

          <TabsContent value="api" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Key className="mr-2 h-5 w-5 text-primary" />
                  Chaves de API
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Suas chaves de API são armazenadas localmente e criptografadas. Nunca compartilhe essas informações.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="binance-key">Binance API Key</Label>
                    <Input
                      id="binance-key"
                      type="password"
                      placeholder="Sua chave da API Binance"
                      value={apiKeys.binanceKey}
                      onChange={(e) => setApiKeys(prev => ({ ...prev, binanceKey: e.target.value }))}
                      className="font-mono"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="binance-secret">Binance Secret Key</Label>
                    <Input
                      id="binance-secret"
                      type="password"
                      placeholder="Sua chave secreta da Binance"
                      value={apiKeys.binanceSecret}
                      onChange={(e) => setApiKeys(prev => ({ ...prev, binanceSecret: e.target.value }))}
                      className="font-mono"
                    />
                  </div>

                  <div>
                    <Label htmlFor="laevitas-key">Laevitas API Key</Label>
                    <Input
                      id="laevitas-key"
                      type="password"
                      placeholder="Sua chave da API Laevitas (GEX)"
                      value={apiKeys.laevitasKey}
                      onChange={(e) => setApiKeys(prev => ({ ...prev, laevitasKey: e.target.value }))}
                      className="font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-4">
                  <Badge variant="outline" className="text-accent">
                    <div className="w-2 h-2 rounded-full bg-accent mr-2" />
                    Conexão Segura
                  </Badge>
                  <Badge variant="outline">
                    Criptografia AES-256
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trading" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Zap className="mr-2 h-5 w-5 text-secondary" />
                  Parâmetros de Trading
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="min-spread">Spread Mínimo (%)</Label>
                    <Input
                      id="min-spread"
                      type="number"
                      step="0.01"
                      value={tradingParams.minSpread}
                      onChange={(e) => setTradingParams(prev => ({ ...prev, minSpread: parseFloat(e.target.value) }))}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Spread mínimo para considerar uma operação
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="max-position">Posição Máxima (USD)</Label>
                    <Input
                      id="max-position"
                      type="number"
                      value={tradingParams.maxPosition}
                      onChange={(e) => setTradingParams(prev => ({ ...prev, maxPosition: parseInt(e.target.value) }))}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Valor máximo por operação
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="stop-loss">Stop Loss (%)</Label>
                    <Input
                      id="stop-loss"
                      type="number"
                      step="0.1"
                      value={tradingParams.stopLoss}
                      onChange={(e) => setTradingParams(prev => ({ ...prev, stopLoss: parseFloat(e.target.value) }))}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Perda máxima por operação
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="timeout">Timeout (segundos)</Label>
                    <Input
                      id="timeout"
                      type="number"
                      value={tradingParams.timeout}
                      onChange={(e) => setTradingParams(prev => ({ ...prev, timeout: parseInt(e.target.value) }))}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Tempo máximo para manter posição
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Brain className="mr-2 h-5 w-5 text-accent" />
                  Configurações de IA
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Habilitar IA</Label>
                    <p className="text-sm text-muted-foreground">
                      Usar aprendizado de máquina para decisões
                    </p>
                  </div>
                  <Switch
                    checked={aiSettings.enabled}
                    onCheckedChange={(checked) => setAiSettings(prev => ({ ...prev, enabled: checked }))}
                  />
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="learning-rate">Taxa de Aprendizado</Label>
                    <Input
                      id="learning-rate"
                      type="number"
                      step="0.001"
                      value={aiSettings.learningRate}
                      onChange={(e) => setAiSettings(prev => ({ ...prev, learningRate: parseFloat(e.target.value) }))}
                      disabled={!aiSettings.enabled}
                    />
                  </div>

                  <div>
                    <Label htmlFor="confidence">Confiança Mínima (%)</Label>
                    <Input
                      id="confidence"
                      type="number"
                      value={aiSettings.confidence}
                      onChange={(e) => setAiSettings(prev => ({ ...prev, confidence: parseInt(e.target.value) }))}
                      disabled={!aiSettings.enabled}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Re-treinamento Automático</Label>
                    <p className="text-sm text-muted-foreground">
                      Atualizar modelo automaticamente
                    </p>
                  </div>
                  <Switch
                    checked={aiSettings.retraining}
                    onCheckedChange={(checked) => setAiSettings(prev => ({ ...prev, retraining: checked }))}
                    disabled={!aiSettings.enabled}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="risk" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="mr-2 h-5 w-5 text-destructive" />
                  Gestão de Risco
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Configurações de segurança para proteger seu capital.
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="max-daily-loss">Perda Máxima Diária (USD)</Label>
                    <Input
                      id="max-daily-loss"
                      type="number"
                      value={riskSettings.maxDailyLoss}
                      onChange={(e) => setRiskSettings(prev => ({ ...prev, maxDailyLoss: parseInt(e.target.value) }))}
                    />
                  </div>

                  <div>
                    <Label htmlFor="max-concurrent">Trades Simultâneos Máximo</Label>
                    <Input
                      id="max-concurrent"
                      type="number"
                      value={riskSettings.maxConcurrentTrades}
                      onChange={(e) => setRiskSettings(prev => ({ ...prev, maxConcurrentTrades: parseInt(e.target.value) }))}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Parada de Emergência</Label>
                    <p className="text-sm text-muted-foreground">
                      Parar automaticamente em situações extremas
                    </p>
                  </div>
                  <Switch
                    checked={riskSettings.emergencyStop}
                    onCheckedChange={(checked) => setRiskSettings(prev => ({ ...prev, emergencyStop: checked }))}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end space-x-4 pt-6">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} className="btn-quantum">
            Salvar Configurações
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsModal;