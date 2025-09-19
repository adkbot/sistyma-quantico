-- Criar tabelas principais para o sistema de trading
-- 1. Tabela de saldos por asset
CREATE TABLE IF NOT EXISTS public.account_balances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  asset TEXT NOT NULL,
  spot_balance DECIMAL(18,8) DEFAULT 0,
  futures_balance DECIMAL(18,8) DEFAULT 0,
  total_balance DECIMAL(18,8) GENERATED ALWAYS AS (spot_balance + futures_balance) STORED,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, asset)
);

-- 2. Tabela de trades executados
CREATE TABLE IF NOT EXISTS public.trades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  pair TEXT NOT NULL,
  side TEXT NOT NULL,
  price DECIMAL(18,8) NOT NULL,
  entry_price DECIMAL(18,8),
  exit_price DECIMAL(18,8),
  quantity DECIMAL(18,8) NOT NULL,
  pnl DECIMAL(18,8) DEFAULT 0,
  fees DECIMAL(18,8) DEFAULT 0,
  slippage DECIMAL(18,8) DEFAULT 0,
  execution_time_ms INTEGER DEFAULT 0,
  ai_confidence DECIMAL(5,2) DEFAULT 0,
  status TEXT DEFAULT 'executed',
  exchange TEXT DEFAULT 'binance',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabela de cache de dados de mercado
CREATE TABLE IF NOT EXISTS public.market_data_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  bid_price DECIMAL(18,8),
  ask_price DECIMAL(18,8),
  spread DECIMAL(18,8),
  volume_24h DECIMAL(18,8),
  source TEXT DEFAULT 'binance',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(symbol, source)
);

-- 4. Tabela de configurações do usuário
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  binance_api_key TEXT,
  binance_secret_key TEXT,
  max_position_size DECIMAL(18,8) DEFAULT 1000,
  risk_level TEXT DEFAULT 'medium',
  auto_trading_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Tabela de métricas de performance
CREATE TABLE IF NOT EXISTS public.performance_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  total_pnl DECIMAL(18,8) DEFAULT 0,
  daily_pnl DECIMAL(18,8) DEFAULT 0,
  total_trades INTEGER DEFAULT 0,
  successful_trades INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2) DEFAULT 0,
  avg_latency DECIMAL(10,2) DEFAULT 0,
  ai_confidence DECIMAL(5,2) DEFAULT 0,
  active_pairs INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.account_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_data_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para account_balances
CREATE POLICY "Users can view their own balances" ON public.account_balances
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own balances" ON public.account_balances
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own balances" ON public.account_balances
  FOR UPDATE USING (auth.uid() = user_id);

-- Políticas RLS para trades
CREATE POLICY "Users can view their own trades" ON public.trades
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own trades" ON public.trades
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Market data é público para leitura, mas só edge functions podem inserir
CREATE POLICY "Market data is readable by authenticated users" ON public.market_data_cache
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Only service role can modify market data" ON public.market_data_cache
  FOR ALL USING (auth.role() = 'service_role');

-- Políticas RLS para user_settings
CREATE POLICY "Users can view their own settings" ON public.user_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings" ON public.user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings" ON public.user_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- Políticas RLS para performance_metrics
CREATE POLICY "Users can view their own metrics" ON public.performance_metrics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own metrics" ON public.performance_metrics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own metrics" ON public.performance_metrics
  FOR UPDATE USING (auth.uid() = user_id);

-- Criar índices para performance
CREATE INDEX idx_account_balances_user_id ON public.account_balances(user_id);
CREATE INDEX idx_trades_user_id ON public.trades(user_id);
CREATE INDEX idx_trades_created_at ON public.trades(created_at DESC);
CREATE INDEX idx_market_data_symbol ON public.market_data_cache(symbol);
CREATE INDEX idx_market_data_updated_at ON public.market_data_cache(updated_at DESC);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_account_balances_updated_at
    BEFORE UPDATE ON public.account_balances
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON public.user_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_performance_metrics_updated_at
    BEFORE UPDATE ON public.performance_metrics
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();