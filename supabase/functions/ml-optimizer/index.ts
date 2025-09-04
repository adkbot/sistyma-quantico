import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MLModel {
  modelType: string
  version: string
  parameters: any
  performance: number
  learningRate: number
  accuracyRate: number
}

class MLOptimizer {
  private supabase: any
  private currentModel: MLModel | null = null
  
  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey)
  }

  async loadModel(userId: string): Promise<MLModel | null> {
    try {
      const { data: modelData } = await this.supabase
        .from('ai_settings')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single()
      
      if (modelData) {
        this.currentModel = {
          modelType: modelData.model_type,
          version: modelData.model_version,
          parameters: modelData.training_parameters,
          performance: modelData.performance_score,
          learningRate: modelData.learning_rate,
          accuracyRate: modelData.prediction_accuracy
        }
      }
      
      return this.currentModel
    } catch (error) {
      console.error('Erro ao carregar modelo:', error)
      return null
    }
  }

  async trainWithTradeData(userId: string): Promise<any> {
    try {
      // Buscar trades recentes para treinamento
      const { data: trades } = await this.supabase
        .from('trades')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Últimos 7 dias
        .order('created_at', { ascending: false })
        .limit(1000)
      
      if (!trades || trades.length < 10) {
        return { success: false, reason: 'Dados insuficientes para treinamento' }
      }
      
      // Preparar dados de treinamento
      const trainingData = this.prepareTrainingData(trades)
      
      // Aplicar algoritmo de Reinforcement Learning
      const modelUpdate = await this.reinforcementLearning(trainingData)
      
      // Atualizar modelo no banco
      await this.supabase
        .from('ai_settings')
        .upsert({
          user_id: userId,
          model_type: 'REINFORCEMENT_LEARNING',
          model_version: this.generateModelVersion(),
          training_parameters: modelUpdate.parameters,
          performance_score: modelUpdate.performance,
          learning_rate: modelUpdate.learningRate,
          prediction_accuracy: modelUpdate.accuracy,
          training_data_size: trades.length,
          last_training: new Date().toISOString(),
          is_active: true
        })
      
      return {
        success: true,
        performance: modelUpdate.performance,
        accuracy: modelUpdate.accuracy,
        trainingDataSize: trades.length
      }
      
    } catch (error) {
      console.error('Erro no treinamento:', error)
      return { success: false, reason: error.message }
    }
  }

  private prepareTrainingData(trades: any[]): any[] {
    return trades.map(trade => ({
      // Features (entradas)
      spread: trade.spread || 0,
      volume: trade.quantity || 0,
      aiConfidence: trade.ai_confidence || 0,
      executionTime: trade.execution_time_ms || 0,
      slippage: trade.slippage || 0,
      
      // Target (resultado)
      success: trade.pnl > 0,
      pnl: trade.pnl || 0,
      actualSlippage: trade.slippage || 0
    }))
  }

  private async reinforcementLearning(trainingData: any[]): Promise<any> {
    // Implementação simplificada de Q-Learning
    const qTable = new Map()
    const learningRate = 0.1
    const discountFactor = 0.95
    
    let totalReward = 0
    let successfulTrades = 0
    
    for (const data of trainingData) {
      // Estado baseado em spread e volume
      const state = this.discretizeState(data.spread, data.volume, data.aiConfidence)
      
      // Ação: operar ou não operar
      const action = data.success ? 'TRADE' : 'SKIP'
      
      // Recompensa baseada no PnL
      const reward = data.success ? (data.pnl * 10) : -Math.abs(data.pnl * 5)
      
      // Atualizar Q-Table
      const qKey = `${state}_${action}`
      const currentQ = qTable.get(qKey) || 0
      const maxFutureQ = this.getMaxQValue(qTable, state)
      
      const newQ = currentQ + learningRate * (reward + discountFactor * maxFutureQ - currentQ)
      qTable.set(qKey, newQ)
      
      totalReward += reward
      if (data.success) successfulTrades++
    }
    
    const accuracy = (successfulTrades / trainingData.length) * 100
    const avgReward = totalReward / trainingData.length
    
    return {
      parameters: Object.fromEntries(qTable),
      performance: Math.max(0, Math.min(100, avgReward + 50)), // Normalizar para 0-100
      learningRate,
      accuracy
    }
  }

  private discretizeState(spread: number, volume: number, confidence: number): string {
    const spreadBucket = spread < 0.1 ? 'LOW' : spread < 0.3 ? 'MED' : 'HIGH'
    const volumeBucket = volume < 100 ? 'LOW' : volume < 1000 ? 'MED' : 'HIGH'
    const confidenceBucket = confidence < 30 ? 'LOW' : confidence < 70 ? 'MED' : 'HIGH'
    
    return `${spreadBucket}_${volumeBucket}_${confidenceBucket}`
  }

  private getMaxQValue(qTable: Map<string, number>, state: string): number {
    const actions = ['TRADE', 'SKIP']
    let maxQ = -Infinity
    
    for (const action of actions) {
      const qKey = `${state}_${action}`
      const qValue = qTable.get(qKey) || 0
      if (qValue > maxQ) maxQ = qValue
    }
    
    return maxQ === -Infinity ? 0 : maxQ
  }

  async predictOptimalAction(spread: number, volume: number, confidence: number): Promise<any> {
    try {
      if (!this.currentModel) {
        return { action: 'SKIP', confidence: 0, reason: 'Modelo não carregado' }
      }
      
      const state = this.discretizeState(spread, volume, confidence)
      const qTable = new Map(Object.entries(this.currentModel.parameters))
      
      const tradeQ = qTable.get(`${state}_TRADE`) || 0
      const skipQ = qTable.get(`${state}_SKIP`) || 0
      
      const action = tradeQ > skipQ ? 'TRADE' : 'SKIP'
      const actionConfidence = Math.abs(tradeQ - skipQ) * 10 // Amplificar diferença
      
      return {
        action,
        confidence: Math.min(actionConfidence, 100),
        qValues: { trade: tradeQ, skip: skipQ },
        state
      }
      
    } catch (error) {
      console.error('Erro na predição:', error)
      return { action: 'SKIP', confidence: 0, reason: error.message }
    }
  }

  private generateModelVersion(): string {
    return `v${Date.now()}`
  }

  async optimizeParameters(userId: string): Promise<any> {
    try {
      // Buscar performance histórica
      const { data: trades } = await this.supabase
        .from('trades')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      
      if (!trades || trades.length < 50) {
        return { success: false, reason: 'Dados insuficientes para otimização' }
      }
      
      // Calcular métricas de performance
      const totalTrades = trades.length
      const successfulTrades = trades.filter(t => t.pnl > 0).length
      const totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0)
      const avgExecutionTime = trades.reduce((sum, t) => sum + (t.execution_time_ms || 0), 0) / totalTrades
      
      // Otimizar parâmetros baseado na performance
      const newLearningRate = successfulTrades / totalTrades > 0.6 ? 0.05 : 0.15
      const newPerformanceScore = (successfulTrades / totalTrades) * 100
      
      await this.supabase
        .from('ai_settings')
        .update({
          learning_rate: newLearningRate,
          performance_score: newPerformanceScore,
          prediction_accuracy: (successfulTrades / totalTrades) * 100,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('is_active', true)
      
      return {
        success: true,
        metrics: {
          totalTrades,
          successRate: (successfulTrades / totalTrades) * 100,
          totalPnL,
          avgExecutionTime,
          newLearningRate,
          newPerformanceScore
        }
      }
      
    } catch (error) {
      console.error('Erro na otimização:', error)
      return { success: false, reason: error.message }
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
    
    const optimizer = new MLOptimizer(supabaseUrl, supabaseKey)
    
    if (req.method === 'POST') {
      const { action, userId, spread, volume, confidence } = await req.json()
      
      switch (action) {
        case 'load_model':
          const model = await optimizer.loadModel(userId)
          return new Response(JSON.stringify({ model }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
          
        case 'train_model':
          const trainingResult = await optimizer.trainWithTradeData(userId)
          return new Response(JSON.stringify({ trainingResult }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
          
        case 'predict':
          const prediction = await optimizer.predictOptimalAction(spread, volume, confidence)
          return new Response(JSON.stringify({ prediction }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
          
        case 'optimize':
          const optimization = await optimizer.optimizeParameters(userId)
          return new Response(JSON.stringify({ optimization }), {
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