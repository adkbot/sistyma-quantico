import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, TrendingDown, Clock, DollarSign } from "lucide-react";

interface Trade {
  id: string;
  timestamp: string;
  pair: string;
  type: 'spot-futures' | 'futures-spot';
  entryPrice: number;
  exitPrice: number;
  volume: number;
  pnl: number;
  fees: number;
  slippage: number;
  duration: number; // em segundos
  aiConfidence: number;
}

interface TradeHistoryProps {
  trades: Trade[];
}

const TradeHistory: React.FC<TradeHistoryProps> = ({ trades }) => {
  // Exibir valores apenas em USDT
  const formatUSDT = (value: number) => `${value.toFixed(2)} USDT`;

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(3)}%`;
  };

  const formatTime = (timestamp: string) => {
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(timestamp));
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <section className="py-16 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4 text-quantum">
            Histórico de Operações
          </h2>
          <p className="text-lg text-muted-foreground">
            Registro detalhado de todas as operações executadas
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="glass-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total de Trades</p>
                  <p className="text-2xl font-bold">{trades.length}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">P&L Total</p>
                  <p className="text-2xl font-bold text-accent">
                    {formatUSDT(trades.reduce((sum, trade) => sum + trade.pnl, 0))}
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
                  <p className="text-sm text-muted-foreground">Taxa de Sucesso</p>
                  <p className="text-2xl font-bold text-secondary">
                    {((trades.filter(t => t.pnl > 0).length / trades.length) * 100).toFixed(1)}%
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-secondary" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Duração Média</p>
                  <p className="text-2xl font-bold">
                    {formatDuration(Math.round(trades.reduce((sum, trade) => sum + trade.duration, 0) / trades.length))}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Trades Table */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Detalhes das Operações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Horário</TableHead>
                    <TableHead>Par</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Volume</TableHead>
                    <TableHead>P&L</TableHead>
                    <TableHead>Taxas</TableHead>
                    <TableHead>Slippage</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>IA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trades.map((trade) => (
                    <TableRow key={trade.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-sm">
                        {formatTime(trade.timestamp)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {trade.pair}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline"
                          className={trade.type === 'spot-futures' ? 'border-primary' : 'border-secondary'}
                        >
                          {trade.type === 'spot-futures' ? 'S→F' : 'F→S'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono">
                        {formatUSDT(trade.volume)}
                      </TableCell>
                      <TableCell>
                        <div className={`flex items-center ${
                          trade.pnl >= 0 ? 'text-accent' : 'text-destructive'
                        }`}>
                          {trade.pnl >= 0 ? (
                            <TrendingUp className="h-4 w-4 mr-1" />
                          ) : (
                            <TrendingDown className="h-4 w-4 mr-1" />
                          )}
                          <span className="font-mono">
                            {formatUSDT(trade.pnl)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {formatUSDT(trade.fees)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatPercent(trade.slippage)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatDuration(trade.duration)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                          <span className="text-sm font-mono">
                            {trade.aiConfidence}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default TradeHistory;
