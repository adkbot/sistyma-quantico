-- SISTEMA DE TRADING QUÂNTICO - SCHEMA COMPLETO PARA OPERAÇÕES REAIS
-- Todas as tabelas necessárias para operação 100% real (sem simulação)

-- ========================================
-- 1. CONFIGURAÇÕES DE API E EXCHANGES
-- ========================================
CREATE TABLE api_configurations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  exchange_name TEXT NOT NULL, -- 'binance'
  api_key TEXT NOT NULL,
  api_secret TEXT NOT NULL,
  testnet BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- 2. SALDOS REAIS (SPOT E FUTUROS)
-- ========================================
CREATE TABLE account_balances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  asset TEXT NOT NULL,
  spot_balance NUMERIC(30, 12) DEFAULT 0,
  futures_balance NUMERIC(30, 12) DEFAULT 0,
  total_balance NUMERIC(30, 12) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, asset)
);

-- ========================================
-- 3. PARES DE TRADING CONFIGURADOS
-- ========================================
CREATE TABLE trading_pairs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  spot_symbol TEXT NOT NULL, -- 'BTCUSDT'
  futures_symbol TEXT NOT NULL, -- 'BTCUSDT'
  min_spread_percentage DECIMAL(5,4) NOT NULL DEFAULT 0.0010, -- 0.10%
  max_position_size_usdt DECIMAL(20,8) NOT NULL DEFAULT 1000,
  allocation_percentage DECIMAL(5,2) NOT NULL DEFAULT 5.00, -- 5% do saldo
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- 4. TRADES REAIS EXECUTADOS
-- ========================================
CREATE TABLE trades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  exchange TEXT,
  pair TEXT NOT NULL,
  side TEXT NOT NULL,
  price NUMERIC(30, 12) NOT NULL,
  quantity NUMERIC(30, 12) NOT NULL,
  pnl NUMERIC(30, 12),
  fees NUMERIC(30, 12),
  slippage NUMERIC(30, 12),
  entry_price NUMERIC(30, 12),
  exit_price NUMERIC(30, 12),
  execution_time_ms INTEGER,
  status TEXT,
  ai_confidence NUMERIC(10, 4),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- 5. CONFIGURAÇÕES DE RISK MANAGEMENT
-- ========================================
CREATE TABLE risk_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- LIMITES FINANCEIROS
  max_daily_loss_usdt DECIMAL(20,8) NOT NULL DEFAULT 500,
  max_position_size_percentage DECIMAL(5,2) NOT NULL DEFAULT 10.00, -- 10% do saldo
  min_account_balance_usdt DECIMAL(20,8) NOT NULL DEFAULT 100,
  
  -- STOP LOSS E TAKE PROFIT
  stop_loss_percentage DECIMAL(5,4) NOT NULL DEFAULT 2.0000, -- 2%
  take_profit_percentage DECIMAL(5,4) NOT NULL DEFAULT 1.0000, -- 1%
  trailing_stop_enabled BOOLEAN DEFAULT false,
  
  -- CONTROLES OPERACIONAIS
  max_open_positions INTEGER NOT NULL DEFAULT 3,
  max_daily_trades INTEGER NOT NULL DEFAULT 50,
  cooldown_after_loss_minutes INTEGER NOT NULL DEFAULT 30,
  
  -- EMERGENCY CONTROLS
  emergency_stop_enabled BOOLEAN DEFAULT true,
  auto_rebalance_enabled BOOLEAN DEFAULT true,
  pause_on_high_volatility BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- 6. CONFIGURAÇÕES DE IA/ML
-- ========================================
CREATE TABLE ai_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- MODELO DE ML
  model_type TEXT NOT NULL DEFAULT 'reinforcement_learning',
  model_version TEXT NOT NULL DEFAULT 'v1.0',
  learning_rate DECIMAL(8,6) NOT NULL DEFAULT 0.001000,
  confidence_threshold DECIMAL(5,4) NOT NULL DEFAULT 0.7500, -- 75%
  
  -- PARÂMETROS DE TREINAMENTO
  retrain_frequency_hours INTEGER NOT NULL DEFAULT 24,
  training_data_window_days INTEGER NOT NULL DEFAULT 30,
  validation_split DECIMAL(3,2) NOT NULL DEFAULT 0.20, -- 20%
  
  -- FEATURES ATIVAS
  use_wyckoff_analysis BOOLEAN DEFAULT true,
  use_gex_analysis BOOLEAN DEFAULT true,
  use_volume_profile BOOLEAN DEFAULT true,
  use_orderbook_analysis BOOLEAN DEFAULT true,
  
  -- ESTADO DO MODELO
  last_training TIMESTAMP WITH TIME ZONE,
  training_accuracy DECIMAL(5,4),
  model_performance_score DECIMAL(5,4),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- 7. DADOS GEX REAIS (API LAEVITAS)
-- ========================================
CREATE TABLE gex_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL, -- 'BTC', 'ETH'
  market TEXT NOT NULL, -- 'deribit'
  
  -- DADOS GEX
  total_gex DECIMAL(20,8) NOT NULL,
  net_gex DECIMAL(20,8),
  call_gex DECIMAL(20,8),
  put_gex DECIMAL(20,8),
  
  -- ANÁLISE DE REGIMES
  gex_regime TEXT, -- 'positive_extreme', 'negative_extreme', 'neutral'
  volatility_regime TEXT, -- 'low', 'medium', 'high'
  
  -- TIMESTAMP
  data_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(symbol, market, data_timestamp)
);

-- ========================================
-- 8. ANÁLISE WYCKOFF EM TEMPO REAL
-- ========================================
CREATE TABLE wyckoff_analysis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL, -- '1h', '4h', '1d'
  
  -- FASES WYCKOFF
  current_phase TEXT NOT NULL, -- 'accumulation', 'markup', 'distribution', 'markdown'
  phase_subtype TEXT, -- 'phase_a', 'phase_b', 'phase_c', 'phase_d', 'phase_e'
  confidence_score DECIMAL(5,4) NOT NULL, -- 0-1
  
  -- CARACTERÍSTICAS TÉCNICAS
  volume_analysis JSONB,
  price_action_signals JSONB,
  support_resistance_levels JSONB,
  
  -- TIMESTAMP
  analysis_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(symbol, timeframe, analysis_timestamp)
);

-- ========================================
-- 9. LOGS DO SISTEMA
-- ========================================
CREATE TABLE system_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- CATEGORIZAÇÃO
  log_level TEXT NOT NULL, -- 'debug', 'info', 'warning', 'error', 'critical'
  component TEXT NOT NULL, -- 'trading_engine', 'ml_model', 'api_connector', 'risk_manager'
  operation TEXT, -- 'order_execution', 'balance_sync', 'model_prediction'
  
  -- CONTEÚDO
  message TEXT NOT NULL,
  error_code TEXT,
  
  -- MÉTRICAS
  latency_ms INTEGER,
  memory_usage_mb INTEGER,
  cpu_usage_percentage DECIMAL(5,2),
  
  -- DADOS ADICIONAIS
  metadata JSONB,
  
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- 10. DADOS DE MERCADO CACHE (WEBSOCKET)
-- ========================================
CREATE TABLE market_data_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  bid_price NUMERIC(30, 12),
  ask_price NUMERIC(30, 12),
  spread NUMERIC(30, 12),
  volume_24h NUMERIC(30, 12),
  source TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- 11. STATUS DO BOT EM TEMPO REAL
-- ========================================
CREATE TABLE bot_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- ESTADO OPERACIONAL
  is_running BOOLEAN DEFAULT false,
  current_mode TEXT DEFAULT 'standby', -- 'standby', 'scanning', 'trading', 'emergency_stop'
  last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- MÉTRICAS OPERACIONAIS
  active_positions INTEGER DEFAULT 0,
  pending_orders INTEGER DEFAULT 0,
  daily_pnl_usdt DECIMAL(20,8) DEFAULT 0,
  total_trades_today INTEGER DEFAULT 0,
  success_rate_percentage DECIMAL(5,2) DEFAULT 0,
  
  -- MÉTRICAS TÉCNICAS
  avg_latency_ms INTEGER DEFAULT 0,
  max_latency_ms INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  last_error_message TEXT,
  
  -- RECURSOS DO SISTEMA
  cpu_usage_percentage DECIMAL(5,2) DEFAULT 0,
  memory_usage_mb INTEGER DEFAULT 0,
  network_latency_ms INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- ========================================
-- 12. OPORTUNIDADES DE ARBITRAGEM DETECTADAS
-- ========================================
CREATE TABLE arbitrage_opportunities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- IDENTIFICAÇÃO
  spot_symbol TEXT NOT NULL,
  futures_symbol TEXT NOT NULL,
  
  -- PREÇOS E SPREAD
  spot_ask_price DECIMAL(20,8) NOT NULL,
  futures_bid_price DECIMAL(20,8) NOT NULL,
  gross_spread_percentage DECIMAL(8,6) NOT NULL,
  
  -- ANÁLISE DE CUSTOS
  estimated_slippage DECIMAL(8,6) NOT NULL,
  estimated_fees DECIMAL(8,6) NOT NULL,
  net_spread_percentage DECIMAL(8,6) NOT NULL,
  
  -- ANÁLISE IA/ML
  ai_score DECIMAL(5,4), -- 0-1
  wyckoff_favorability DECIMAL(5,4), -- 0-1
  gex_favorability DECIMAL(5,4), -- 0-1
  
  -- DECISÃO
  decision TEXT NOT NULL, -- 'execute', 'skip', 'pending'
  decision_reason TEXT,
  
  -- TIMING
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL,
  decision_latency_ms INTEGER,
  
  -- STATUS
  status TEXT DEFAULT 'detected', -- 'detected', 'executed', 'expired', 'rejected'
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- ÍNDICES PARA PERFORMANCE
-- ========================================
CREATE INDEX idx_trades_user_timestamp ON trades(user_id, entry_timestamp DESC);
CREATE INDEX idx_trades_status_timestamp ON trades(status, entry_timestamp DESC);
CREATE INDEX idx_trades_pair_timestamp ON trades(pair_id, entry_timestamp DESC);

CREATE INDEX idx_market_data_symbol_timestamp ON market_data_cache(symbol, data_timestamp DESC);
CREATE INDEX idx_gex_data_symbol_timestamp ON gex_data(symbol, data_timestamp DESC);
CREATE INDEX idx_wyckoff_symbol_timestamp ON wyckoff_analysis(symbol, analysis_timestamp DESC);

CREATE INDEX idx_system_logs_level_timestamp ON system_logs(log_level, timestamp DESC);
CREATE INDEX idx_system_logs_component_timestamp ON system_logs(component, timestamp DESC);

CREATE INDEX idx_account_balances_user_type ON account_balances(user_id, account_type, asset);
CREATE INDEX idx_arbitrage_opportunities_timestamp ON arbitrage_opportunities(detected_at DESC);

-- ========================================
-- ROW LEVEL SECURITY (RLS)
-- ========================================
ALTER TABLE api_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading_pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE arbitrage_opportunities ENABLE ROW LEVEL SECURITY;

-- Políticas RLS - Usuários só acessam seus próprios dados
CREATE POLICY "users_own_api_configurations" ON api_configurations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_account_balances" ON account_balances FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_trading_pairs" ON trading_pairs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_trades" ON trades FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_risk_settings" ON risk_settings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_ai_settings" ON ai_settings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_system_logs" ON system_logs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_bot_status" ON bot_status FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_arbitrage_opportunities" ON arbitrage_opportunities FOR ALL USING (auth.uid() = user_id);

-- Dados públicos (somente leitura para usuários autenticados)
ALTER TABLE gex_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE wyckoff_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_data_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_gex_data" ON gex_data FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "authenticated_read_wyckoff_analysis" ON wyckoff_analysis FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "authenticated_read_market_data_cache" ON market_data_cache FOR SELECT USING (auth.role() = 'authenticated');

-- ========================================
-- FUNCTIONS E TRIGGERS
-- ========================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_api_configurations_updated_at BEFORE UPDATE ON api_configurations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_trades_updated_at BEFORE UPDATE ON trades FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_risk_settings_updated_at BEFORE UPDATE ON risk_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ai_settings_updated_at BEFORE UPDATE ON ai_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bot_status_updated_at BEFORE UPDATE ON bot_status FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função para calcular duração do trade
CREATE OR REPLACE FUNCTION calculate_trade_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.exit_timestamp IS NOT NULL AND NEW.entry_timestamp IS NOT NULL THEN
    NEW.duration_seconds = EXTRACT(EPOCH FROM (NEW.exit_timestamp - NEW.entry_timestamp));
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER calculate_trade_duration_trigger BEFORE UPDATE ON trades FOR EACH ROW EXECUTE FUNCTION calculate_trade_duration();

-- Função para atualizar heartbeat do bot
CREATE OR REPLACE FUNCTION update_bot_heartbeat()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_heartbeat = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_bot_heartbeat_trigger BEFORE UPDATE ON bot_status FOR EACH ROW EXECUTE FUNCTION update_bot_heartbeat();

-- ========================================
-- VIEWS PARA ANÁLISES RÁPIDAS
-- ========================================

-- View para performance diária
CREATE VIEW daily_performance AS
SELECT 
  user_id,
  DATE(entry_timestamp) as trade_date,
  COUNT(*) as total_trades,
  SUM(net_pnl_usdt) as total_pnl,
  AVG(roi_percentage) as avg_roi,
  AVG(ai_confidence_score) as avg_ai_confidence,
  SUM(total_fees_usdt) as total_fees,
  AVG(entry_latency_ms) as avg_latency
FROM trades 
WHERE status = 'closed'
GROUP BY user_id, DATE(entry_timestamp)
ORDER BY trade_date DESC;

-- View para status atual dos saldos
CREATE VIEW current_balances AS
SELECT 
  user_id,
  exchange_name,
  account_type,
  SUM(CASE WHEN asset = 'USDT' THEN available_balance ELSE 0 END) as usdt_balance,
  SUM(CASE WHEN asset = 'BTC' THEN available_balance ELSE 0 END) as btc_balance,
  MAX(last_sync) as last_sync
FROM account_balances
WHERE total_balance > 0
GROUP BY user_id, exchange_name, account_type;

-- View para oportunidades recentes
CREATE VIEW recent_opportunities AS
SELECT 
  *,
  (net_spread_percentage * 100) as net_spread_bps,
  (detected_at + INTERVAL '5 minutes') > NOW() as is_fresh
FROM arbitrage_opportunities
WHERE detected_at > NOW() - INTERVAL '1 hour'
ORDER BY detected_at DESC;

-- ========================================
-- COMENTÁRIOS FINAIS
-- ========================================

-- Este schema foi projetado para:
-- 1. Operações 100% reais (sem simulação)
-- 2. Saldos sincronizados spot/futuros
-- 3. Rastreamento completo de trades
-- 4. Análise GEX em tempo real
-- 5. Machine Learning adaptativo
-- 6. Risk management robusto
-- 7. Logs detalhados para debugging
-- 8. Performance otimizada com índices
-- 9. Segurança com RLS
-- 10. Análises rápidas com views


