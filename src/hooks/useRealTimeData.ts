import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface RealTimeBalance {
  asset: string;
  spot_balance: number;
  futures_balance: number;
  total_balance: number;
}

interface RealTimeTrade {
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
  duration: number;
  aiConfidence: number;
}

interface RealTimeMetrics {
  total_pnl: number;
  daily_pnl: number;
  total_trades: number;
  success_rate: number;
  avg_latency: number;
  active_pairs: number;
  ai_confidence: number;
}

export const useRealTimeData = () => {
  const [balances, setBalances] = useState<RealTimeBalance[]>([]);
  const [trades, setTrades] = useState<RealTimeTrade[]>([]);
  const [metrics, setMetrics] = useState<RealTimeMetrics>({
    total_pnl: 0,
    daily_pnl: 0,
    total_trades: 0,
    success_rate: 0,
    avg_latency: 0,
    active_pairs: 0,
    ai_confidence: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Função para buscar saldos reais
  const fetchRealBalances = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Dados de exemplo para usuários não autenticados
        setBalances([
          { asset: 'USDT', spot_balance: 5000, futures_balance: 3000, total_balance: 8000 },
          { asset: 'BTC', spot_balance: 0.25, futures_balance: 0.15, total_balance: 0.4 },
        ]);
        return;
      }

      const { data, error } = await supabase
        .from('account_balances')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Agrupar por asset e somar spot + futures
      const balanceMap = new Map<string, RealTimeBalance>();
      
      data?.forEach(balance => {
        const existing = balanceMap.get(balance.asset) || {
          asset: balance.asset,
          spot_balance: 0,
          futures_balance: 0,
          total_balance: 0
        };

        existing.spot_balance += balance.spot_balance || 0;
        existing.futures_balance += balance.futures_balance || 0;
        existing.total_balance = existing.spot_balance + existing.futures_balance;

        balanceMap.set(balance.asset, existing);
      });

      setBalances(Array.from(balanceMap.values()).filter(b => b.total_balance > 0));
    } catch (err) {
      console.error('Erro ao buscar saldos:', err);
      setError('Erro ao carregar saldos');
    }
  };

  // Função para buscar trades reais
  const fetchRealTrades = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Dados de exemplo para usuários não autenticados
        setTrades([
          {
            id: 'demo-1',
            timestamp: new Date().toISOString(),
            pair: 'BTCUSDT',
            type: 'spot-futures',
            entryPrice: 43250,
            exitPrice: 43280,
            volume: 0.1,
            pnl: 3.0,
            fees: 0.5,
            slippage: 0.02,
            duration: 245,
            aiConfidence: 94.2
          }
        ]);
        return;
      }

      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Transformar dados da base para formato da interface
      const transformedTrades: RealTimeTrade[] = (data || []).map(trade => ({
        id: trade.id,
        timestamp: trade.created_at,
        pair: trade.pair || '',
        type: trade.side === 'BUY' ? 'spot-futures' : 'futures-spot',
        entryPrice: trade.entry_price || trade.price || 0,
        exitPrice: trade.exit_price || trade.price || 0,
        volume: trade.quantity || 0,
        pnl: trade.pnl || 0,
        fees: trade.fees || 0,
        slippage: trade.slippage || 0,
        duration: trade.execution_time_ms || 0,
        aiConfidence: trade.ai_confidence || 0
      }));

      setTrades(transformedTrades);
    } catch (err) {
      console.error('Erro ao buscar trades:', err);
      setError('Erro ao carregar histórico de trades');
    }
  };

  // Função para calcular métricas reais
  const calculateRealMetrics = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Dados de exemplo para usuários não autenticados
        setMetrics({
          total_pnl: 1250.75,
          daily_pnl: 85.30,
          total_trades: 147,
          success_rate: 89.2,
          avg_latency: 12.5,
          active_pairs: 8,
          ai_confidence: 94.2
        });
        return;
      }

      // Buscar trades do usuário
      const { data: allTrades } = await supabase
        .from('trades')
        .select('pnl, created_at, execution_time_ms, ai_confidence, status')
        .eq('user_id', user.id);

      if (!allTrades || allTrades.length === 0) return;

      // Calcular métricas
      const totalPnl = allTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTrades = allTrades.filter(trade => 
        new Date(trade.created_at) >= today
      );
      const dailyPnl = todayTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);

      const successfulTrades = allTrades.filter(trade => (trade.pnl || 0) > 0);
      const successRate = (successfulTrades.length / allTrades.length) * 100;

      const avgLatency = allTrades.reduce((sum, trade) => 
        sum + (trade.execution_time_ms || 0), 0
      ) / allTrades.length;

      const avgAiConfidence = allTrades.reduce((sum, trade) => 
        sum + (trade.ai_confidence || 0), 0
      ) / allTrades.length;

      // Buscar pares ativos
      const { data: marketData } = await supabase
        .from('market_data_cache')
        .select('symbol')
        .gte('updated_at', new Date(Date.now() - 300000).toISOString()); // Últimos 5 min

      const activePairs = new Set(marketData?.map(d => d.symbol) || []).size;

      setMetrics({
        total_pnl: totalPnl,
        daily_pnl: dailyPnl,
        total_trades: allTrades.length,
        success_rate: successRate,
        avg_latency: avgLatency,
        active_pairs: activePairs,
        ai_confidence: avgAiConfidence
      });

    } catch (err) {
      console.error('Erro ao calcular métricas:', err);
      setError('Erro ao calcular métricas');
    }
  };

  // Função para sincronizar dados com Binance
  const syncWithBinance = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Chamar edge function para sincronizar saldos
      const { data, error } = await supabase.functions.invoke('binance-connector', {
        body: { action: 'sync_balances' }
      });

      if (error) throw error;

      // Atualizar dados locais após sincronização
      await Promise.all([
        fetchRealBalances(),
        fetchRealTrades(),
        calculateRealMetrics()
      ]);

    } catch (err) {
      console.error('Erro na sincronização:', err);
      setError('Erro na sincronização com Binance');
    }
  };

  // Configurar subscriptions em tempo real
  useEffect(() => {
    const setupRealTimeSubscriptions = () => {
      // Subscription para trades
      const tradesSubscription = supabase
        .channel('trades')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'trades' },
          () => {
            fetchRealTrades();
            calculateRealMetrics();
          }
        )
        .subscribe();

      // Subscription para saldos
      const balancesSubscription = supabase
        .channel('balances')
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'account_balances' },
          () => {
            fetchRealBalances();
          }
        )
        .subscribe();

      return () => {
        tradesSubscription.unsubscribe();
        balancesSubscription.unsubscribe();
      };
    };

    const initializeData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([
          fetchRealBalances(),
          fetchRealTrades(),
          calculateRealMetrics()
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    initializeData();
    const cleanup = setupRealTimeSubscriptions();

    // Sincronizar a cada 30 segundos
    const syncInterval = setInterval(syncWithBinance, 30000);

    return () => {
      cleanup();
      clearInterval(syncInterval);
    };
  }, []);

  return {
    balances,
    trades,
    metrics,
    isLoading,
    error,
    syncWithBinance,
    refreshData: async () => {
      await Promise.all([
        fetchRealBalances(),
        fetchRealTrades(), 
        calculateRealMetrics()
      ]);
    }
  };
};