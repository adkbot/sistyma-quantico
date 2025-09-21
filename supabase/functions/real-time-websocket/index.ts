import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient, requireUserContext } from "../_shared/supabaseClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SupabaseClient = ReturnType<typeof createAdminClient>;

type MarketData = {
  symbol: string;
  bidPrice: number;
  askPrice: number;
  spread: number;
  volume24h: number;
  timestamp: number;
};

class RealTimeWebSocketManager {
  private supabase: SupabaseClient;
  private binanceWS: WebSocket | null = null;
  private clientSockets: Set<WebSocket> = new Set();
  private activeSymbols: Set<string> = new Set(["BTCUSDT", "ETHUSDT", "BNBUSDT", "ADAUSDT", "SOLUSDT"]);
  private marketDataCache: Map<string, MarketData> = new Map();
  private isConnecting = false;

  constructor(client: SupabaseClient) {
    this.supabase = client;
  }

  async ensureBinanceConnection() {
    if (this.binanceWS && (this.binanceWS.readyState === WebSocket.OPEN || this.binanceWS.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      const streamNames = Array.from(this.activeSymbols).map((symbol) => `${symbol.toLowerCase()}@ticker`).join("/");
      const wsUrl = `wss://stream.binance.com:9443/ws/${streamNames}`;
      this.binanceWS = new WebSocket(wsUrl);

      this.binanceWS.onopen = () => {
        console.log("Binance WebSocket connected");
        this.broadcast({ type: "connection_status", status: "connected", timestamp: Date.now() });
      };

      this.binanceWS.onmessage = async (event) => {
        try {
          const payload = JSON.parse(event.data);
          await this.processBinanceData(payload);
        } catch (error) {
          console.error("Binance message error", error);
        }
      };

      this.binanceWS.onclose = () => {
        console.warn("Binance WebSocket closed; retrying in 5s");
        this.broadcast({ type: "connection_status", status: "disconnected", timestamp: Date.now() });
        this.binanceWS = null;
        setTimeout(() => this.ensureBinanceConnection(), 5000);
      };

      this.binanceWS.onerror = (error) => {
        console.error("Binance WebSocket error", error);
      };
    } finally {
      this.isConnecting = false;
    }
  }

  private async processBinanceData(data: any): Promise<void> {
    if (data?.e !== "24hrTicker") return;

    const marketData: MarketData = {
      symbol: data.s,
      bidPrice: Number(data.b),
      askPrice: Number(data.a),
      spread: Number(data.a) - Number(data.b),
      volume24h: Number(data.v),
      timestamp: Number(data.E),
    };

    this.marketDataCache.set(data.s, marketData);

    this.broadcast({ type: "market_update", data: marketData });

    const { error } = await this.supabase
      .from("market_data_cache")
      .upsert({
        symbol: marketData.symbol,
        bid_price: marketData.bidPrice,
        ask_price: marketData.askPrice,
        spread: marketData.spread,
        volume_24h: marketData.volume24h,
        source: "BINANCE_RT",
        updated_at: new Date(marketData.timestamp).toISOString(),
      });

    if (error) {
      console.error("market_data_cache upsert error", error);
    }
  }

  private broadcast(message: unknown) {
    const payload = JSON.stringify(message);
    for (const socket of Array.from(this.clientSockets)) {
      try {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(payload);
        } else {
          this.clientSockets.delete(socket);
        }
      } catch (error) {
        console.error("broadcast error", error);
        this.clientSockets.delete(socket);
      }
    }
  }

  addClientSocket(socket: WebSocket) {
    this.clientSockets.add(socket);

    for (const data of this.marketDataCache.values()) {
      socket.send(JSON.stringify({ type: "market_update", data }));
    }

    socket.onclose = () => {
      this.clientSockets.delete(socket);
    };

    socket.onerror = () => {
      this.clientSockets.delete(socket);
    };
  }

  getArbitrageOpportunities() {
    const opportunities: Array<{
      symbol: string;
      bidPrice: number;
      askPrice: number;
      spread: number;
      spreadPercentage: number;
      volume24h: number;
      confidence: number;
      estimatedProfit: number;
      timestamp: number;
    }> = [];

    for (const data of this.marketDataCache.values()) {
      if (!data.bidPrice || data.bidPrice <= 0) continue;
      const spreadPercentage = (data.spread / data.bidPrice) * 100;
      if (spreadPercentage <= 0.01) continue;

      opportunities.push({
        symbol: data.symbol,
        bidPrice: data.bidPrice,
        askPrice: data.askPrice,
        spread: data.spread,
        spreadPercentage,
        volume24h: data.volume24h,
        confidence: Math.min(95, 50 + spreadPercentage * 10),
        estimatedProfit: data.spread * 1000,
        timestamp: data.timestamp,
      });
    }

    return opportunities.sort((a, b) => b.spreadPercentage - a.spreadPercentage);
  }
}

const adminClient = createAdminClient();
const manager = new RealTimeWebSocketManager(adminClient);
manager.ensureBinanceConnection();

serve(async (req) => {
  const upgrade = req.headers.get("upgrade") ?? "";

  if (upgrade.toLowerCase() !== "websocket") {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      await requireUserContext(req);

      if (req.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405);
      }

      const { action } = await req.json();
      switch (action) {
        case "get_opportunities": {
          const opportunities = manager.getArbitrageOpportunities();
          return jsonResponse({ success: true, opportunities });
        }
        default:
          return jsonResponse({ success: false, error: "Invalid action" }, 400);
      }
    } catch (error) {
      console.error("real-time-websocket REST error", error);
      const message = error instanceof Error ? error.message : "Unexpected error";
      const status = message === "Unauthorized" ? 401 : 500;
      return jsonResponse({ success: false, error: message }, status);
    }
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  manager.addClientSocket(socket);
  socket.onopen = () => manager.ensureBinanceConnection();
  return response;
});
