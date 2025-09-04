import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TradeOpportunity {
  pair: string
  bidPrice: number
  askPrice: number
  spread: number
  volume: number
  estimatedProfit: number
  confidence: number
}

class TradingEngine {
  private supabase: any
  
  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey)
  }

  async findArbitrageOpportunities(): Promise<TradeOpportunity[]> {
    // Buscar dados de mercado em tempo real
    const { data: marketData } = await this.supabase
      .from('market_data_cache')
      .select('*')
      .gte('updated_at', new Date(Date.now() - 5000).toISOString()) // Últimos 5s
    
    if (!marketData || marketData.length === 0) return []

    const opportunities: TradeOpportunity[] = []
    
    // Agrupar por par de trading
    const pairGroups = marketData.reduce((acc: any, data: any) => {
      if (!acc[data.symbol]) acc[data.symbol] = []
      acc[data.symbol].push(data)
      return acc
    }, {})

    for (const [pair, exchanges] of Object.entries(pairGroups) as [string, any[]][]) {
      if (exchanges.length < 2) continue

      // Encontrar maior bid e menor ask
      const maxBid = Math.max(...exchanges.map(e => e.bid_price))
      const minAsk = Math.min(...exchanges.map(e => e.ask_price))
      const spread = ((maxBid - minAsk) / minAsk) * 100

      if (spread > 0.05) { // Mínimo 0.05% de spread
        const volume = Math.min(...exchanges.map(e => e.bid_quantity))
        const estimatedProfit = (maxBid - minAsk) * volume * 0.8 // 80% do lucro bruto
        
        opportunities.push({
          pair,
          bidPrice: maxBid,
          askPrice: minAsk,
          spread,
          volume,
          estimatedProfit,
          confidence: this.calculateConfidence(spread, volume)
        })
      }
    }

    return opportunities.sort((a, b) => b.estimatedProfit - a.estimatedProfit)
  }

  private calculateConfidence(spread: number, volume: number): number {
    // Algoritmo de confiança baseado em spread e volume
    const spreadScore = Math.min(spread / 0.5, 1) // Max score quando spread >= 0.5%
    const volumeScore = Math.min(volume / 1000, 1) // Max score quando volume >= 1000
    return (spreadScore * 0.6 + volumeScore * 0.4) * 100
  }

  async executeTrade(opportunity: TradeOpportunity): Promise<boolean> {
    try {
      // Validar saldos antes da execução
      const { data: balances } = await this.supabase
        .from('account_balances')
        .select('*')
        .eq('user_id', (await this.supabase.auth.getUser()).data.user?.id)

      if (!balances || balances.length === 0) {
        throw new Error('Saldos não encontrados')
      }

      // Executar trade simultâneo
      const tradeResult = await this.executeSimultaneousTrade(opportunity)
      
      // Registrar o trade
      await this.supabase.from('trades').insert({
        user_id: (await this.supabase.auth.getUser()).data.user?.id,
        pair: opportunity.pair,
        entry_price: opportunity.askPrice,
        exit_price: opportunity.bidPrice,
        quantity: opportunity.volume,
        side: 'ARBITRAGE',
        status: 'COMPLETED',
        pnl: opportunity.estimatedProfit,
        ai_confidence: opportunity.confidence,
        execution_time_ms: Date.now()
      })

      return true
    } catch (error) {
      console.error('Erro na execução do trade:', error)
      return false
    }
  }

  private async executeSimultaneousTrade(opportunity: TradeOpportunity): Promise<any> {
    // Implementar execução simultânea nas exchanges
    // Esta função será expandida com a integração real da Binance
    return { success: true }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const engine = new TradingEngine(supabaseUrl, supabaseKey)
    
    if (req.method === 'POST') {
      const { action } = await req.json()
      
      if (action === 'find_opportunities') {
        const opportunities = await engine.findArbitrageOpportunities()
        return new Response(JSON.stringify({ opportunities }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      if (action === 'execute_trade') {
        const { opportunity } = await req.json()
        const result = await engine.executeTrade(opportunity)
        return new Response(JSON.stringify({ success: result }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})