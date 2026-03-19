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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      banned_devices: {
        Row: {
          banned_at: string
          banned_by: string | null
          fingerprint: string
          id: string
          reason: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          banned_at?: string
          banned_by?: string | null
          fingerprint: string
          id?: string
          reason?: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          banned_at?: string
          banned_by?: string | null
          fingerprint?: string
          id?: string
          reason?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      blocked_users: {
        Row: {
          blocked_at: string
          id: string
          reason: string
          status: string
          user_email: string
          user_id: string
          user_name: string
        }
        Insert: {
          blocked_at?: string
          id?: string
          reason?: string
          status?: string
          user_email?: string
          user_id: string
          user_name?: string
        }
        Update: {
          blocked_at?: string
          id?: string
          reason?: string
          status?: string
          user_email?: string
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      deposits: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: string
          status: string
          user_email: string
          user_id: string
          user_name: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          method?: string
          status?: string
          user_email?: string
          user_id: string
          user_name?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: string
          status?: string
          user_email?: string
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          additional_info: string
          created_at: string
          date: string
          description: string
          expires_at: string
          id: string
          identification: string
          name: string
          pdf_url: string | null
          status: string
          type: string
          user_id: string
        }
        Insert: {
          additional_info?: string
          created_at?: string
          date?: string
          description?: string
          expires_at?: string
          id: string
          identification?: string
          name?: string
          pdf_url?: string | null
          status?: string
          type: string
          user_id: string
        }
        Update: {
          additional_info?: string
          created_at?: string
          date?: string
          description?: string
          expires_at?: string
          id?: string
          identification?: string
          name?: string
          pdf_url?: string | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      generation_logs: {
        Row: {
          created_at: string
          document_type: string
          error_message: string | null
          id: string
          stage: string
          user_email: string
          user_id: string
          user_name: string
        }
        Insert: {
          created_at?: string
          document_type: string
          error_message?: string | null
          id?: string
          stage?: string
          user_email?: string
          user_id: string
          user_name?: string
        }
        Update: {
          created_at?: string
          document_type?: string
          error_message?: string | null
          id?: string
          stage?: string
          user_email?: string
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          attempt_type: string
          created_at: string
          id: string
          identifier: string
        }
        Insert: {
          attempt_type?: string
          created_at?: string
          id?: string
          identifier: string
        }
        Update: {
          attempt_type?: string
          created_at?: string
          id?: string
          identifier?: string
        }
        Relationships: []
      }
      pix_warnings: {
        Row: {
          amount: number
          created_at: string
          id: string
          qr_code_id: string
          resolved_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          qr_code_id?: string
          resolved_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          qr_code_id?: string
          resolved_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          credits: number
          email: string
          id: string
          name: string
          pin_hash: string | null
          plano: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits?: number
          email?: string
          id?: string
          name?: string
          pin_hash?: string | null
          plano?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits?: number
          email?: string
          id?: string
          name?: string
          pin_hash?: string | null
          plano?: string
          user_id?: string
        }
        Relationships: []
      }
      recharge_logs: {
        Row: {
          amount: number
          created_at: string
          credits_used: number
          id: string
          phone_number: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          credits_used?: number
          id?: string
          phone_number?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          credits_used?: number
          id?: string
          phone_number?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          cargo: Database["public"]["Enums"]["app_cargo"]
          id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          cargo: Database["public"]["Enums"]["app_cargo"]
          id?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          cargo?: Database["public"]["Enums"]["app_cargo"]
          id?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_login_attempts: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _cargo: Database["public"]["Enums"]["app_cargo"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_cargo:
        | "dealer"
        | "master"
        | "diamond"
        | "sub_gerente"
        | "gerente"
        | "admin"
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
    Enums: {
      app_cargo: [
        "dealer",
        "master",
        "diamond",
        "sub_gerente",
        "gerente",
        "admin",
      ],
    },
  },
} as const
