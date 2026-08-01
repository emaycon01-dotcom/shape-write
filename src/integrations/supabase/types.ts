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
      atestados: {
        Row: {
          codigo_acesso: string
          cpf: string
          created_at: string
          crm: string
          crm_uf: string
          data_nascimento: string
          emissao_atestado: string
          endereco: string | null
          endereco_clinica: string | null
          genero_medico: string
          id: string
          nome_medico: string
          nome_paciente: string
          pdf_url: string | null
          quantidade: number
          texto_atestado: string
          token: string
        }
        Insert: {
          codigo_acesso: string
          cpf: string
          created_at?: string
          crm: string
          crm_uf: string
          data_nascimento: string
          emissao_atestado: string
          endereco?: string | null
          endereco_clinica?: string | null
          genero_medico: string
          id?: string
          nome_medico: string
          nome_paciente: string
          pdf_url?: string | null
          quantidade?: number
          texto_atestado: string
          token: string
        }
        Update: {
          codigo_acesso?: string
          cpf?: string
          created_at?: string
          crm?: string
          crm_uf?: string
          data_nascimento?: string
          emissao_atestado?: string
          endereco?: string | null
          endereco_clinica?: string | null
          genero_medico?: string
          id?: string
          nome_medico?: string
          nome_paciente?: string
          pdf_url?: string | null
          quantidade?: number
          texto_atestado?: string
          token?: string
        }
        Relationships: []
      }
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
      credit_transactions: {
        Row: {
          actor_id: string | null
          amount: number
          balance_after: number
          created_at: string
          id: string
          kind: string
          reason: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          amount?: number
          balance_after?: number
          created_at?: string
          id?: string
          kind?: string
          reason?: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          amount?: number
          balance_after?: number
          created_at?: string
          id?: string
          kind?: string
          reason?: string
          user_id?: string
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
      document_codes: {
        Row: {
          code: string
          created_at: string
          doc_id: string
          doc_type: string
          revoked: boolean
          storage_path: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          doc_id: string
          doc_type?: string
          revoked?: boolean
          storage_path: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          doc_id?: string
          doc_type?: string
          revoked?: boolean
          storage_path?: string
          user_id?: string
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
      financial_transactions: {
        Row: {
          amount: number
          created_at: string
          credits_amount: number
          elitepay_charge_id: string | null
          id: string
          paid_at: string | null
          pix_code: string | null
          plan_name: string | null
          qr_code_base64: string | null
          status: string
          txid: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          credits_amount?: number
          elitepay_charge_id?: string | null
          id?: string
          paid_at?: string | null
          pix_code?: string | null
          plan_name?: string | null
          qr_code_base64?: string | null
          status?: string
          txid?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          credits_amount?: number
          elitepay_charge_id?: string | null
          id?: string
          paid_at?: string | null
          pix_code?: string | null
          plan_name?: string | null
          qr_code_base64?: string | null
          status?: string
          txid?: string | null
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
          warning_cycle_start: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          qr_code_id?: string
          resolved_at?: string | null
          status?: string
          user_id: string
          warning_cycle_start?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          qr_code_id?: string
          resolved_at?: string | null
          status?: string
          user_id?: string
          warning_cycle_start?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          credits: number
          email: string
          id: string
          name: string
          pin_hash: string | null
          plano: string
          status: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          credits?: number
          email?: string
          id?: string
          name?: string
          pin_hash?: string | null
          plano?: string
          status?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          credits?: number
          email?: string
          id?: string
          name?: string
          pin_hash?: string | null
          plano?: string
          status?: string
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
      support_messages: {
        Row: {
          author_id: string
          author_name: string
          body: string
          created_at: string
          id: string
          is_admin: boolean
          ticket_id: string
        }
        Insert: {
          author_id: string
          author_name?: string
          body: string
          created_at?: string
          id?: string
          is_admin?: boolean
          ticket_id: string
        }
        Update: {
          author_id?: string
          author_name?: string
          body?: string
          created_at?: string
          id?: string
          is_admin?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          category: string
          closed_at: string | null
          closed_by: string | null
          created_at: string
          id: string
          status: string
          subject: string
          updated_at: string
          user_email: string
          user_id: string
          user_name: string
        }
        Insert: {
          category?: string
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          id?: string
          status?: string
          subject?: string
          updated_at?: string
          user_email?: string
          user_id: string
          user_name?: string
        }
        Update: {
          category?: string
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          id?: string
          status?: string
          subject?: string
          updated_at?: string
          user_email?: string
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      template_alignments: {
        Row: {
          doc_type: string
          positions: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          doc_type: string
          positions: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          doc_type?: string
          positions?: Json
          updated_at?: string
          updated_by?: string | null
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
      admin_adjust_credits: {
        Args: { _delta: number; _reason?: string; _target_user_id: string }
        Returns: number
      }
      admin_ban_user: {
        Args: { _reason?: string; _target_user_id: string }
        Returns: undefined
      }
      admin_set_account_status: {
        Args: { _status: string; _target_user_id: string }
        Returns: undefined
      }
      admin_set_plan: {
        Args: { _plan: string; _target_user_id: string }
        Returns: undefined
      }
      admin_set_role: {
        Args: {
          _cargo: Database["public"]["Enums"]["app_cargo"]
          _target_user_id: string
        }
        Returns: undefined
      }
      admin_unban_user: {
        Args: { _target_user_id: string }
        Returns: undefined
      }
      cleanup_old_login_attempts: { Args: never; Returns: undefined }
      consume_credits: {
        Args: { _amount: number; _reason?: string }
        Returns: number
      }
      has_role: {
        Args: {
          _cargo: Database["public"]["Enums"]["app_cargo"]
          _user_id: string
        }
        Returns: boolean
      }
      verify_atestado: {
        Args: { _token: string }
        Returns: {
          codigo_acesso: string
          cpf: string
          created_at: string
          crm: string
          crm_uf: string
          data_nascimento: string
          emissao_atestado: string
          endereco: string | null
          endereco_clinica: string | null
          genero_medico: string
          id: string
          nome_medico: string
          nome_paciente: string
          pdf_url: string | null
          quantidade: number
          texto_atestado: string
          token: string
        }[]
        SetofOptions: {
          from: "*"
          to: "atestados"
          isOneToOne: false
          isSetofReturn: true
        }
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
