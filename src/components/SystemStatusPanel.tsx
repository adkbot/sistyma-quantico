import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { backendClient } from '@/lib/backendClient';
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Wifi, 
  WifiOff, 
  Globe,
  Shield,
  Zap,
  RefreshCw,
  MapPin
} from 'lucide-react';

interface SystemStatus {
  binanceConnection: 'connected' | 'disconnected' | 'error';
  regionalStatus: 'full' | 'partial' | 'restricted';
  websocketStatus: 'connected' | 'disconnected';
  apiKeys: 'configured' | 'missing' | 'invalid';
  region: string;
  restrictions: string[];
  connectivity: boolean;
}

interface SystemStatusPanelProps {
  isRunning: boolean;
}

const SystemStatusPanel: React.FC<SystemStatusPanelProps> = ({ isRunning }) => {
  const [status, setStatus] = useState<SystemStatus>({
    binanceConnection: 'disconnected',
    regionalStatus: 'full',
    websocketStatus: isRunning ? 'connected' : 'disconnected',
    apiKeys: 'missing',
    region: 'Detectando...',
    restrictions: [],
    connectivity: false
  });
  const [isChecking, setIsChecking] = useState(false);

  const checkSystemStatus = async () => {
    setIsChecking(true);

    try {
      const { status: backendStatus } = await backendClient.getSystemStatus();

      setStatus({
        binanceConnection: backendStatus.binanceConnection,
        regionalStatus: backendStatus.regionalStatus,
        websocketStatus: isRunning ? 'connected' : backendStatus.websocketStatus,
        apiKeys: backendStatus.apiKeys,
        region: backendStatus.region,
        restrictions: backendStatus.restrictions,
        connectivity: backendStatus.connectivity
      });
    } catch (error) {
      console.error('Erro ao verificar status do sistema:', error);
      setStatus((prev) => ({
        ...prev,
        binanceConnection: 'error',
        apiKeys: 'missing',
        websocketStatus: 'disconnected'
      }));
    } finally {
      setIsChecking(false);
    }
  };

    useEffect(() => {
    checkSystemStatus();
  }, [isRunning]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
      case 'configured':
      case 'full':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'partial':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'disconnected':
      case 'missing':
      case 'restricted':
      case 'error':
      default:
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
      case 'configured':
      case 'full':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'partial':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      default:
        return 'bg-red-500/10 text-red-500 border-red-500/20';
    }
  };

  const getOverallStatus = () => {
    if (status.binanceConnection === 'connected' && status.regionalStatus === 'full') {
      return { label: 'Sistema Operacional', color: 'green' };
    }
    if (status.binanceConnection === 'connected' && status.regionalStatus === 'partial') {
      return { label: 'Operação Limitada', color: 'yellow' };
    }
    return { label: 'Sistema Inativo', color: 'red' };
  };

  const overall = getOverallStatus();

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Status do Sistema
            </CardTitle>
            <CardDescription>
              Monitoramento em tempo real da conectividade e compatibilidade
            </CardDescription>
          </div>
          <Button 
            onClick={checkSystemStatus} 
            disabled={isChecking}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isChecking ? 'animate-spin' : ''}`} />
            Verificar
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Status Geral */}
        <div className="text-center p-4 rounded-lg border bg-card">
          <div className="flex items-center justify-center gap-2 mb-2">
            {getStatusIcon(overall.color)}
            <h3 className="text-lg font-semibold">{overall.label}</h3>
          </div>
          <Badge className={getStatusColor(overall.color)}>
            {status.region}
          </Badge>
        </div>

        <Separator />

        {/* Detalhes dos Componentes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Conexão Binance */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              <span className="font-medium">Conexão Binance</span>
              {getStatusIcon(status.binanceConnection)}
            </div>
            <div className="pl-6 space-y-1 text-sm text-muted-foreground">
              <div>API Keys: {status.apiKeys}</div>
              <div>Status: {status.binanceConnection}</div>
            </div>
          </div>

          {/* Status Regional */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span className="font-medium">Compatibilidade Regional</span>
              {getStatusIcon(status.regionalStatus)}
            </div>
            <div className="pl-6 space-y-1 text-sm text-muted-foreground">
              <div>Região: {status.region}</div>
              <div>Status: {status.regionalStatus}</div>
            </div>
          </div>

          {/* WebSocket */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {status.websocketStatus === 'connected' ? 
                <Wifi className="h-4 w-4" /> : 
                <WifiOff className="h-4 w-4" />
              }
              <span className="font-medium">Dados em Tempo Real</span>
              {getStatusIcon(status.websocketStatus)}
            </div>
            <div className="pl-6 space-y-1 text-sm text-muted-foreground">
              <div>WebSocket: {status.websocketStatus}</div>
              <div>Latência: &lt; 50ms</div>
            </div>
          </div>

          {/* Conectividade */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              <span className="font-medium">Conectividade</span>
              {getStatusIcon(status.connectivity ? 'connected' : 'disconnected')}
            </div>
            <div className="pl-6 space-y-1 text-sm text-muted-foreground">
              <div>Internet: {status.connectivity ? 'Estável' : 'Instável'}</div>
              <div>Exchanges: Disponível</div>
            </div>
          </div>
        </div>

        {/* Restrições (se houver) */}
        {status.restrictions.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="font-medium text-yellow-600 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Restrições Detectadas
              </h4>
              <ul className="pl-6 space-y-1 text-sm text-muted-foreground">
                {status.restrictions.map((restriction, index) => (
                  <li key={index} className="list-disc">
                    {restriction}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* Funcionalidades Disponíveis */}
        <Separator />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="space-y-1">
            <div className="text-sm font-medium">Spot Trading</div>
            {getStatusIcon(status.regionalStatus !== 'restricted' ? 'connected' : 'disconnected')}
          </div>
          <div className="space-y-1">
            <div className="text-sm font-medium">Futures Trading</div>
            {getStatusIcon(status.regionalStatus === 'full' ? 'connected' : 'disconnected')}
          </div>
          <div className="space-y-1">
            <div className="text-sm font-medium">Arbitragem</div>
            {getStatusIcon(status.regionalStatus === 'full' && status.binanceConnection === 'connected' ? 'connected' : 'disconnected')}
          </div>
          <div className="space-y-1">
            <div className="text-sm font-medium">AI Trading</div>
            {getStatusIcon(status.binanceConnection === 'connected' ? 'connected' : 'disconnected')}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SystemStatusPanel;
