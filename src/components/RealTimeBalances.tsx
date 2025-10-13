import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wallet, RefreshCw, TrendingUp, DollarSign } from "lucide-react";

type RealTimeBalance = {
  asset: string;
  spot_balance: number;
  futures_balance: number;
  total_balance: number;
};

type RealTimeBalancesProps = {
  balances: RealTimeBalance[];
  isLoading: boolean;
  error: string | null;
  onSync: () => void | Promise<void>;
};

const RealTimeBalances: React.FC<RealTimeBalancesProps> = ({ balances, isLoading, error, onSync }) => {
  // Exibir somente em USDT conforme solicitado

  const formatCrypto = (value: number, asset: string) => {
    const decimals = ['BTC', 'ETH'].includes(asset) ? 6 : 2;
    return `${value.toFixed(decimals)} ${asset}`;
  };

  const getTotalUSDT = () =>
    balances
      .filter((balance) => balance.asset === 'USDT')
      .reduce((sum, balance) => sum + balance.total_balance, 0);

  if (error) {
    return (
      <section className="py-8 px-6">
        <div className="max-w-7xl mx-auto">
          <Card className="glass-card border-destructive">
            <CardContent className="p-6">
              <div className="text-center text-destructive space-y-3">
                <p>Erro ao carregar saldos: {error}</p>
                <Button onClick={onSync} disabled={isLoading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Tentar novamente
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    );
  }

  return (
    <section className="py-8 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-bold text-quantum">Saldos da Carteira</h3>
            <p className="text-sm text-muted-foreground">Saldos reais sincronizados com a Binance</p>
          </div>
          <Button
            onClick={onSync}
            disabled={isLoading}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Sincronizar
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="glass-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Total (USDT)</p>
                  <p className="text-2xl font-bold text-accent">
                    {formatCrypto(getTotalUSDT(), 'USDT')}
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
                  <p className="text-2xl font-bold">{balances.length}</p>
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
                    <Badge variant="default" className={error ? 'bg-destructive' : 'bg-accent'}>
                      {error ? 'ERRO' : 'CONECTADO'}
                    </Badge>
                    <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-yellow-400 animate-pulse' : 'bg-accent animate-ping'}`} />
                  </div>
                </div>
                <TrendingUp className="h-8 w-8 text-secondary" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {balances.length === 0 && !isLoading ? (
            <Card className="glass-card col-span-full">
              <CardContent className="p-8 text-center space-y-4">
                <Wallet className="h-12 w-12 mx-auto text-muted-foreground" />
                <div>
                  <h3 className="text-lg font-semibold">Nenhum saldo encontrado</h3>
                  <p className="text-muted-foreground">Sincronize com a Binance para carregar seus saldos reais.</p>
                </div>
                <Button onClick={onSync}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Sincronizar agora
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
                      SPOT + FUTURES
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Spot:</span>
                      <span className="font-mono text-sm">
                        {formatCrypto(balance.spot_balance, balance.asset)}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Futures:</span>
                      <span className="font-mono text-sm">
                        {formatCrypto(balance.futures_balance, balance.asset)}
                      </span>
                    </div>

                    <div className="border-t pt-2">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">Total:</span>
                        <span className="font-mono text-sm font-bold text-accent">
                          {formatCrypto(balance.total_balance, balance.asset)}
                        </span>
                      </div>
                    </div>

                    {/* Sem conversão para moeda fiat. Mostrar apenas USDT. */}
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

