export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      blog_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "blog_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_id: string
          category_id: string | null
          content: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          likes_count: number
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          slug: string | null
          status: Database["public"]["Enums"]["post_status"]
          tags: string[] | null
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          author_id: string
          category_id?: string | null
          content?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          likes_count?: number
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          tags?: string[] | null
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          author_id?: string
          category_id?: string | null
          content?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          likes_count?: number
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          tags?: string[] | null
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "blog_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_review_assignments: {
        Row: {
          assigned_by: string
          created_at: string
          id: string
          notes: string | null
          post_id: string
          reviewer_id: string
          status: Database["public"]["Enums"]["review_assignment_status"]
          updated_at: string
        }
        Insert: {
          assigned_by: string
          created_at?: string
          id?: string
          notes?: string | null
          post_id: string
          reviewer_id: string
          status?: Database["public"]["Enums"]["review_assignment_status"]
          updated_at?: string
        }
        Update: {
          assigned_by?: string
          created_at?: string
          id?: string
          notes?: string | null
          post_id?: string
          reviewer_id?: string
          status?: Database["public"]["Enums"]["review_assignment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_review_assignments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_review_logs: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          id: string
          note: string | null
          post_id: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          id?: string
          note?: string | null
          post_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          id?: string
          note?: string | null
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_review_logs_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      consult_availability: {
        Row: {
          created_at: string
          date: string | null
          day_of_week: number | null
          end_time: string
          guru_id: string
          id: string
          is_available: boolean
          start_time: string
          type: Database["public"]["Enums"]["availability_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          date?: string | null
          day_of_week?: number | null
          end_time: string
          guru_id: string
          id?: string
          is_available?: boolean
          start_time: string
          type?: Database["public"]["Enums"]["availability_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string | null
          day_of_week?: number | null
          end_time?: string
          guru_id?: string
          id?: string
          is_available?: boolean
          start_time?: string
          type?: Database["public"]["Enums"]["availability_type"]
          updated_at?: string
        }
        Relationships: []
      }
      consult_bookings: {
        Row: {
          cancellation_reason: string | null
          communication_method:
            | Database["public"]["Enums"]["communication_method"]
            | null
          created_at: string
          end_datetime: string
          guru_id: string
          id: string
          meeting_link: string | null
          notes: string | null
          payment_status: Database["public"]["Enums"]["booking_payment_status"]
          price: number
          start_datetime: string
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          cancellation_reason?: string | null
          communication_method?:
            | Database["public"]["Enums"]["communication_method"]
            | null
          created_at?: string
          end_datetime: string
          guru_id: string
          id?: string
          meeting_link?: string | null
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["booking_payment_status"]
          price: number
          start_datetime: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          cancellation_reason?: string | null
          communication_method?:
            | Database["public"]["Enums"]["communication_method"]
            | null
          created_at?: string
          end_datetime?: string
          guru_id?: string
          id?: string
          meeting_link?: string | null
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["booking_payment_status"]
          price?: number
          start_datetime?: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      consult_payments: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          currency: string
          id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          receipt_url: string | null
          status: Database["public"]["Enums"]["payment_status"]
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string
          currency?: string
          id?: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          receipt_url?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          currency?: string
          id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          receipt_url?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consult_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "consult_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      consult_reminders: {
        Row: {
          booking_id: string
          created_at: string
          id: string
          reminder_type: Database["public"]["Enums"]["reminder_type"]
          scheduled_time: string
          sent_status: boolean
          updated_at: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          id?: string
          reminder_type?: Database["public"]["Enums"]["reminder_type"]
          scheduled_time: string
          sent_status?: boolean
          updated_at?: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          id?: string
          reminder_type?: Database["public"]["Enums"]["reminder_type"]
          scheduled_time?: string
          sent_status?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consult_reminders_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "consult_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      guru_applications: {
        Row: {
          bio: string | null
          created_at: string
          credentials: string | null
          id: string
          notes: string | null
          specialty: string | null
          status: Database["public"]["Enums"]["guru_application_status"]
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          credentials?: string | null
          id?: string
          notes?: string | null
          specialty?: string | null
          status?: Database["public"]["Enums"]["guru_application_status"]
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          credentials?: string | null
          id?: string
          notes?: string | null
          specialty?: string | null
          status?: Database["public"]["Enums"]["guru_application_status"]
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          calendar_sync_token: string | null
          country: string | null
          created_at: string
          credentials: string | null
          email: string | null
          exams: string[] | null
          full_name: string | null
          id: string
          price_per_30min: number | null
          specialty: string | null
          subscription_tier:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          timezone: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          calendar_sync_token?: string | null
          country?: string | null
          created_at?: string
          credentials?: string | null
          email?: string | null
          exams?: string[] | null
          full_name?: string | null
          id?: string
          price_per_30min?: number | null
          specialty?: string | null
          subscription_tier?:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          timezone?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          calendar_sync_token?: string | null
          country?: string | null
          created_at?: string
          credentials?: string | null
          email?: string | null
          exams?: string[] | null
          full_name?: string | null
          id?: string
          price_per_30min?: number | null
          specialty?: string | null
          subscription_tier?:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          timezone?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          correct_answer: string
          created_at: string
          created_by: string
          difficulty_level: Database["public"]["Enums"]["difficulty_level"]
          exam_type: Database["public"]["Enums"]["exam_type"]
          explanation: string | null
          id: string
          is_ai_generated: boolean | null
          keywords: string[] | null
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          question_text: string
          reviewed_by: string | null
          status: Database["public"]["Enums"]["question_status"] | null
          subtopic: string | null
          topic: string
          updated_at: string
        }
        Insert: {
          correct_answer: string
          created_at?: string
          created_by: string
          difficulty_level: Database["public"]["Enums"]["difficulty_level"]
          exam_type: Database["public"]["Enums"]["exam_type"]
          explanation?: string | null
          id?: string
          is_ai_generated?: boolean | null
          keywords?: string[] | null
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          question_text: string
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["question_status"] | null
          subtopic?: string | null
          topic: string
          updated_at?: string
        }
        Update: {
          correct_answer?: string
          created_at?: string
          created_by?: string
          difficulty_level?: Database["public"]["Enums"]["difficulty_level"]
          exam_type?: Database["public"]["Enums"]["exam_type"]
          explanation?: string | null
          id?: string
          is_ai_generated?: boolean | null
          keywords?: string[] | null
          option_a?: string
          option_b?: string
          option_c?: string
          option_d?: string
          question_text?: string
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["question_status"] | null
          subtopic?: string | null
          topic?: string
          updated_at?: string
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          attempted_at: string
          id: string
          is_correct: boolean | null
          question_id: string
          selected_answer: string | null
          user_id: string
        }
        Insert: {
          attempted_at?: string
          id?: string
          is_correct?: boolean | null
          question_id: string
          selected_answer?: string | null
          user_id: string
        }
        Update: {
          attempted_at?: string
          id?: string
          is_correct?: boolean | null
          question_id?: string
          selected_answer?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          status: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _user_id: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "user" | "guru" | "admin"
      availability_type: "default" | "exception"
      booking_payment_status: "unpaid" | "paid" | "refunded"
      booking_status:
        | "pending_payment"
        | "confirmed"
        | "cancelled"
        | "completed"
      communication_method: "zoom" | "google_meet" | "phone"
      difficulty_level: "easy" | "medium" | "hard"
      exam_type:
        | "FCPS"
        | "FRCEM"
        | "USMLE"
        | "PLAB"
        | "MRCP"
        | "Other"
        | "MRCEM_PRIMARY"
        | "MRCEM_SBA"
        | "FRCEM_SBA"
      guru_application_status: "pending" | "approved" | "rejected"
      payment_method: "stripe" | "paypal" | "free"
      payment_status: "pending" | "completed" | "refunded" | "failed"
      post_status: "draft" | "submitted" | "approved" | "rejected" | "published"
      question_status: "pending" | "approved" | "rejected"
      reminder_type: "email" | "sms" | "whatsapp" | "one_hour_before"
      review_assignment_status: "pending" | "completed" | "cancelled"
      subscription_tier: "free" | "exam" | "consultation" | "premium"
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
      app_role: ["user", "guru", "admin"],
      availability_type: ["default", "exception"],
      booking_payment_status: ["unpaid", "paid", "refunded"],
      booking_status: [
        "pending_payment",
        "confirmed",
        "cancelled",
        "completed",
      ],
      communication_method: ["zoom", "google_meet", "phone"],
      difficulty_level: ["easy", "medium", "hard"],
      exam_type: [
        "FCPS",
        "FRCEM",
        "USMLE",
        "PLAB",
        "MRCP",
        "Other",
        "MRCEM_PRIMARY",
        "MRCEM_SBA",
        "FRCEM_SBA",
      ],
      guru_application_status: ["pending", "approved", "rejected"],
      payment_method: ["stripe", "paypal", "free"],
      payment_status: ["pending", "completed", "refunded", "failed"],
      post_status: ["draft", "submitted", "approved", "rejected", "published"],
      question_status: ["pending", "approved", "rejected"],
      reminder_type: ["email", "sms", "whatsapp", "one_hour_before"],
      review_assignment_status: ["pending", "completed", "cancelled"],
      subscription_tier: ["free", "exam", "consultation", "premium"],
    },
  },
} as const
