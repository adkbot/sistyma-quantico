import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wallet, RefreshCw, TrendingUp, DollarSign } from "lucide-react";
import { useRealTimeData } from '@/hooks/useRealTimeData';

const RealTimeBalances: React.FC = () => {
  const { balances, isLoading, error, syncWithBinance } = useRealTimeData();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatCrypto = (value: number, asset: string) => {
    const decimals = ['BTC', 'ETH'].includes(asset) ? 6 : 2;
    return `${value.toFixed(decimals)} ${asset}`;
  };

  const getTotalBalanceUSD = () => {
    // Aqui você pode implementar conversão para USD usando preços atuais
    // Por enquanto, assumindo que os valores já estão em USD para USDT
    return balances
      .filter(b => b.asset === 'USDT')
      .reduce((sum, balance) => sum + balance.total_balance, 0);
  };

  if (error) {
    return (
      <Card className="glass-card border-destructive">
        <CardContent className="p-6">
          <div className="text-center text-destructive">
            <p>Erro ao carregar saldos: {error}</p>
            <Button onClick={syncWithBinance} className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar Novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="py-8 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-bold text-quantum">Saldos da Carteira</h3>
            <p className="text-sm text-muted-foreground">
              Saldos reais sincronizados com a Binance
            </p>
          </div>
          <Button 
            onClick={syncWithBinance} 
            disabled={isLoading}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Sincronizar
          </Button>
        </div>

        {/* Resumo Total */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="glass-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Total (USD)</p>
                  <p className="text-2xl font-bold text-accent">
                    {formatCurrency(getTotalBalanceUSD())}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-accent" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Ativos Ativos</p>
                  <p className="text-2xl font-bold">
                    {balances.length}
                  </p>
                </div>
                <Wallet className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <div className="flex items-center space-x-2">
                    <Badge variant="default" className="bg-accent">
                      CONECTADO
                    </Badge>
                    <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                  </div>
                </div>
                <TrendingUp className="h-8 w-8 text-secondary" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Saldos por Asset */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {balances.length === 0 && !isLoading ? (
            <Card className="glass-card col-span-full">
              <CardContent className="p-8 text-center">
                <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Nenhum saldo encontrado</h3>
                <p className="text-muted-foreground mb-4">
                  Conecte sua conta Binance para ver os saldos reais
                </p>
                <Button onClick={syncWithBinance}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sincronizar Agora
                </Button>
              </CardContent>
            </Card>
          ) : (
            balances.map((balance) => (
              <Card key={balance.asset} className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>{balance.asset}</span>
                    <Badge variant="outline" className="text-xs">
                      {balance.spot_balance > 0 && balance.futures_balance > 0 
                        ? 'SPOT+FUTURES' 
                        : balance.spot_balance > 0 
                        ? 'SPOT' 
                        : 'FUTURES'
                      }
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {balance.spot_balance > 0 && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Spot:</span>
                        <span className="font-mono text-sm">
                          {formatCrypto(balance.spot_balance, balance.asset)}
                        </span>
                      </div>
                    )}
                    
                    {balance.futures_balance > 0 && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Futures:</span>
                        <span className="font-mono text-sm">
                          {formatCrypto(balance.futures_balance, balance.asset)}
                        </span>
                      </div>
                    )}
                    
                    <div className="border-t pt-2">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">Total:</span>
                        <span className="font-mono text-sm font-bold text-accent">
                          {formatCrypto(balance.total_balance, balance.asset)}
                        </span>
                      </div>
                    </div>
                    
                    {balance.asset === 'USDT' && (
                      <div className="text-center mt-2">
                        <span className="text-xs text-muted-foreground">
                          ≈ {formatCurrency(balance.total_balance)}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {isLoading && (
          <div className="flex justify-center items-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            <span>Carregando saldos reais...</span>
          </div>
        )}
      </div>
    </section>
  );
};

export default RealTimeBalances;