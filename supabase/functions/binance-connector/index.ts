import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

class BinanceConnector {
  private supabase: any
  private apiKey: string
  private secretKey: string
  private baseUrl = 'https://api.binance.com'
  
  constructor(supabaseUrl: string, supabaseKey: string, apiKey: string, secretKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey)
    this.apiKey = apiKey
    this.secretKey = secretKey
  }

  private async createSignature(queryString: string): Promise<string> {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(this.secretKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(queryString)
    )
    
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }

  async getAccountBalances(): Promise<any> {
    try {
      const timestamp = Date.now()
      const queryString = `timestamp=${timestamp}`
      const signature = await this.createSignature(queryString)
      
      const response = await fetch(`${this.baseUrl}/api/v3/account?${queryString}&signature=${signature}`, {
        headers: {
          'X-MBX-APIKEY': this.apiKey
        }
      })
      
      const data = await response.json()
      
      // Atualizar saldos no banco
      for (const balance of data.balances) {
        if (parseFloat(balance.free) > 0 || parseFloat(balance.locked) > 0) {
          await this.supabase
            .from('account_balances')
            .upsert({
              user_id: (await this.supabase.auth.getUser()).data.user?.id,
              exchange: 'BINANCE',
              asset: balance.asset,
              spot_balance: parseFloat(balance.free),
              futures_balance: parseFloat(balance.locked),
              updated_at: new Date().toISOString()
            })
        }
      }
      
      return data
    } catch (error) {
      console.error('Erro ao buscar saldos:', error)
      throw error
    }
  }

  async getOrderBook(symbol: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v3/depth?symbol=${symbol}&limit=20`)
      const data = await response.json()
      
      // Atualizar cache de dados de mercado
      const bestBid = parseFloat(data.bids[0][0])
      const bestAsk = parseFloat(data.asks[0][0])
      const bidQty = parseFloat(data.bids[0][1])
      const askQty = parseFloat(data.asks[0][1])
      
      await this.supabase
        .from('market_data_cache')
        .upsert({
          exchange: 'BINANCE',
          symbol,
          bid_price: bestBid,
          ask_price: bestAsk,
          bid_quantity: bidQty,
          ask_quantity: askQty,
          spread: ((bestAsk - bestBid) / bestBid) * 100,
          updated_at: new Date().toISOString()
        })
      
      return data
    } catch (error) {
      console.error('Erro ao buscar order book:', error)
      throw error
    }
  }

  async placeOrder(symbol: string, side: string, type: string, quantity: number, price?: number): Promise<any> {
    try {
      const timestamp = Date.now()
      let queryString = `symbol=${symbol}&side=${side}&type=${type}&quantity=${quantity}&timestamp=${timestamp}`
      
      if (price && type === 'LIMIT') {
        queryString += `&price=${price}&timeInForce=IOC` // Immediate or Cancel
      }
      
      const signature = await this.createSignature(queryString)
      
      const response = await fetch(`${this.baseUrl}/api/v3/order`, {
        method: 'POST',
        headers: {
          'X-MBX-APIKEY': this.apiKey,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `${queryString}&signature=${signature}`
      })
      
      const data = await response.json()
      
      // Registrar ordem no banco
      await this.supabase
        .from('trades')
        .insert({
          user_id: (await this.supabase.auth.getUser()).data.user?.id,
          exchange: 'BINANCE',
          pair: symbol,
          side,
          type,
          quantity,
          price: price || 0,
          status: data.status,
          order_id: data.orderId,
          client_order_id: data.clientOrderId,
          execution_time_ms: Date.now() - timestamp
        })
      
      return data
    } catch (error) {
      console.error('Erro ao executar ordem:', error)
      throw error
    }
  }

  async syncBalances(): Promise<void> {
    try {
      // Sincronizar saldos spot
      const spotBalances = await this.getAccountBalances()
      
      // Sincronizar saldos futuros
      const futuresResponse = await fetch(`${this.baseUrl}/fapi/v2/account`, {
        headers: {
          'X-MBX-APIKEY': this.apiKey
        }
      })
      
      const futuresData = await futuresResponse.json()
      
      for (const asset of futuresData.assets) {
        if (parseFloat(asset.walletBalance) > 0) {
          await this.supabase
            .from('account_balances')
            .upsert({
              user_id: (await this.supabase.auth.getUser()).data.user?.id,
              exchange: 'BINANCE_FUTURES',
              asset: asset.asset,
              futures_balance: parseFloat(asset.walletBalance),
              updated_at: new Date().toISOString()
            })
        }
      }
    } catch (error) {
      console.error('Erro na sincronização de saldos:', error)
      throw error
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
    const binanceApiKey = Deno.env.get('BINANCE_API_KEY')!
    const binanceSecret = Deno.env.get('BINANCE_SECRET_KEY')!
    
    const connector = new BinanceConnector(supabaseUrl, supabaseKey, binanceApiKey, binanceSecret)
    
    if (req.method === 'POST') {
      const { action, ...params } = await req.json()
      
      switch (action) {
        case 'get_balances':
          const balances = await connector.getAccountBalances()
          return new Response(JSON.stringify({ balances }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
          
        case 'get_orderbook':
          const orderbook = await connector.getOrderBook(params.symbol)
          return new Response(JSON.stringify({ orderbook }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
          
        case 'place_order':
          const order = await connector.placeOrder(
            params.symbol,
            params.side,
            params.type,
            params.quantity,
            params.price
          )
          return new Response(JSON.stringify({ order }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
          
        case 'sync_balances':
          await connector.syncBalances()
          return new Response(JSON.stringify({ success: true }), {
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