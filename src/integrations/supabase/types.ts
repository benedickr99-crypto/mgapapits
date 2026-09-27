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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bookings: {
        Row: {
          accepted_at: string | null
          admin_notes: string | null
          cancelled_at: string | null
          climb_date: string
          created_at: string
          declined_at: string | null
          emergency_contact_name: string
          emergency_contact_phone: string
          foreign_count: number
          group_size: number
          guide_id: string | null
          guide_notes: string | null
          id: string
          medical_cert_url: string | null
          notes: string | null
          organization: string | null
          permit_number: string | null
          status: Database["public"]["Enums"]["booking_status"]
          trail_id: string
          updated_at: string
          user_id: string
          valid_id_url: string | null
          waiver_url: string | null
        }
        Insert: {
          accepted_at?: string | null
          admin_notes?: string | null
          cancelled_at?: string | null
          climb_date: string
          created_at?: string
          declined_at?: string | null
          emergency_contact_name: string
          emergency_contact_phone: string
          foreign_count?: number
          group_size: number
          guide_id?: string | null
          guide_notes?: string | null
          id?: string
          medical_cert_url?: string | null
          notes?: string | null
          organization?: string | null
          permit_number?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          trail_id: string
          updated_at?: string
          user_id: string
          valid_id_url?: string | null
          waiver_url?: string | null
        }
        Update: {
          accepted_at?: string | null
          admin_notes?: string | null
          cancelled_at?: string | null
          climb_date?: string
          created_at?: string
          declined_at?: string | null
          emergency_contact_name?: string
          emergency_contact_phone?: string
          foreign_count?: number
          group_size?: number
          guide_id?: string | null
          guide_notes?: string | null
          id?: string
          medical_cert_url?: string | null
          notes?: string | null
          organization?: string | null
          permit_number?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          trail_id?: string
          updated_at?: string
          user_id?: string
          valid_id_url?: string | null
          waiver_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_trail_id_fkey"
            columns: ["trail_id"]
            isOneToOne: false
            referencedRelation: "trails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guide_availability: {
        Row: {
          available_date: string
          created_at: string | null
          guide_id: string
          id: string
          status: string | null
        }
        Insert: {
          available_date: string
          created_at?: string | null
          guide_id: string
          id?: string
          status?: string | null
        }
        Update: {
          available_date?: string
          created_at?: string | null
          guide_id?: string
          id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guide_availability_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guides: {
        Row: {
          active: boolean
          bio: string | null
          contact_info: string
          created_at: string
          experience_years: number
          id: string
          image_url: string | null
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          bio?: string | null
          contact_info: string
          created_at?: string
          experience_years?: number
          id?: string
          image_url?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          bio?: string | null
          contact_info?: string
          created_at?: string
          experience_years?: number
          id?: string
          image_url?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          entity_id: string | null
          id: string
          link: string | null
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          id?: string
          link?: string | null
          message: string
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          id?: string
          link?: string | null
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          bio: string | null
          certifications: string | null
          created_at: string
          experience_years: number | null
          full_name: string | null
          guide_application_status: string | null
          id: string
          image_url: string | null
          is_available: boolean | null
          nationality: string | null
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          bio?: string | null
          certifications?: string | null
          created_at?: string
          experience_years?: number | null
          full_name?: string | null
          guide_application_status?: string | null
          id: string
          image_url?: string | null
          is_available?: boolean | null
          nationality?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          bio?: string | null
          certifications?: string | null
          created_at?: string
          experience_years?: number | null
          full_name?: string | null
          guide_application_status?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          nationality?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      incident_reports: {
        Row: {
          action_taken: string | null
          admin_notes: string | null
          booking_id: string | null
          category: string
          created_at: string
          description: string
          guide_id: string
          id: string
          location_details: string | null
          requires_assistance: boolean | null
          resolved_at: string | null
          severity: string
          status: string
          trail_id: string | null
          trail_name: string | null
          updated_at: string
        }
        Insert: {
          action_taken?: string | null
          admin_notes?: string | null
          booking_id?: string | null
          category: string
          created_at?: string
          description: string
          guide_id: string
          id?: string
          location_details?: string | null
          requires_assistance?: boolean | null
          resolved_at?: string | null
          severity?: string
          status?: string
          trail_id?: string | null
          trail_name?: string | null
          updated_at?: string
        }
        Update: {
          action_taken?: string | null
          admin_notes?: string | null
          booking_id?: string | null
          category?: string
          created_at?: string
          description?: string
          guide_id?: string
          id?: string
          location_details?: string | null
          requires_assistance?: boolean | null
          resolved_at?: string | null
          severity?: string
          status?: string
          trail_id?: string | null
          trail_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      trails: {
        Row: {
          active: boolean
          barangay: string
          city: string
          created_at: string
          description: string | null
          difficulty: string | null
          id: string
          name: string
          weekly_slots: number
        }
        Insert: {
          active?: boolean
          barangay: string
          city: string
          created_at?: string
          description?: string | null
          difficulty?: string | null
          id?: string
          name: string
          weekly_slots?: number
        }
        Update: {
          active?: boolean
          barangay?: string
          city?: string
          created_at?: string
          description?: string | null
          difficulty?: string | null
          id?: string
          name?: string
          weekly_slots?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_booking: { Args: { p_booking_id: string }; Returns: undefined }
      get_available_guides: {
        Args: { p_date: string }
        Returns: {
          bio: string
          experience_years: number
          full_name: string
          id: string
          image_url: string
        }[]
      }
      has_role:
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
        | { Args: { _role: string; _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user" | "tour_guide" | "guide"
      booking_status:
        | "pending"
        | "approved"
        | "rejected"
        | "completed"
        | "cancelled"
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
      app_role: ["admin", "user", "tour_guide", "guide"],
      booking_status: [
        "pending",
        "approved",
        "rejected",
        "completed",
        "cancelled",
      ],
    },
  },
} as const
