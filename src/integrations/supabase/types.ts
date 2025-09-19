export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      account_balances: {
        Row: {
          asset: string
          created_at: string
          futures_balance: number | null
          id: string
          spot_balance: number | null
          total_balance: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          asset: string
          created_at?: string
          futures_balance?: number | null
          id?: string
          spot_balance?: number | null
          total_balance?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          asset?: string
          created_at?: string
          futures_balance?: number | null
          id?: string
          spot_balance?: number | null
          total_balance?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      market_data_cache: {
        Row: {
          ask_price: number | null
          bid_price: number | null
          id: string
          source: string | null
          spread: number | null
          symbol: string
          updated_at: string
          volume_24h: number | null
        }
        Insert: {
          ask_price?: number | null
          bid_price?: number | null
          id?: string
          source?: string | null
          spread?: number | null
          symbol: string
          updated_at?: string
          volume_24h?: number | null
        }
        Update: {
          ask_price?: number | null
          bid_price?: number | null
          id?: string
          source?: string | null
          spread?: number | null
          symbol?: string
          updated_at?: string
          volume_24h?: number | null
        }
        Relationships: []
      }
      performance_metrics: {
        Row: {
          active_pairs: number | null
          ai_confidence: number | null
          avg_latency: number | null
          created_at: string
          daily_pnl: number | null
          id: string
          success_rate: number | null
          successful_trades: number | null
          total_pnl: number | null
          total_trades: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active_pairs?: number | null
          ai_confidence?: number | null
          avg_latency?: number | null
          created_at?: string
          daily_pnl?: number | null
          id?: string
          success_rate?: number | null
          successful_trades?: number | null
          total_pnl?: number | null
          total_trades?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active_pairs?: number | null
          ai_confidence?: number | null
          avg_latency?: number | null
          created_at?: string
          daily_pnl?: number | null
          id?: string
          success_rate?: number | null
          successful_trades?: number | null
          total_pnl?: number | null
          total_trades?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      trades: {
        Row: {
          ai_confidence: number | null
          created_at: string
          entry_price: number | null
          exchange: string | null
          execution_time_ms: number | null
          exit_price: number | null
          fees: number | null
          id: string
          pair: string
          pnl: number | null
          price: number
          quantity: number
          side: string
          slippage: number | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          ai_confidence?: number | null
          created_at?: string
          entry_price?: number | null
          exchange?: string | null
          execution_time_ms?: number | null
          exit_price?: number | null
          fees?: number | null
          id?: string
          pair: string
          pnl?: number | null
          price: number
          quantity: number
          side: string
          slippage?: number | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          ai_confidence?: number | null
          created_at?: string
          entry_price?: number | null
          exchange?: string | null
          execution_time_ms?: number | null
          exit_price?: number | null
          fees?: number | null
          id?: string
          pair?: string
          pnl?: number | null
          price?: number
          quantity?: number
          side?: string
          slippage?: number | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          auto_trading_enabled: boolean | null
          binance_api_key: string | null
          binance_secret_key: string | null
          created_at: string
          id: string
          max_position_size: number | null
          risk_level: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          auto_trading_enabled?: boolean | null
          binance_api_key?: string | null
          binance_secret_key?: string | null
          created_at?: string
          id?: string
          max_position_size?: number | null
          risk_level?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          auto_trading_enabled?: boolean | null
          binance_api_key?: string | null
          binance_secret_key?: string | null
          created_at?: string
          id?: string
          max_position_size?: number | null
          risk_level?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
