// Generated from the SetSetal Supabase project. Do not edit by hand; regenerate
// after each migration (Supabase MCP generate_typescript_types, or
// `supabase gen types typescript --project-id gplmfpglapxicfghlkid`).
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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      areas: {
        Row: {
          active: boolean
          district: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          district: string
          id: string
          name: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          district?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          actor: string | null
          collector_id: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["collector_status"] | null
          id: number
          reason: string
          to_status: Database["public"]["Enums"]["collector_status"]
        }
        Insert: {
          actor?: string | null
          collector_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["collector_status"] | null
          id?: never
          reason: string
          to_status: Database["public"]["Enums"]["collector_status"]
        }
        Update: {
          actor?: string | null
          collector_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["collector_status"] | null
          id?: never
          reason?: string
          to_status?: Database["public"]["Enums"]["collector_status"]
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_collector_id_fkey"
            columns: ["collector_id"]
            isOneToOne: false
            referencedRelation: "collectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_collector_id_fkey"
            columns: ["collector_id"]
            isOneToOne: false
            referencedRelation: "public_collectors"
            referencedColumns: ["id"]
          },
        ]
      }
      collector_areas: {
        Row: {
          area_id: string
          collector_id: string
        }
        Insert: {
          area_id: string
          collector_id: string
        }
        Update: {
          area_id?: string
          collector_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collector_areas_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collector_areas_collector_id_fkey"
            columns: ["collector_id"]
            isOneToOne: false
            referencedRelation: "collectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collector_areas_collector_id_fkey"
            columns: ["collector_id"]
            isOneToOne: false
            referencedRelation: "public_collectors"
            referencedColumns: ["id"]
          },
        ]
      }
      collector_contacts: {
        Row: {
          collector_id: string
          phone: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          collector_id: string
          phone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          collector_id?: string
          phone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collector_contacts_collector_id_fkey"
            columns: ["collector_id"]
            isOneToOne: true
            referencedRelation: "collectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collector_contacts_collector_id_fkey"
            columns: ["collector_id"]
            isOneToOne: true
            referencedRelation: "public_collectors"
            referencedColumns: ["id"]
          },
        ]
      }
      collector_waste_types: {
        Row: {
          collector_id: string
          waste_type_id: string
        }
        Insert: {
          collector_id: string
          waste_type_id: string
        }
        Update: {
          collector_id?: string
          waste_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collector_waste_types_collector_id_fkey"
            columns: ["collector_id"]
            isOneToOne: false
            referencedRelation: "collectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collector_waste_types_collector_id_fkey"
            columns: ["collector_id"]
            isOneToOne: false
            referencedRelation: "public_collectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collector_waste_types_waste_type_id_fkey"
            columns: ["waste_type_id"]
            isOneToOne: false
            referencedRelation: "waste_types"
            referencedColumns: ["id"]
          },
        ]
      }
      collectors: {
        Row: {
          consent_at: string | null
          created_at: string
          description: string
          id: string
          name: string
          owner: string
          status: Database["public"]["Enums"]["collector_status"]
          updated_at: string
          vehicle_type: string
        }
        Insert: {
          consent_at?: string | null
          created_at?: string
          description?: string
          id?: string
          name: string
          owner?: string
          status?: Database["public"]["Enums"]["collector_status"]
          updated_at?: string
          vehicle_type: string
        }
        Update: {
          consent_at?: string | null
          created_at?: string
          description?: string
          id?: string
          name?: string
          owner?: string
          status?: Database["public"]["Enums"]["collector_status"]
          updated_at?: string
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "collectors_vehicle_type_fkey"
            columns: ["vehicle_type"]
            isOneToOne: false
            referencedRelation: "vehicle_types"
            referencedColumns: ["id"]
          },
        ]
      }
      report_types: {
        Row: {
          active: boolean
          id: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          id: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          id?: string
          sort_order?: number
        }
        Relationships: []
      }
      reports: {
        Row: {
          collector_id: string | null
          created_at: string
          id: string
          message: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["report_status"]
          type: string
        }
        Insert: {
          collector_id?: string | null
          created_at?: string
          id?: string
          message: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          type: string
        }
        Update: {
          collector_id?: string | null
          created_at?: string
          id?: string
          message?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_collector_id_fkey"
            columns: ["collector_id"]
            isOneToOne: false
            referencedRelation: "collectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_collector_id_fkey"
            columns: ["collector_id"]
            isOneToOne: false
            referencedRelation: "public_collectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_type_fkey"
            columns: ["type"]
            isOneToOne: false
            referencedRelation: "report_types"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_types: {
        Row: {
          active: boolean
          id: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          id: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          id?: string
          sort_order?: number
        }
        Relationships: []
      }
      waste_types: {
        Row: {
          active: boolean
          id: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          id: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          id?: string
          sort_order?: number
        }
        Relationships: []
      }
    }
    Views: {
      public_collectors: {
        Row: {
          areas: string[] | null
          description: string | null
          id: string | null
          name: string | null
          phone: string | null
          updated_at: string | null
          vehicle_type: string | null
          waste_types: string[] | null
          whatsapp: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collectors_vehicle_type_fkey"
            columns: ["vehicle_type"]
            isOneToOne: false
            referencedRelation: "vehicle_types"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      owner_edit_reason: { Args: never; Returns: string }
      save_my_listing: {
        Args: {
          p_areas: string[]
          p_consent: boolean
          p_description: string
          p_id: string
          p_name: string
          p_phone: string
          p_vehicle_type: string
          p_waste_types: string[]
          p_whatsapp: string
        }
        Returns: Json
      }
      set_collector_status: {
        Args: {
          p_collector: string
          p_reason: string
          p_status: Database["public"]["Enums"]["collector_status"]
        }
        Returns: undefined
      }
    }
    Enums: {
      collector_status: "submitted" | "approved" | "rejected" | "suspended"
      report_status: "open" | "resolved" | "dismissed"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      collector_status: ["submitted", "approved", "rejected", "suspended"],
      report_status: ["open", "resolved", "dismissed"],
    },
  },
} as const
