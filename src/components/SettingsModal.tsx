import React, { useEffect, useState } from 'react';
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
import { backendClient } from "@/lib/backendClient";
import { getKeysState, saveKeys } from "@/api/client";
import { useToast } from "@/hooks/use-toast";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ApiKeyState {
  binanceKey: string;
  binanceSecret: string;
  mode: 'spot' | 'futures';
  testnet: boolean;
  configured: boolean;
  apiKeyMask: string;
  updatedAt: string | null;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { toast } = useToast();
  const [apiKeys, setApiKeys] = useState<ApiKeyState>({
    binanceKey: "",
    binanceSecret: "",
    mode: 'futures',
    testnet: false,
    configured: false,
    apiKeyMask: '',
    updatedAt: null,
  });
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [savingKeys, setSavingKeys] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

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

  useEffect(() => {

    if (!isOpen) {

      return;

    }



    let isMounted = true;

    setLoadingKeys(true);

    setApiError(null);



    (async () => {

      try {

        const [settingsResult, keysResult] = await Promise.allSettled([

          backendClient.getSettings(),

          getKeysState(),

        ]);



        if (!isMounted) {

          return;

        }



        if (settingsResult.status === 'fulfilled') {

          const settings = settingsResult.value;

          setTradingParams(settings.tradingParams);

          setAiSettings(settings.aiSettings);

          setRiskSettings(settings.riskSettings);

        } else {

          const message =

            (settingsResult.reason as Error)?.message ?? 'Erro ao carregar configuracoes.';

          setApiError(message);

        }



        if (keysResult.status === 'fulfilled') {

          const state = keysResult.value;

          setApiKeys((prev) => ({

            ...prev,

            configured: Boolean(state?.configured),

            mode: state?.mode === 'spot' ? 'spot' : 'futures',

            testnet: Boolean(state?.testnet),

            apiKeyMask: state?.apiKeyMask ?? '',

            updatedAt: state?.updatedAt ?? null,

            binanceKey: '',

            binanceSecret: '',

          }));

        } else if (keysResult.status === 'rejected') {

          console.error('Erro ao carregar estado das chaves', keysResult.reason);

        }

      } catch (error) {

        if (!isMounted) {

          return;

        }

        setApiError((error as Error)?.message ?? 'Erro ao carregar configuracoes.');

      } finally {

        if (isMounted) {

          setLoadingKeys(false);

        }

      }

    })();



    return () => {

      isMounted = false;

    };

  }, [isOpen]);



  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handler = setTimeout(() => {
      backendClient
        .updateSettings({
          tradingParams,
          aiSettings,
          riskSettings,
        })
        .catch((err) => {
          console.error('Erro ao salvar configurações', err);
        });
    }, 500);

    return () => clearTimeout(handler);
  }, [aiSettings, riskSettings, tradingParams, isOpen]);

  const handleSaveKeys = async () => {
    setApiError(null);
    if (!apiKeys.binanceKey || !apiKeys.binanceSecret) {
      setApiError('Informe sua API Key e Secret Key da Binance.');
      return;
    }

    setSavingKeys(true);
    try {
      const result = await saveKeys({
        apiKey: apiKeys.binanceKey.trim(),
        apiSecret: apiKeys.binanceSecret.trim(),
        testnet: apiKeys.testnet,
        mode: apiKeys.mode,
      });

      const state = result?.state;

      toast({
        title: 'Chaves atualizadas',
        description: 'Integracao com a Binance configurada com sucesso.',
      });

      setApiKeys((prev) => ({
        ...prev,
        configured: Boolean(state?.configured),
        mode: state?.mode === 'spot' ? 'spot' : 'futures',
        testnet: Boolean(state?.testnet ?? prev.testnet),
        apiKeyMask: state?.apiKeyMask ?? '',
        updatedAt: state?.updatedAt ?? null,
        binanceKey: '',
        binanceSecret: '',
      }));
    } catch (err) {
      const message = (err as Error)?.message ?? 'Erro inesperado ao salvar chaves.';
      setApiError(message);
      toast({
        title: 'Erro ao salvar chaves',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSavingKeys(false);
    }
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
                    Armazenamos suas chaves da Binance localmente no servidor (.env). Elas são usadas apenas para sincronizar
                    saldos e enviar ordens autorizadas por você.
                  </AlertDescription>
                </Alert>

                {apiError && (
                  <Alert className="border-destructive text-destructive">
                    <AlertDescription>{apiError}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="binance-key">Binance API Key</Label>
                    <Input
                      id="binance-key"
                      type="password"
                      placeholder={apiKeys.apiKeyMask ? `Chave configurada (${apiKeys.apiKeyMask})` : "Sua chave da API Binance"}
                      value={apiKeys.binanceKey}
                      onChange={(e) => setApiKeys((prev) => ({ ...prev, binanceKey: e.target.value }))}
                      disabled={loadingKeys || savingKeys}
                      className="font-mono"
                    />
                  </div>

                  <div>
                    <Label htmlFor="binance-secret">Binance Secret Key</Label>
                    <Input
                      id="binance-secret"
                      type="password"
                      placeholder={apiKeys.apiKeyMask ? "Chave secreta armazenada" : "Sua chave secreta da Binance"}
                      value={apiKeys.binanceSecret}
                      onChange={(e) => setApiKeys((prev) => ({ ...prev, binanceSecret: e.target.value }))}
                      disabled={loadingKeys || savingKeys}
                      className="font-mono"
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-md border p-4">
                    <div>
                      <p className="font-medium">Modo Testnet</p>
                      <p className="text-sm text-muted-foreground">
                        Ative para operar na Binance Testnet. Desative para operar com saldo real.
                      </p>
                    </div>
                    <Switch
                      checked={apiKeys.testnet}
                      disabled={loadingKeys || savingKeys}
                      onCheckedChange={(checked) => setApiKeys((prev) => ({ ...prev, testnet: checked }))}
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-4">
                  <Badge variant="outline" className="text-accent">
                    <div className="w-2 h-2 rounded-full bg-accent mr-2" />
                    {apiKeys.configured ? "Binance conectada" : "Conexao pendente"}
                  </Badge>
                  <Badge variant="outline">Proteção via controle de acesso local</Badge>
                </div>

                <div className="flex justify-end gap-2 pt-6">
                  <Button
                    variant="outline"
                    onClick={onClose}
                    disabled={savingKeys}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSaveKeys}
                    disabled={savingKeys || loadingKeys}
                  >
                    {savingKeys ? "Salvando..." : "Salvar"}
                  </Button>
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
                      onChange={(e) => setTradingParams((prev) => ({ ...prev, minSpread: parseFloat(e.target.value) }))}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Spread mínimo para considerar uma operação.
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="max-position">Posição Máxima (USD)</Label>
                    <Input
                      id="max-position"
                      type="number"
                      value={tradingParams.maxPosition}
                      onChange={(e) => setTradingParams((prev) => ({ ...prev, maxPosition: parseInt(e.target.value || "0", 10) }))}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Valor máximo por operação.
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="stop-loss">Stop Loss (%)</Label>
                    <Input
                      id="stop-loss"
                      type="number"
                      step="0.1"
                      value={tradingParams.stopLoss}
                      onChange={(e) => setTradingParams((prev) => ({ ...prev, stopLoss: parseFloat(e.target.value) }))}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Perda máxima aceitável por operação.
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="timeout">Timeout de Posição (s)</Label>
                    <Input
                      id="timeout"
                      type="number"
                      value={tradingParams.timeout}
                      onChange={(e) => setTradingParams((prev) => ({ ...prev, timeout: parseInt(e.target.value || "0", 10) }))}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Tempo máximo de exposição por operação.
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
                  <Brain className="mr-2 h-5 w-5 text-primary" />
                  Parâmetros de IA
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">IA Ativa</p>
                    <p className="text-sm text-muted-foreground">
                      Permite que o motor de IA ajuste dinamicamente estratégias.
                    </p>
                  </div>
                  <Switch
                    checked={aiSettings.enabled}
                    onCheckedChange={(checked) => setAiSettings((prev) => ({ ...prev, enabled: checked }))}
                  />
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="learning-rate">Learning Rate</Label>
                    <Input
                      id="learning-rate"
                      type="number"
                      step="0.001"
                      value={aiSettings.learningRate}
                      onChange={(e) => setAiSettings((prev) => ({ ...prev, learningRate: parseFloat(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="confidence">Confiança mínima (%)</Label>
                    <Input
                      id="confidence"
                      type="number"
                      value={aiSettings.confidence}
                      onChange={(e) => setAiSettings((prev) => ({ ...prev, confidence: parseInt(e.target.value || "0", 10) }))}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-md border p-4">
                  <div>
                    <p className="font-medium">Re-treinamento automático</p>
                    <p className="text-sm text-muted-foreground">
                      Atualiza o modelo sempre que novos dados suficientes forem coletados.
                    </p>
                  </div>
                  <Switch
                    checked={aiSettings.retraining}
                    onCheckedChange={(checked) => setAiSettings((prev) => ({ ...prev, retraining: checked }))}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="risk" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="mr-2 h-5 w-5 text-secondary" />
                  Gestão de Risco
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="max-daily-loss">Perda diária máxima (USD)</Label>
                    <Input
                      id="max-daily-loss"
                      type="number"
                      value={riskSettings.maxDailyLoss}
                      onChange={(e) => setRiskSettings((prev) => ({ ...prev, maxDailyLoss: parseInt(e.target.value || "0", 10) }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="max-concurrent">Trades simultâneos</Label>
                    <Input
                      id="max-concurrent"
                      type="number"
                      value={riskSettings.maxConcurrentTrades}
                      onChange={(e) => setRiskSettings((prev) => ({ ...prev, maxConcurrentTrades: parseInt(e.target.value || "0", 10) }))}
                    />
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between rounded-md border p-4">
                  <div>
                    <p className="font-medium">Emergência</p>
                    <p className="text-sm text-muted-foreground">Desativa o sistema se os limites forem violados.</p>
                  </div>
                  <Switch
                    checked={riskSettings.emergencyStop}
                    onCheckedChange={(checked) => setRiskSettings((prev) => ({ ...prev, emergencyStop: checked }))}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsModal;





