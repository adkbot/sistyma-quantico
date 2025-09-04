import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GEXData {
  symbol: string
  gex: number
  dex: number
  cex: number
  spotPrice: number
  regime: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  regimeStrength: number
}

class GEXProcessor {
  private supabase: any
  private laevitasApiUrl = 'https://api.laevitas.com'
  
  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey)
  }

  async fetchGEXData(symbol: string = 'BTC'): Promise<GEXData | null> {
    try {
      // Buscar dados GEX da API Laevitas (pública)
      const response = await fetch(`${this.laevitasApiUrl}/analytics/gex?symbol=${symbol}`)
      
      if (!response.ok) {
        throw new Error(`Erro na API Laevitas: ${response.status}`)
      }
      
      const data = await response.json()
      
      // Processar dados GEX
      const gexData: GEXData = {
        symbol,
        gex: data.gex || 0,
        dex: data.dex || 0,
        cex: data.cex || 0,
        spotPrice: data.spot_price || 0,
        regime: this.determineRegime(data.gex, data.dex),
        regimeStrength: this.calculateRegimeStrength(data.gex, data.dex)
      }
      
      // Salvar no cache do banco
      await this.supabase
        .from('gex_data')
        .upsert({
          symbol,
          gex_value: gexData.gex,
          dex_value: gexData.dex,
          cex_value: gexData.cex,
          spot_price: gexData.spotPrice,
          regime: gexData.regime,
          regime_strength: gexData.regimeStrength,
          raw_data: data,
          updated_at: new Date().toISOString()
        })
      
      return gexData
      
    } catch (error) {
      console.error('Erro ao buscar dados GEX:', error)
      return null
    }
  }

  private determineRegime(gex: number, dex: number): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    const gexThreshold = 0.1
    const ratio = gex / (Math.abs(dex) + 1)
    
    if (ratio > gexThreshold && gex > 0) {
      return 'BULLISH'
    } else if (ratio < -gexThreshold && gex < 0) {
      return 'BEARISH'
    } else {
      return 'NEUTRAL'
    }
  }

  private calculateRegimeStrength(gex: number, dex: number): number {
    // Calcula a força do regime (0-100)
    const maxGex = 1.0 // Valor máximo esperado
    const normalizedGex = Math.abs(gex) / maxGex
    const normalizedDex = Math.abs(dex) / maxGex
    
    return Math.min((normalizedGex + normalizedDex) * 50, 100)
  }

  async analyzeGEXTrend(symbol: string, hours: number = 24): Promise<any> {
    try {
      // Buscar dados históricos GEX
      const { data: historicalData } = await this.supabase
        .from('gex_data')
        .select('*')
        .eq('symbol', symbol)
        .gte('updated_at', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
        .order('updated_at', { ascending: true })
      
      if (!historicalData || historicalData.length < 2) {
        return { trend: 'INSUFFICIENT_DATA', strength: 0 }
      }
      
      // Calcular tendência
      const firstGex = historicalData[0].gex_value
      const lastGex = historicalData[historicalData.length - 1].gex_value
      const change = ((lastGex - firstGex) / Math.abs(firstGex)) * 100
      
      let trend = 'NEUTRAL'
      if (change > 5) trend = 'INCREASING'
      else if (change < -5) trend = 'DECREASING'
      
      // Calcular volatilidade
      const gexValues = historicalData.map(d => d.gex_value)
      const mean = gexValues.reduce((a, b) => a + b, 0) / gexValues.length
      const variance = gexValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / gexValues.length
      const volatility = Math.sqrt(variance)
      
      return {
        trend,
        change: change.toFixed(2),
        strength: Math.min(Math.abs(change) * 10, 100),
        volatility: volatility.toFixed(4),
        dataPoints: historicalData.length
      }
      
    } catch (error) {
      console.error('Erro na análise de tendência GEX:', error)
      return { trend: 'ERROR', strength: 0 }
    }
  }

  async getGEXSignals(symbol: string): Promise<any> {
    try {
      const currentData = await this.fetchGEXData(symbol)
      if (!currentData) return { signals: [], confidence: 0 }
      
      const trendData = await this.analyzeGEXTrend(symbol)
      
      const signals = []
      let confidence = 0
      
      // Sinal de regime bullish forte
      if (currentData.regime === 'BULLISH' && currentData.regimeStrength > 70) {
        signals.push({
          type: 'ENTRY_LONG',
          strength: currentData.regimeStrength,
          reason: 'Regime GEX fortemente bullish'
        })
        confidence += 30
      }
      
      // Sinal de regime bearish forte
      if (currentData.regime === 'BEARISH' && currentData.regimeStrength > 70) {
        signals.push({
          type: 'ENTRY_SHORT',
          strength: currentData.regimeStrength,
          reason: 'Regime GEX fortemente bearish'
        })
        confidence += 30
      }
      
      // Sinal de mudança de tendência
      if (trendData.trend === 'INCREASING' && trendData.strength > 50) {
        signals.push({
          type: 'TREND_CHANGE_UP',
          strength: trendData.strength,
          reason: 'GEX em tendência crescente'
        })
        confidence += 25
      }
      
      if (trendData.trend === 'DECREASING' && trendData.strength > 50) {
        signals.push({
          type: 'TREND_CHANGE_DOWN',
          strength: trendData.strength,
          reason: 'GEX em tendência decrescente'
        })
        confidence += 25
      }
      
      return { signals, confidence: Math.min(confidence, 100) }
      
    } catch (error) {
      console.error('Erro ao gerar sinais GEX:', error)
      return { signals: [], confidence: 0 }
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const processor = new GEXProcessor(supabaseUrl, supabaseKey)
    
    if (req.method === 'POST') {
      const { action, symbol = 'BTC', hours = 24 } = await req.json()
      
      switch (action) {
        case 'fetch_gex':
          const gexData = await processor.fetchGEXData(symbol)
          return new Response(JSON.stringify({ gexData }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
          
        case 'analyze_trend':
          const trendData = await processor.analyzeGEXTrend(symbol, hours)
          return new Response(JSON.stringify({ trendData }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
          
        case 'get_signals':
          const signals = await processor.getGEXSignals(symbol)
          return new Response(JSON.stringify({ signals }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
          
        default:
          return new Response(JSON.stringify({ error: 'Invalid action' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
      }
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})