import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUserContext } from "../_shared/supabaseClient.ts";\nimport type { createAdminClient } from "../_shared/supabaseClient.ts";
import { BinanceConnector, loadBinanceCredentials } from "../_shared/binance.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AdminClient = ReturnType<typeof createAdminClient>;
interface TradeOpportunity {
  pair: string;
  bidPrice: number;
  askPrice: number;
  spread: number;
  volume: number;
  estimatedProfit: number;
  confidence: number;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

class TradingEngine {
  constructor(
    private supabase: AdminClient,
    private userId: string,
    private binance: BinanceConnector,
  ) {}

  async findArbitrageOpportunities(): Promise<TradeOpportunity[]> {
    const fiveSecondsAgo = new Date(Date.now() - 5000).toISOString();
    const { data: marketData, error } = await this.supabase
      .from("market_data_cache")
      .select("symbol, bid_price, ask_price, spread, source, updated_at")
      .gte("updated_at", fiveSecondsAgo);

    if (error || !marketData) {
      console.error("Market data fetch error", error);
      return [];
    }

    const opportunities: TradeOpportunity[] = [];
    const grouped = marketData.reduce((acc: Record<string, any[]>, row: any) => {
      if (!acc[row.symbol]) acc[row.symbol] = [];
      acc[row.symbol].push(row);
      return acc;
    }, {} as Record<string, any[]>);

    for (const [pair, entries] of Object.entries(grouped)) {
      if (entries.length < 2) continue;

      const bestBid = Math.max(...entries.map((e) => Number(e.bid_price ?? 0)));
      const bestAsk = Math.min(...entries.map((e) => Number(e.ask_price ?? 0)));

      if (!bestBid || !bestAsk || bestBid <= bestAsk) continue;

      const spread = ((bestBid - bestAsk) / bestAsk) * 100;
      if (spread <= 0.05) continue;

      const volume = Math.min(...entries.map((e) => Number(e.volume_24h ?? 0) || 1));
      const estimatedProfit = (bestBid - bestAsk) * Math.min(volume, 1);

      opportunities.push({
        pair,
        bidPrice: bestBid,
        askPrice: bestAsk,
        spread,
        volume,
        estimatedProfit,
        confidence: this.calculateConfidence(spread, volume),
      });
    }

    return opportunities.sort((a, b) => b.estimatedProfit - a.estimatedProfit);
  }

  private calculateConfidence(spread: number, volume: number): number {
    const spreadScore = Math.min(spread / 0.5, 1);
    const volumeScore = Math.min(volume / 1000, 1);
    return (spreadScore * 0.6 + volumeScore * 0.4) * 100;
  }

  async executeTrade(opportunity: TradeOpportunity): Promise<boolean> {
    try {
      const { data: balances, error: balanceError } = await this.supabase
        .from("account_balances")
        .select("asset, total_balance")
        .eq("user_id", this.userId);

      if (balanceError || !balances?.length) {
        throw new Error("Insufficient account balance data");
      }

      const usdtBalance = balances.find((b: any) => b.asset === "USDT");
      if (!usdtBalance || Number(usdtBalance.total_balance ?? 0) <= 0) {
        throw new Error("No USDT balance available for trading");
      }

      const orderQty = Math.min(opportunity.volume, Number(usdtBalance.total_balance));
      if (orderQty <= 0) {
        throw new Error("Calculated order quantity is zero");
      }

      // Execute spot leg (buy low)
      await this.binance.placeOrder({
        market: "spot",
        symbol: opportunity.pair,
        side: "BUY",
        type: "MARKET",
        quantity: orderQty,
      });

      // Execute futures leg (sell high)
      await this.binance.placeOrder({
        market: "futures",
        symbol: opportunity.pair,
        side: "SELL",
        type: "MARKET",
        quantity: orderQty,
        reduceOnly: false,
        positionSide: "SHORT",
      });

      await this.binance.persistBalances();
      return true;
    } catch (error) {
      console.error("executeTrade error", error);
      return false;
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const context = await requireUserContext(req);
    const credentials = await loadBinanceCredentials(context.admin, context.user.id);
    const connector = new BinanceConnector({ supabase: context.admin, userId: context.user.id, credentials });
    const engine = new TradingEngine(context.admin, context.user.id, connector);

    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const payload = await req.json();
    const action = payload?.action;

    if (action === "find_opportunities") {
      const opportunities = await engine.findArbitrageOpportunities();
      return jsonResponse({ opportunities });
    }

    if (action === "execute_trade") {
      if (!payload?.opportunity) {
        return jsonResponse({ error: "Missing opportunity" }, 400);
      }
      const success = await engine.executeTrade(payload.opportunity as TradeOpportunity);
      return jsonResponse({ success });
    }

    return jsonResponse({ error: "Invalid request" }, 400);
  } catch (error) {
    console.error("trading-engine error", error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "Unauthorized" ? 401 : 500;
    return jsonResponse({ error: message }, status);
  }
});
