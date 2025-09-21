import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUserContext } from "../_shared/supabaseClient.ts";
import type { createAdminClient } from "../_shared/supabaseClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SupabaseClient = ReturnType<typeof createAdminClient>;

type RiskAssessment = {
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  riskScore: number;
  allowTrade: boolean;
  recommendations: string[];
  maxPositionSize: number;
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

class RiskManager {
  constructor(private supabase: SupabaseClient) {}

  async assessRisk(userId: string, tradeParams: Record<string, number>): Promise<RiskAssessment> {
    const { data: riskSettings, error: riskError } = await this.supabase
      .from("risk_settings")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (riskError || !riskSettings) {
      throw new Error("Configurações de risco não encontradas");
    }

    const { data: balances, error: balancesError } = await this.supabase
      .from("account_balances")
      .select("spot_balance, futures_balance")
      .eq("user_id", userId);

    if (balancesError) {
      throw new Error(balancesError.message);
    }

    const { data: recentTrades, error: tradesError } = await this.supabase
      .from("trades")
      .select("pnl, quantity, entry_price, status, created_at")
      .eq("user_id", userId)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (tradesError) {
      throw new Error(tradesError.message);
    }

    const metrics = this.calculateRiskMetrics(
      riskSettings,
      balances ?? [],
      recentTrades ?? [],
      tradeParams,
    );

    return this.generateRiskAssessment(metrics, riskSettings, tradeParams);
  }

  private calculateRiskMetrics(
    riskSettings: Record<string, number>,
    balances: any[],
    recentTrades: any[],
    tradeParams: Record<string, number>,
  ) {
    const totalBalance = balances.reduce(
      (sum, balance) => sum + Number(balance.spot_balance ?? 0) + Number(balance.futures_balance ?? 0),
      0,
    );

    const currentExposure = recentTrades
      .filter((trade) => trade.status === "OPEN" || trade.status === "PENDING")
      .reduce((sum, trade) => sum + Number(trade.quantity ?? 0) * Number(trade.entry_price ?? 0), 0);

    const dailyPnL = recentTrades.reduce((sum, trade) => sum + Number(trade.pnl ?? 0), 0);

    const sortedTrades = [...recentTrades].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    let consecutiveLosses = 0;
    for (const trade of sortedTrades) {
      if ((trade.pnl ?? 0) < 0) consecutiveLosses += 1;
      else break;
    }

    const pnlValues = recentTrades.map((trade) => Number(trade.pnl ?? 0));
    const avgPnL = pnlValues.length > 0 ? pnlValues.reduce((a, b) => a + b, 0) / pnlValues.length : 0;
    const variance = pnlValues.length > 0
      ? pnlValues.reduce((acc, value) => acc + Math.pow(value - avgPnL, 2), 0) / pnlValues.length
      : 0;
    const volatility = Math.sqrt(variance);

    const proposedExposure = Number(tradeParams.quantity ?? 0) * Number(tradeParams.price ?? 0);

    return {
      totalBalance,
      currentExposure,
      exposureRatio: totalBalance > 0 ? currentExposure / totalBalance : 0,
      dailyPnL,
      dailyPnLRatio: totalBalance > 0 ? dailyPnL / totalBalance : 0,
      consecutiveLosses,
      volatility,
      proposedExposure,
      tradesLast24h: recentTrades.length,
      riskSettings,
    };
  }

  private generateRiskAssessment(metrics: any, settings: any, tradeParams: Record<string, number>): RiskAssessment {
    let riskScore = 0;
    const recommendations: string[] = [];

    const newExposureRatio = metrics.totalBalance > 0
      ? (metrics.currentExposure + metrics.proposedExposure) / metrics.totalBalance
      : 1;

    if (newExposureRatio > (settings.max_portfolio_risk ?? 10) / 100) {
      riskScore += 30;
      recommendations.push("Exposição do portfólio muito alta");
    }

    if (Math.abs(metrics.dailyPnLRatio) > (settings.daily_loss_limit ?? 5) / 100) {
      riskScore += 25;
      recommendations.push("Limite de perda diária atingido");
    }

    if (metrics.consecutiveLosses >= (settings.max_consecutive_losses ?? 3)) {
      riskScore += 20;
      recommendations.push("Muitos trades perdedores consecutivos");
    }

    if (metrics.volatility > (settings.max_portfolio_risk ?? 10) * 0.5) {
      riskScore += 15;
      recommendations.push("Alta volatilidade detectada");
    }

    if (metrics.tradesLast24h > (settings.max_daily_trades ?? 20)) {
      riskScore += 10;
      recommendations.push("Limite de trades diários atingido");
    }

    let riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";
    if (riskScore >= 70) riskLevel = "CRITICAL";
    else if (riskScore >= 50) riskLevel = "HIGH";
    else if (riskScore >= 30) riskLevel = "MEDIUM";

    const maxPositionSizePercentage = settings.max_position_size_percentage ?? 10;
    const maxPositionSize = metrics.totalBalance * (maxPositionSizePercentage / 100);

    const allowTrade = riskLevel !== "CRITICAL" && riskScore < 80;

    if (!allowTrade) {
      recommendations.push("Revisar parâmetros de risco antes de continuar");
    }

    return {
      riskLevel,
      riskScore,
      allowTrade,
      recommendations,
      maxPositionSize,
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const context = await requireUserContext(req);
    const manager = new RiskManager(context.userClient);

    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const payload = await req.json();
    const tradeParams = payload?.tradeParams ?? {};
    const assessment = await manager.assessRisk(context.user.id, tradeParams);
    return jsonResponse({ assessment });
  } catch (error) {
    console.error("risk-manager error", error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "Unauthorized" ? 401 : 500;
    return jsonResponse({ error: message }, status);
  }
});
