import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MarketData {
  symbol: string;
  bidPrice: number;
  askPrice: number;
  spread: number;
  volume24h: number;
  timestamp: number;
}

class RealTimeWebSocketManager {
  private supabase: any;
  private binanceWS: WebSocket | null = null;
  private clientSockets: Set<WebSocket> = new Set();
  private activeSymbols: Set<string> = new Set(['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'DOTUSDT']);
  private marketDataCache: Map<string, MarketData> = new Map();

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async initializeBinanceWebSocket(): Promise<void> {
    try {
      // Stream de ticker 24hr para múltiplos símbolos
      const streamNames = Array.from(this.activeSymbols).map(symbol => 
        `${symbol.toLowerCase()}@ticker`
      ).join('/');

      const wsUrl = `wss://stream.binance.com:9443/ws/${streamNames}`;
      
      this.binanceWS = new WebSocket(wsUrl);

      this.binanceWS.onopen = () => {
        console.log('Conexão WebSocket Binance estabelecida');
        this.broadcastToClients({ 
          type: 'connection_status', 
          status: 'connected',
          timestamp: Date.now()
        });
      };

      this.binanceWS.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          await this.processBinanceData(data);
        } catch (error) {
          console.error('Erro ao processar dados Binance:', error);
        }
      };

      this.binanceWS.onclose = () => {
        console.log('Conexão WebSocket Binance fechada');
        this.broadcastToClients({ 
          type: 'connection_status', 
          status: 'disconnected',
          timestamp: Date.now()
        });
        
        // Reconectar após 5 segundos
        setTimeout(() => this.initializeBinanceWebSocket(), 5000);
      };

      this.binanceWS.onerror = (error) => {
        console.error('Erro WebSocket Binance:', error);
      };

    } catch (error) {
      console.error('Erro ao inicializar WebSocket Binance:', error);
    }
  }

  async processBinanceData(data: any): Promise<void> {
    if (data.e === '24hrTicker') {
      const marketData: MarketData = {
        symbol: data.s,
        bidPrice: parseFloat(data.b),
        askPrice: parseFloat(data.a),
        spread: parseFloat(data.a) - parseFloat(data.b),
        volume24h: parseFloat(data.v),
        timestamp: data.E
      };

      // Atualiza cache local
      this.marketDataCache.set(data.s, marketData);

      // Envia para clientes conectados
      this.broadcastToClients({
        type: 'market_update',
        data: marketData
      });

      // Atualiza banco de dados
      await this.updateMarketDataCache(marketData);
    }
  }

  async updateMarketDataCache(marketData: MarketData): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('market_data_cache')
        .upsert({
          symbol: marketData.symbol,
          bid_price: marketData.bidPrice,
          ask_price: marketData.askPrice,
          spread: marketData.spread,
          volume_24h: marketData.volume24h,
          updated_at: new Date(marketData.timestamp).toISOString()
        }, {
          onConflict: 'symbol'
        });

      if (error) {
        console.error('Erro ao atualizar cache de dados de mercado:', error);
      }
    } catch (error) {
      console.error('Erro na atualização do banco:', error);
    }
  }

  broadcastToClients(message: any): void {
    const messageStr = JSON.stringify(message);
    
    this.clientSockets.forEach(socket => {
      try {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(messageStr);
        }
      } catch (error) {
        console.error('Erro ao enviar mensagem para cliente:', error);
        this.clientSockets.delete(socket);
      }
    });
  }

  addClientSocket(socket: WebSocket): void {
    this.clientSockets.add(socket);
    
    // Envia dados atuais para o novo cliente
    this.marketDataCache.forEach(data => {
      socket.send(JSON.stringify({
        type: 'market_update',
        data
      }));
    });

    socket.onclose = () => {
      this.clientSockets.delete(socket);
    };

    socket.onerror = () => {
      this.clientSockets.delete(socket);
    };
  }

  async getArbitrageOpportunities(): Promise<any[]> {
    const opportunities: any[] = [];
    
    for (const [symbol, data] of this.marketDataCache) {
      if (data.spread > 0.001) { // Spread mínimo para ser considerado
        const spreadPercentage = (data.spread / data.bidPrice) * 100;
        
        if (spreadPercentage > 0.01) { // 0.01% mínimo
          opportunities.push({
            symbol,
            bidPrice: data.bidPrice,
            askPrice: data.askPrice,
            spread: data.spread,
            spreadPercentage,
            volume24h: data.volume24h,
            confidence: Math.min(95, 50 + (spreadPercentage * 10)),
            estimatedProfit: data.spread * 1000, // Para 1000 USDT
            timestamp: data.timestamp
          });
        }
      }
    }

    return opportunities.sort((a, b) => b.spreadPercentage - a.spreadPercentage);
  }
}

serve(async (req) => {
  const upgrade = req.headers.get("upgrade") || "";
  
  if (upgrade.toLowerCase() !== "websocket") {
    // Handle CORS preflight for non-WebSocket requests
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // REST API endpoints
    if (req.method === 'POST') {
      try {
        const { action } = await req.json();
        const manager = new RealTimeWebSocketManager(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        switch (action) {
          case 'get_opportunities':
            const opportunities = await manager.getArbitrageOpportunities();
            return new Response(JSON.stringify({
              success: true,
              opportunities
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });

          default:
            return new Response(JSON.stringify({
              success: false,
              error: 'Invalid action'
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400
            });
        }
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error.message
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        });
      }
    }

    return new Response("Expected WebSocket connection", { status: 400 });
  }

  // WebSocket connection
  const { socket, response } = Deno.upgradeWebSocket(req);
  
  const manager = new RealTimeWebSocketManager(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Inicializa conexão Binance se ainda não existe
  if (!manager['binanceWS']) {
    await manager.initializeBinanceWebSocket();
  }

  // Adiciona cliente à lista
  manager.addClientSocket(socket);

  socket.onopen = () => {
    console.log("Cliente WebSocket conectado");
  };

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      
      if (message.type === 'ping') {
        socket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      }
    } catch (error) {
      console.error('Erro ao processar mensagem do cliente:', error);
    }
  };

  return response;
});