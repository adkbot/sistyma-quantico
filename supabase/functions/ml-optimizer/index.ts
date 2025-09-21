import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUserContext } from "../_shared/supabaseClient.ts";
import type { createAdminClient } from "../_shared/supabaseClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type SupabaseClient = ReturnType<typeof createAdminClient>;

type MLModel = {
  modelType: string;
  version: string;
  parameters: Record<string, number>;
  performance: number;
  learningRate: number;
  accuracyRate: number;
};

class MLOptimizer {
  private supabase: SupabaseClient;
  private currentModel: MLModel | null = null;

  constructor(client: SupabaseClient) {
    this.supabase = client;
  }

  async loadModel(userId: string): Promise<MLModel | null> {
    const { data, error } = await this.supabase
      .from("ai_settings")
      .select("model_type, model_version, training_parameters, performance_score, learning_rate, prediction_accuracy")
      .eq("user_id", userId)
      .eq("is_active", true)
      .single();

    if (error) {
      console.error("loadModel error", error);
      return null;
    }

    if (data) {
      this.currentModel = {
        modelType: data.model_type,
        version: data.model_version,
        parameters: data.training_parameters ?? {},
        performance: data.performance_score ?? 0,
        learningRate: data.learning_rate ?? 0,
        accuracyRate: data.prediction_accuracy ?? 0,
      };
    }

    return this.currentModel;
  }

  async trainWithTradeData(userId: string) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: trades, error } = await this.supabase
      .from("trades")
      .select("pnl, quantity, ai_confidence, execution_time_ms, slippage, created_at")
      .eq("user_id", userId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) {
      console.error("trainWithTradeData error", error);
      return { success: false, reason: error.message };
    }

    if (!trades || trades.length < 10) {
      return { success: false, reason: "Dados insuficientes para treinamento" };
    }

    const trainingData = this.prepareTrainingData(trades);
    const modelUpdate = await this.reinforcementLearning(trainingData);

    const { error: upsertError } = await this.supabase
      .from("ai_settings")
      .upsert({
        user_id: userId,
        model_type: "REINFORCEMENT_LEARNING",
        model_version: this.generateModelVersion(),
        training_parameters: modelUpdate.parameters,
        performance_score: modelUpdate.performance,
        learning_rate: modelUpdate.learningRate,
        prediction_accuracy: modelUpdate.accuracy,
        training_data_size: trades.length,
        last_training: new Date().toISOString(),
        is_active: true,
      });

    if (upsertError) {
      console.error("trainWithTradeData upsert error", upsertError);
      return { success: false, reason: upsertError.message };
    }

    this.currentModel = {
      modelType: "REINFORCEMENT_LEARNING",
      version: this.generateModelVersion(),
      parameters: modelUpdate.parameters,
      performance: modelUpdate.performance,
      learningRate: modelUpdate.learningRate,
      accuracyRate: modelUpdate.accuracy,
    };

    return {
      success: true,
      performance: modelUpdate.performance,
      accuracy: modelUpdate.accuracy,
      trainingDataSize: trades.length,
    };
  }

  private prepareTrainingData(trades: any[]) {
    return trades.map((trade) => ({
      spread: trade.spread ?? 0,
      volume: trade.quantity ?? 0,
      aiConfidence: trade.ai_confidence ?? 0,
      executionTime: trade.execution_time_ms ?? 0,
      slippage: trade.slippage ?? 0,
      success: (trade.pnl ?? 0) > 0,
      pnl: trade.pnl ?? 0,
      actualSlippage: trade.slippage ?? 0,
    }));
  }

  private async reinforcementLearning(trainingData: any[]) {
    const qTable = new Map<string, number>();
    const learningRate = 0.1;
    const discountFactor = 0.95;

    let totalReward = 0;
    let successfulTrades = 0;

    for (const data of trainingData) {
      const state = this.discretizeState(data.spread, data.volume, data.aiConfidence);
      const action = data.success ? "TRADE" : "SKIP";
      const reward = data.success ? data.pnl * 10 : -Math.abs(data.pnl * 5);

      const key = `${state}_${action}`;
      const currentQ = qTable.get(key) ?? 0;
      const maxFutureQ = this.getMaxQValue(qTable, state);
      const updatedQ = currentQ + learningRate * (reward + discountFactor * maxFutureQ - currentQ);
      qTable.set(key, updatedQ);

      totalReward += reward;
      if (data.success) successfulTrades += 1;
    }

    const accuracy = (successfulTrades / trainingData.length) * 100;
    const avgReward = totalReward / trainingData.length;

    return {
      parameters: Object.fromEntries(qTable),
      performance: Math.max(0, Math.min(100, avgReward + 50)),
      learningRate,
      accuracy,
    };
  }

  private discretizeState(spread: number, volume: number, confidence: number) {
    const spreadBucket = Math.min(Math.floor(spread * 10), 10);
    const volumeBucket = Math.min(Math.floor(volume / 100), 10);
    const confidenceBucket = Math.min(Math.floor(confidence / 10), 10);
    return `${spreadBucket}_${volumeBucket}_${confidenceBucket}`;
  }

  private getMaxQValue(qTable: Map<string, number>, state: string) {
    const tradeKey = `${state}_TRADE`;
    const skipKey = `${state}_SKIP`;
    return Math.max(qTable.get(tradeKey) ?? 0, qTable.get(skipKey) ?? 0);
  }

  private generateModelVersion() {
    return `v${Date.now()}`;
  }

  async optimizeParameters(userId: string) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: trades, error } = await this.supabase
      .from("trades")
      .select("pnl, execution_time_ms")
      .eq("user_id", userId)
      .gte("created_at", thirtyDaysAgo);

    if (error) {
      console.error("optimizeParameters error", error);
      return { success: false, reason: error.message };
    }

    if (!trades || trades.length < 50) {
      return { success: false, reason: "Dados insuficientes para otimização" };
    }

    const totalTrades = trades.length;
    const successfulTrades = trades.filter((t) => (t.pnl ?? 0) > 0).length;
    const totalPnL = trades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
    const avgExecutionTime = trades.reduce((sum, t) => sum + (t.execution_time_ms ?? 0), 0) / totalTrades;
    const successRate = (successfulTrades / totalTrades) * 100;
    const newLearningRate = successRate > 60 ? 0.05 : 0.15;

    const { error: updateError } = await this.supabase
      .from("ai_settings")
      .update({
        learning_rate: newLearningRate,
        performance_score: successRate,
        prediction_accuracy: successRate,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("is_active", true);

    if (updateError) {
      console.error("optimizeParameters update error", updateError);
      return { success: false, reason: updateError.message };
    }

    return {
      success: true,
      metrics: {
        totalTrades,
        successRate,
        totalPnL,
        avgExecutionTime,
        newLearningRate,
        newPerformanceScore: successRate,
      },
    };
  }

  predictOptimalAction(spread: number, volume: number, confidence: number) {
    const state = this.discretizeState(spread, volume, confidence);
    const qTable = new Map(Object.entries(this.currentModel?.parameters ?? {}));
    const tradeScore = qTable.get(`${state}_TRADE`) ?? 0;
    const skipScore = qTable.get(`${state}_SKIP`) ?? 0;

    if (tradeScore === 0 && skipScore === 0) {
      return { action: "WAIT", confidence: 0 };
    }

    return tradeScore >= skipScore
      ? { action: "TRADE", confidence: tradeScore }
      : { action: "SKIP", confidence: skipScore };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const context = await requireUserContext(req);
    const optimizer = new MLOptimizer(context.userClient);

    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const { action, userId = context.user.id, spread, volume, confidence } = await req.json();

    switch (action) {
      case "load_model": {
        const model = await optimizer.loadModel(userId);
        return jsonResponse({ model });
      }
      case "train_model": {
        const trainingResult = await optimizer.trainWithTradeData(userId);
        return jsonResponse({ trainingResult });
      }
      case "predict": {
        if (spread === undefined || volume === undefined || confidence === undefined) {
          return jsonResponse({ error: "Missing prediction parameters" }, 400);
        }
        await optimizer.loadModel(userId);
        const prediction = optimizer.predictOptimalAction(spread, volume, confidence);
        return jsonResponse({ prediction });
      }
      case "optimize": {
        const optimization = await optimizer.optimizeParameters(userId);
        return jsonResponse({ optimization });
      }
      default:
        return jsonResponse({ error: "Invalid action" }, 400);
    }
  } catch (error) {
    console.error("ml-optimizer error", error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "Unauthorized" ? 401 : 500;
    return jsonResponse({ error: message }, status);
  }
});


