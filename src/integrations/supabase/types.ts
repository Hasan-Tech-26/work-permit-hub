export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      areas: {
        Row: {
          area_owner_id: string | null;
          code: string;
          created_at: string;
          id: string;
          name: string;
          plant_id: string;
        };
        Insert: {
          area_owner_id?: string | null;
          code: string;
          created_at?: string;
          id?: string;
          name: string;
          plant_id: string;
        };
        Update: {
          area_owner_id?: string | null;
          code?: string;
          created_at?: string;
          id?: string;
          name?: string;
          plant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "areas_area_owner_id_fkey";
            columns: ["area_owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "areas_plant_id_fkey";
            columns: ["plant_id"];
            isOneToOne: false;
            referencedRelation: "plants";
            referencedColumns: ["id"];
          },
        ];
      };
      permit_audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          comment: string | null;
          created_at: string;
          field_changes: Json;
          from_status: Database["public"]["Enums"]["permit_status"] | null;
          id: string;
          permit_id: string;
          to_status: Database["public"]["Enums"]["permit_status"] | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          comment?: string | null;
          created_at?: string;
          field_changes?: Json;
          from_status?: Database["public"]["Enums"]["permit_status"] | null;
          id?: string;
          permit_id: string;
          to_status?: Database["public"]["Enums"]["permit_status"] | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          comment?: string | null;
          created_at?: string;
          field_changes?: Json;
          from_status?: Database["public"]["Enums"]["permit_status"] | null;
          id?: string;
          permit_id?: string;
          to_status?: Database["public"]["Enums"]["permit_status"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "permit_audit_log_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "permit_audit_log_permit_id_fkey";
            columns: ["permit_id"];
            isOneToOne: false;
            referencedRelation: "permits";
            referencedColumns: ["id"];
          },
        ];
      };
      permit_approvals: {
        Row: {
          approver_id: string | null;
          comment: string | null;
          created_at: string;
          decided_at: string | null;
          decision: Database["public"]["Enums"]["approval_decision"];
          id: string;
          permit_id: string;
          required_role: Database["public"]["Enums"]["app_role"];
          step_order: number;
        };
        Insert: {
          approver_id?: string | null;
          comment?: string | null;
          created_at?: string;
          decided_at?: string | null;
          decision?: Database["public"]["Enums"]["approval_decision"];
          id?: string;
          permit_id: string;
          required_role: Database["public"]["Enums"]["app_role"];
          step_order: number;
        };
        Update: {
          approver_id?: string | null;
          comment?: string | null;
          created_at?: string;
          decided_at?: string | null;
          decision?: Database["public"]["Enums"]["approval_decision"];
          id?: string;
          permit_id?: string;
          required_role?: Database["public"]["Enums"]["app_role"];
          step_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "permit_approvals_approver_id_fkey";
            columns: ["approver_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "permit_approvals_permit_id_fkey";
            columns: ["permit_id"];
            isOneToOne: false;
            referencedRelation: "permits";
            referencedColumns: ["id"];
          },
        ];
      };
      permit_status_history: {
        Row: {
          changed_by: string | null;
          created_at: string;
          from_status: Database["public"]["Enums"]["permit_status"] | null;
          id: string;
          note: string | null;
          permit_id: string;
          to_status: Database["public"]["Enums"]["permit_status"];
        };
        Insert: {
          changed_by?: string | null;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["permit_status"] | null;
          id?: string;
          note?: string | null;
          permit_id: string;
          to_status: Database["public"]["Enums"]["permit_status"];
        };
        Update: {
          changed_by?: string | null;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["permit_status"] | null;
          id?: string;
          note?: string | null;
          permit_id?: string;
          to_status?: Database["public"]["Enums"]["permit_status"];
        };
        Relationships: [
          {
            foreignKeyName: "permit_status_history_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "permit_status_history_permit_id_fkey";
            columns: ["permit_id"];
            isOneToOne: false;
            referencedRelation: "permits";
            referencedColumns: ["id"];
          },
        ];
      };
      permit_work_logs: {
        Row: {
          created_at: string;
          id: string;
          logged_at: string;
          logged_by: string | null;
          notes: string;
          permit_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          logged_at?: string;
          logged_by?: string | null;
          notes: string;
          permit_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          logged_at?: string;
          logged_by?: string | null;
          notes?: string;
          permit_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "permit_work_logs_logged_by_fkey";
            columns: ["logged_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "permit_work_logs_permit_id_fkey";
            columns: ["permit_id"];
            isOneToOne: false;
            referencedRelation: "permits";
            referencedColumns: ["id"];
          },
        ];
      };
      permit_types: {
        Row: {
          accent: string;
          code: string;
          created_at: string;
          description: string | null;
          field_schema: Json;
          id: string;
          is_active: boolean;
          name: string;
          sort_order: number;
        };
        Insert: {
          accent?: string;
          code: string;
          created_at?: string;
          description?: string | null;
          field_schema?: Json;
          id?: string;
          is_active?: boolean;
          name: string;
          sort_order?: number;
        };
        Update: {
          accent?: string;
          code?: string;
          created_at?: string;
          description?: string | null;
          field_schema?: Json;
          id?: string;
          is_active?: boolean;
          name?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      permits: {
        Row: {
          area_id: string | null;
          contractor_company: string | null;
          created_at: string;
          equipment: string | null;
          hazards: string[];
          id: string;
          permit_number: string;
          permit_type_id: string;
          planned_end: string;
          planned_start: string;
          plant_id: string | null;
          ppe: string[];
          precautions: string[];
          requester_id: string | null;
          status: Database["public"]["Enums"]["permit_status"];
          type_data: Json;
          updated_at: string;
          work_description: string;
          work_team: string | null;
        };
        Insert: {
          area_id?: string | null;
          contractor_company?: string | null;
          created_at?: string;
          equipment?: string | null;
          hazards?: string[];
          id?: string;
          permit_number: string;
          permit_type_id: string;
          planned_end: string;
          planned_start: string;
          plant_id?: string | null;
          ppe?: string[];
          precautions?: string[];
          requester_id?: string | null;
          status?: Database["public"]["Enums"]["permit_status"];
          type_data?: Json;
          updated_at?: string;
          work_description: string;
          work_team?: string | null;
        };
        Update: {
          area_id?: string | null;
          contractor_company?: string | null;
          created_at?: string;
          equipment?: string | null;
          hazards?: string[];
          id?: string;
          permit_number?: string;
          permit_type_id?: string;
          planned_end?: string;
          planned_start?: string;
          plant_id?: string | null;
          ppe?: string[];
          precautions?: string[];
          requester_id?: string | null;
          status?: Database["public"]["Enums"]["permit_status"];
          type_data?: Json;
          updated_at?: string;
          work_description?: string;
          work_team?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "permits_area_id_fkey";
            columns: ["area_id"];
            isOneToOne: false;
            referencedRelation: "areas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "permits_permit_type_id_fkey";
            columns: ["permit_type_id"];
            isOneToOne: false;
            referencedRelation: "permit_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "permits_plant_id_fkey";
            columns: ["plant_id"];
            isOneToOne: false;
            referencedRelation: "plants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "permits_requester_id_fkey";
            columns: ["requester_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      plants: {
        Row: {
          code: string;
          created_at: string;
          id: string;
          name: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          id?: string;
          name: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string | null;
          full_name: string;
          id: string;
          job_title: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          full_name: string;
          id?: string;
          job_title?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          full_name?: string;
          id?: string;
          job_title?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          profile_id: string;
          role: Database["public"]["Enums"]["app_role"];
        };
        Insert: {
          id?: string;
          profile_id: string;
          role: Database["public"]["Enums"]["app_role"];
        };
        Update: {
          id?: string;
          profile_id?: string;
          role?: Database["public"]["Enums"]["app_role"];
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "requester" | "area_owner" | "safety_officer" | "admin";
      approval_decision: "PENDING" | "APPROVED" | "REJECTED";
      permit_status:
        | "DRAFT"
        | "PENDING_APPROVAL"
        | "APPROVED"
        | "ACTIVE"
        | "SUSPENDED"
        | "REJECTED"
        | "EXPIRED"
        | "CLOSED"
        | "CLOSED_VERIFIED"
        | "CANCELLED";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["requester", "area_owner", "safety_officer", "admin"],
      approval_decision: ["PENDING", "APPROVED", "REJECTED"],
      permit_status: [
        "DRAFT",
        "PENDING_APPROVAL",
        "APPROVED",
        "ACTIVE",
        "SUSPENDED",
        "REJECTED",
        "EXPIRED",
        "CLOSED",
        "CLOSED_VERIFIED",
        "CANCELLED",
      ],
    },
  },
} as const;
