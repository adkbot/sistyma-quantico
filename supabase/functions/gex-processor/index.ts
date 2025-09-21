import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient, requireUserContext } from "../_shared/supabaseClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SupabaseClient = ReturnType<typeof createAdminClient>;

type GEXData = {
  symbol: string;
  gex: number;
  dex: number;
  cex: number;
  spotPrice: number;
  regime: "BULLISH" | "BEARISH" | "NEUTRAL";
  regimeStrength: number;
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

class GEXProcessor {
  private supabase: SupabaseClient;
  private apiUrl = "https://api.laevitas.ch";
  private apiKey = Deno.env.get("LAEVITAS_API_KEY");

  constructor(client: SupabaseClient) {
    this.supabase = client;
    if (!this.apiKey) {
      console.warn("LAEVITAS_API_KEY not configured; GEX requests may fail");
    }
  }

  async fetchGEXData(symbol = "BTCUSDT"): Promise<GEXData | null> {
    try {
      const endpoint = `${this.apiUrl}/analytics/gex`;
      const response = await fetch(`${endpoint}?symbol=${symbol}`, {
        headers: this.apiKey ? { "x-api-key": this.apiKey } : undefined,
      });

      if (!response.ok) {
        throw new Error(`Laevitas API error: ${response.status}`);
      }

      const data = await response.json();
      const gexData: GEXData = {
        symbol,
        gex: Number(data.gex ?? 0),
        dex: Number(data.dex ?? 0),
        cex: Number(data.cex ?? 0),
        spotPrice: Number(data.spot_price ?? 0),
        regime: this.determineRegime(Number(data.gex ?? 0), Number(data.dex ?? 0)),
        regimeStrength: this.calculateRegimeStrength(Number(data.gex ?? 0), Number(data.dex ?? 0)),
      };

      const { error } = await this.supabase
        .from("gex_data")
        .upsert({
          symbol,
          gex_value: gexData.gex,
          dex_value: gexData.dex,
          cex_value: gexData.cex,
          spot_price: gexData.spotPrice,
          regime: gexData.regime,
          regime_strength: gexData.regimeStrength,
          raw_data: data,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        console.error("gex_data upsert error", error);
      }

      return gexData;
    } catch (error) {
      console.error("fetchGEXData error", error);
      return null;
    }
  }

  private determineRegime(gex: number, dex: number): "BULLISH" | "BEARISH" | "NEUTRAL" {
    const threshold = 0.1;
    const ratio = gex / (Math.abs(dex) + 1);
    if (ratio > threshold && gex > 0) return "BULLISH";
    if (ratio < -threshold && gex < 0) return "BEARISH";
    return "NEUTRAL";
  }

  private calculateRegimeStrength(gex: number, dex: number): number {
    const maxExpected = 1;
    const normalizedGex = Math.min(Math.abs(gex) / maxExpected, 1);
    const normalizedDex = Math.min(Math.abs(dex) / maxExpected, 1);
    return Math.min((normalizedGex + normalizedDex) * 50, 100);
  }

  async analyzeTrend(symbol: string, hours = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const { data, error } = await this.supabase
      .from("gex_data")
      .select("gex_value, updated_at")
      .eq("symbol", symbol)
      .gte("updated_at", since)
      .order("updated_at", { ascending: true });

    if (error || !data || data.length < 2) {
      return { trend: "INSUFFICIENT_DATA", strength: 0 };
    }

    const first = data[0].gex_value ?? 0;
    const last = data[data.length - 1].gex_value ?? 0;
    const change = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0;

    let trend: string = "NEUTRAL";
    if (change > 5) trend = "INCREASING";
    else if (change < -5) trend = "DECREASING";

    const gexValues = data.map((entry) => entry.gex_value ?? 0);
    const mean = gexValues.reduce((sum, value) => sum + value, 0) / gexValues.length;
    const variance = gexValues.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / gexValues.length;
    const volatility = Math.sqrt(variance);

    return {
      trend,
      change: Number(change.toFixed(2)),
      strength: Math.min(Math.abs(change) * 10, 100),
      volatility: Number(volatility.toFixed(4)),
      dataPoints: data.length,
    };
  }

  async getSignals(symbol: string) {
    const current = await this.fetchGEXData(symbol);
    if (!current) return { signals: [], confidence: 0 };

    const trendData = await this.analyzeTrend(symbol);

    const signals: Array<{ type: string; strength: number; reason: string }> = [];
    let confidence = 0;

    if (current.regime === "BULLISH" && current.regimeStrength > 70) {
      signals.push({ type: "ENTRY_LONG", strength: current.regimeStrength, reason: "Regime GEX bullish" });
      confidence += 30;
    }

    if (current.regime === "BEARISH" && current.regimeStrength > 70) {
      signals.push({ type: "ENTRY_SHORT", strength: current.regimeStrength, reason: "Regime GEX bearish" });
      confidence += 30;
    }

    if (trendData.trend === "INCREASING") {
      signals.push({ type: "MOMENTUM_LONG", strength: trendData.strength, reason: "Tendência GEX crescente" });
      confidence += 20;
    } else if (trendData.trend === "DECREASING") {
      signals.push({ type: "MOMENTUM_SHORT", strength: trendData.strength, reason: "Tendência GEX decrescente" });
      confidence += 20;
    }

    if (current.spotPrice > 0) {
      signals.push({
        type: "SPOT_MONITOR",
        strength: 50,
        reason: `Preço spot ${current.spotPrice}`,
      });
    }

    return {
      signals,
      confidence: Math.min(confidence, 100),
      trend: trendData,
      current,
    };
  }
}

const adminClient = createAdminClient();
const processor = new GEXProcessor(adminClient);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await requireUserContext(req);

    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const { action, symbol = "BTCUSDT" } = await req.json();

    switch (action) {
      case "fetch": {
        const gex = await processor.fetchGEXData(symbol);
        return jsonResponse({ gex });
      }
      case "trend": {
        const trend = await processor.analyzeTrend(symbol);
        return jsonResponse({ trend });
      }
      case "signals": {
        const signals = await processor.getSignals(symbol);
        return jsonResponse({ signals });
      }
      default:
        return jsonResponse({ error: "Invalid action" }, 400);
    }
  } catch (error) {
    console.error("gex-processor error", error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "Unauthorized" ? 401 : 500;
    return jsonResponse({ error: message }, status);
  }
});
