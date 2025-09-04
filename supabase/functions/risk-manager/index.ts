import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RiskAssessment {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  riskScore: number
  allowTrade: boolean
  recommendations: string[]
  maxPositionSize: number
}

class RiskManager {
  private supabase: any
  
  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey)
  }

  async assessRisk(userId: string, tradeParams: any): Promise<RiskAssessment> {
    try {
      // Buscar configurações de risco do usuário
      const { data: riskSettings } = await this.supabase
        .from('risk_settings')
        .select('*')
        .eq('user_id', userId)
        .single()
      
      if (!riskSettings) {
        throw new Error('Configurações de risco não encontradas')
      }
      
      // Buscar saldos atuais
      const { data: balances } = await this.supabase
        .from('account_balances')
        .select('*')
        .eq('user_id', userId)
      
      // Buscar trades recentes
      const { data: recentTrades } = await this.supabase
        .from('trades')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      
      // Calcular métricas de risco
      const riskMetrics = await this.calculateRiskMetrics(
        riskSettings,
        balances,
        recentTrades,
        tradeParams
      )
      
      return this.generateRiskAssessment(riskMetrics, riskSettings, tradeParams)
      
    } catch (error) {
      console.error('Erro na avaliação de risco:', error)
      return {
        riskLevel: 'CRITICAL',
        riskScore: 100,
        allowTrade: false,
        recommendations: ['Erro na avaliação de risco - trade bloqueado'],
        maxPositionSize: 0
      }
    }
  }

  private async calculateRiskMetrics(
    riskSettings: any,
    balances: any[],
    recentTrades: any[],
    tradeParams: any
  ): Promise<any> {
    
    // Calcular saldo total
    const totalBalance = balances.reduce((sum, b) => 
      sum + (b.spot_balance || 0) + (b.futures_balance || 0), 0
    )
    
    // Calcular exposição atual
    const currentExposure = recentTrades
      .filter(t => t.status === 'OPEN' || t.status === 'PENDING')
      .reduce((sum, t) => sum + (t.quantity * t.entry_price), 0)
    
    // Calcular PnL das últimas 24h
    const dailyPnL = recentTrades.reduce((sum, t) => sum + (t.pnl || 0), 0)
    
    // Calcular número de trades perdedores consecutivos
    const sortedTrades = recentTrades
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    
    let consecutiveLosses = 0
    for (const trade of sortedTrades) {
      if (trade.pnl < 0) {
        consecutiveLosses++
      } else {
        break
      }
    }
    
    // Calcular volatilidade do portfólio
    const pnlValues = recentTrades.map(t => t.pnl || 0)
    const avgPnL = pnlValues.reduce((a, b) => a + b, 0) / pnlValues.length
    const variance = pnlValues.reduce((a, b) => a + Math.pow(b - avgPnL, 2), 0) / pnlValues.length
    const volatility = Math.sqrt(variance)
    
    return {
      totalBalance,
      currentExposure,
      exposureRatio: currentExposure / totalBalance,
      dailyPnL,
      dailyPnLRatio: dailyPnL / totalBalance,
      consecutiveLosses,
      volatility,
      proposedExposure: tradeParams.quantity * tradeParams.price,
      tradesLast24h: recentTrades.length
    }
  }

  private generateRiskAssessment(metrics: any, settings: any, tradeParams: any): RiskAssessment {
    let riskScore = 0
    const recommendations: string[] = []
    
    // Avaliar exposição total
    const newExposureRatio = (metrics.currentExposure + metrics.proposedExposure) / metrics.totalBalance
    if (newExposureRatio > settings.max_portfolio_risk / 100) {
      riskScore += 30
      recommendations.push('Exposição do portfólio muito alta')
    }
    
    // Avaliar PnL diário
    if (Math.abs(metrics.dailyPnLRatio) > settings.daily_loss_limit / 100) {
      riskScore += 25
      recommendations.push('Limite de perda diária atingido')
    }
    
    // Avaliar trades perdedores consecutivos
    if (metrics.consecutiveLosses >= settings.max_consecutive_losses) {
      riskScore += 20
      recommendations.push('Muitos trades perdedores consecutivos')
    }
    
    // Avaliar volatilidade
    if (metrics.volatility > settings.max_portfolio_risk * 0.5) {
      riskScore += 15
      recommendations.push('Alta volatilidade detectada')
    }
    
    // Avaliar frequência de trades
    if (metrics.tradesLast24h > settings.max_daily_trades) {
      riskScore += 10
      recommendations.push('Limite de trades diários atingido')
    }
    
    // Determinar nível de risco
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    if (riskScore < 20) riskLevel = 'LOW'
    else if (riskScore < 40) riskLevel = 'MEDIUM'
    else if (riskScore < 70) riskLevel = 'HIGH'
    else riskLevel = 'CRITICAL'
    
    // Calcular tamanho máximo da posição
    const maxPositionSize = this.calculateMaxPositionSize(metrics, settings, riskScore)
    
    return {
      riskLevel,
      riskScore,
      allowTrade: riskScore < 70 && maxPositionSize > 0,
      recommendations: recommendations.length > 0 ? recommendations : ['Risco dentro dos parâmetros'],
      maxPositionSize
    }
  }

  private calculateMaxPositionSize(metrics: any, settings: any, riskScore: number): number {
    const baseMaxSize = metrics.totalBalance * (settings.max_position_size / 100)
    const riskAdjustment = Math.max(0, 1 - (riskScore / 100))
    const volatilityAdjustment = Math.max(0.1, 1 - (metrics.volatility / 100))
    
    return baseMaxSize * riskAdjustment * volatilityAdjustment
  }

  async emergencyStop(userId: string, reason: string): Promise<boolean> {
    try {
      // Atualizar status do bot para parado
      await this.supabase
        .from('bot_status')
        .update({
          is_running: false,
          current_mode: 'EMERGENCY_STOP',
          emergency_stop_reason: reason,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
      
      // Registrar evento de emergência
      await this.supabase
        .from('system_logs')
        .insert({
          user_id: userId,
          log_level: 'CRITICAL',
          component: 'RISK_MANAGER',
          message: `Emergency stop triggered: ${reason}`,
          created_at: new Date().toISOString()
        })
      
      // TODO: Implementar cancelamento de ordens abertas
      
      return true
    } catch (error) {
      console.error('Erro no emergency stop:', error)
      return false
    }
  }

  async monitorLiveRisk(userId: string): Promise<any> {
    try {
      // Buscar posições abertas
      const { data: openTrades } = await this.supabase
        .from('trades')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['OPEN', 'PENDING'])
      
      // Buscar configurações de risco
      const { data: riskSettings } = await this.supabase
        .from('risk_settings')
        .select('*')
        .eq('user_id', userId)
        .single()
      
      if (!openTrades || !riskSettings) {
        return { status: 'NO_DATA', alerts: [] }
      }
      
      const alerts = []
      
      // Verificar stop-loss para cada posição
      for (const trade of openTrades) {
        const currentLoss = Math.abs(trade.pnl || 0)
        const maxLoss = (trade.quantity * trade.entry_price) * (riskSettings.stop_loss_percentage / 100)
        
        if (currentLoss > maxLoss) {
          alerts.push({
            type: 'STOP_LOSS',
            severity: 'HIGH',
            tradeId: trade.id,
            message: `Stop-loss atingido para ${trade.pair}`,
            currentLoss,
            maxLoss
          })
        }
      }
      
      // Verificar limite de drawdown
      const totalPnL = openTrades.reduce((sum, t) => sum + (t.pnl || 0), 0)
      if (totalPnL < -(riskSettings.max_drawdown_amount || 0)) {
        alerts.push({
          type: 'MAX_DRAWDOWN',
          severity: 'CRITICAL',
          message: 'Limite máximo de drawdown atingido',
          currentDrawdown: totalPnL,
          maxDrawdown: riskSettings.max_drawdown_amount
        })
      }
      
      return { status: 'MONITORING', alerts }
      
    } catch (error) {
      console.error('Erro no monitoramento de risco:', error)
      return { status: 'ERROR', alerts: [] }
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
    
    const riskManager = new RiskManager(supabaseUrl, supabaseKey)
    
    if (req.method === 'POST') {
      const { action, userId, tradeParams, reason } = await req.json()
      
      switch (action) {
        case 'assess_risk':
          const assessment = await riskManager.assessRisk(userId, tradeParams)
          return new Response(JSON.stringify({ assessment }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
          
        case 'emergency_stop':
          const stopResult = await riskManager.emergencyStop(userId, reason)
          return new Response(JSON.stringify({ success: stopResult }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
          
        case 'monitor_risk':
          const monitoring = await riskManager.monitorLiveRisk(userId)
          return new Response(JSON.stringify({ monitoring }), {
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