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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      ai_content_index: {
        Row: {
          created_at: string
          doc_id: string
          embedding: string | null
          id: string
          last_embedded_at: string | null
          model: string | null
          published: boolean
          slug: string | null
          slug_url: string | null
          source_type: string
          tags: string[] | null
          text_chunk: string
          title: string | null
          updated_at: string
          url: string | null
        }
        Insert: {
          created_at?: string
          doc_id: string
          embedding?: string | null
          id?: string
          last_embedded_at?: string | null
          model?: string | null
          published?: boolean
          slug?: string | null
          slug_url?: string | null
          source_type: string
          tags?: string[] | null
          text_chunk: string
          title?: string | null
          updated_at?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          doc_id?: string
          embedding?: string | null
          id?: string
          last_embedded_at?: string | null
          model?: string | null
          published?: boolean
          slug?: string | null
          slug_url?: string | null
          source_type?: string
          tags?: string[] | null
          text_chunk?: string
          title?: string | null
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      ai_exam_answers: {
        Row: {
          answered_at: string
          created_at: string
          feedback: Database["public"]["Enums"]["ai_answer_feedback"]
          id: string
          is_correct: boolean
          question_id: string
          selected_answer: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answered_at?: string
          created_at?: string
          feedback?: Database["public"]["Enums"]["ai_answer_feedback"]
          id?: string
          is_correct: boolean
          question_id: string
          selected_answer: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answered_at?: string
          created_at?: string
          feedback?: Database["public"]["Enums"]["ai_answer_feedback"]
          id?: string
          is_correct?: boolean
          question_id?: string
          selected_answer?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_exam_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "ai_exam_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_exam_question_curriculum: {
        Row: {
          created_at: string
          curriculum_id: string
          question_id: string
        }
        Insert: {
          created_at?: string
          curriculum_id: string
          question_id: string
        }
        Update: {
          created_at?: string
          curriculum_id?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_exam_question_curriculum_curriculum_id_fkey"
            columns: ["curriculum_id"]
            isOneToOne: false
            referencedRelation: "curriculum_map"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_exam_question_curriculum_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "ai_exam_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_exam_questions: {
        Row: {
          correct_answer: string
          created_at: string
          explanation: string | null
          id: string
          options: Json
          question: string
          session_id: string
          source: string | null
          subtopic: string | null
          topic: string | null
          updated_at: string
        }
        Insert: {
          correct_answer: string
          created_at?: string
          explanation?: string | null
          id?: string
          options: Json
          question: string
          session_id: string
          source?: string | null
          subtopic?: string | null
          topic?: string | null
          updated_at?: string
        }
        Update: {
          correct_answer?: string
          created_at?: string
          explanation?: string | null
          id?: string
          options?: Json
          question?: string
          session_id?: string
          source?: string | null
          subtopic?: string | null
          topic?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_exam_questions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ai_exam_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_exam_sessions: {
        Row: {
          created_at: string
          exam_type: Database["public"]["Enums"]["exam_type_enum"] | null
          id: string
          started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          exam_type?: Database["public"]["Enums"]["exam_type_enum"] | null
          id?: string
          started_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          exam_type?: Database["public"]["Enums"]["exam_type_enum"] | null
          id?: string
          started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_feedback: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          message_id: string | null
          rating: number
          session_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          rating: number
          session_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          rating?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_ai_feedback_session"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ai_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_gen_logs: {
        Row: {
          count: number | null
          error_code: string | null
          exam: string | null
          id: string
          model_used: string | null
          slo: string | null
          source: string
          success: boolean
          ts: string
          user_id: string
        }
        Insert: {
          count?: number | null
          error_code?: string | null
          exam?: string | null
          id?: string
          model_used?: string | null
          slo?: string | null
          source: string
          success: boolean
          ts?: string
          user_id: string
        }
        Update: {
          count?: number | null
          error_code?: string | null
          exam?: string | null
          id?: string
          model_used?: string | null
          slo?: string | null
          source?: string
          success?: boolean
          ts?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          content: Json
          created_at: string
          id: string
          role: string
          session_id: string
          tokens_in: number | null
          tokens_out: number | null
          tool_name: string | null
        }
        Insert: {
          content: Json
          created_at?: string
          id?: string
          role: string
          session_id: string
          tokens_in?: number | null
          tokens_out?: number | null
          tool_name?: string | null
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          role?: string
          session_id?: string
          tokens_in?: number | null
          tokens_out?: number | null
          tool_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ai_messages_session"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ai_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_sessions: {
        Row: {
          anon_id: string | null
          created_at: string
          id: string
          last_active_at: string
          page_first_seen: string | null
          user_id: string | null
        }
        Insert: {
          anon_id?: string | null
          created_at?: string
          id?: string
          last_active_at?: string
          page_first_seen?: string | null
          user_id?: string | null
        }
        Update: {
          anon_id?: string | null
          created_at?: string
          id?: string
          last_active_at?: string
          page_first_seen?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      billing_webhook_events: {
        Row: {
          event_id: string
          payload: Json | null
          received_at: string
          type: string
        }
        Insert: {
          event_id: string
          payload?: Json | null
          received_at?: string
          type: string
        }
        Update: {
          event_id?: string
          payload?: Json | null
          received_at?: string
          type?: string
        }
        Relationships: []
      }
      blog_ai_summaries: {
        Row: {
          created_at: string
          model: string | null
          post_id: string
          provider: string
          summary_md: string | null
        }
        Insert: {
          created_at?: string
          model?: string | null
          post_id: string
          provider?: string
          summary_md?: string | null
        }
        Update: {
          created_at?: string
          model?: string | null
          post_id?: string
          provider?: string
          summary_md?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_ai_summaries_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          parent_id: string | null
          slug: string
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          parent_id?: string | null
          slug: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          slug?: string
          title?: string | null
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
      blog_comment_reactions: {
        Row: {
          comment_id: string
          created_at: string
          reaction: Database["public"]["Enums"]["blog_comment_reaction_type"]
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          reaction: Database["public"]["Enums"]["blog_comment_reaction_type"]
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          reaction?: Database["public"]["Enums"]["blog_comment_reaction_type"]
          user_id?: string
        }
        Relationships: []
      }
      blog_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          parent_id: string | null
          post_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "blog_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
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
      blog_post_discussions: {
        Row: {
          author_id: string
          created_at: string
          id: string
          kind: string
          message: string
          post_id: string
        }
        Insert: {
          author_id: string
          created_at?: string
          id?: string
          kind?: string
          message: string
          post_id: string
        }
        Update: {
          author_id?: string
          created_at?: string
          id?: string
          kind?: string
          message?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_post_discussions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_post_feedback: {
        Row: {
          created_at: string
          id: string
          message: string
          post_id: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          post_id: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          post_id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_post_feedback_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_post_tags: {
        Row: {
          post_id: string
          tag_id: string
        }
        Insert: {
          post_id: string
          tag_id: string
        }
        Update: {
          post_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_post_tags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_post_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "blog_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          author_id: string
          category_id: string | null
          content: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          is_featured: boolean
          likes_count: number
          published_at: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          slug: string | null
          status: Database["public"]["Enums"]["blog_post_status"]
          submitted_at: string | null
          tags: string[] | null
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          author_id: string
          category_id?: string | null
          content?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_featured?: boolean
          likes_count?: number
          published_at?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["blog_post_status"]
          submitted_at?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          author_id?: string
          category_id?: string | null
          content?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_featured?: boolean
          likes_count?: number
          published_at?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["blog_post_status"]
          submitted_at?: string | null
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
          {
            foreignKeyName: "blog_posts_reviewed_by_profiles_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      blog_reactions: {
        Row: {
          created_at: string
          post_id: string
          reaction: Database["public"]["Enums"]["blog_reaction_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          reaction: Database["public"]["Enums"]["blog_reaction_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          reaction?: Database["public"]["Enums"]["blog_reaction_type"]
          user_id?: string
        }
        Relationships: []
      }
      blog_review_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by: string
          created_at: string
          id: string
          notes: string | null
          post_id: string
          reviewed_at: string | null
          reviewer_id: string
          status: Database["public"]["Enums"]["review_assignment_status"]
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by: string
          created_at?: string
          id?: string
          notes?: string | null
          post_id: string
          reviewed_at?: string | null
          reviewer_id: string
          status?: Database["public"]["Enums"]["review_assignment_status"]
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string
          created_at?: string
          id?: string
          notes?: string | null
          post_id?: string
          reviewed_at?: string | null
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
      blog_shares: {
        Row: {
          created_at: string
          id: string
          platform: string
          post_id: string
          shared_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          platform: string
          post_id: string
          shared_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          post_id?: string
          shared_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_shares_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_tags: {
        Row: {
          created_at: string
          id: string
          slug: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          slug: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          slug?: string
          title?: string
        }
        Relationships: []
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
      consult_pricing: {
        Row: {
          base_rate: number
          created_at: string
          currency: string
          guru_id: string
          id: string
          is_public: boolean
          note: string | null
          session_durations: number[]
          updated_at: string
        }
        Insert: {
          base_rate?: number
          created_at?: string
          currency?: string
          guru_id: string
          id?: string
          is_public?: boolean
          note?: string | null
          session_durations?: number[]
          updated_at?: string
        }
        Update: {
          base_rate?: number
          created_at?: string
          currency?: string
          guru_id?: string
          id?: string
          is_public?: boolean
          note?: string | null
          session_durations?: number[]
          updated_at?: string
        }
        Relationships: []
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
      curriculum_map: {
        Row: {
          created_at: string
          exam_type: Database["public"]["Enums"]["exam_type_enum"] | null
          id: string
          key_capability_number: number
          key_capability_title: string
          slo_number: number
          slo_title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          exam_type?: Database["public"]["Enums"]["exam_type_enum"] | null
          id?: string
          key_capability_number: number
          key_capability_title: string
          slo_number: number
          slo_title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          exam_type?: Database["public"]["Enums"]["exam_type_enum"] | null
          id?: string
          key_capability_number?: number
          key_capability_title?: string
          slo_number?: number
          slo_title?: string
          updated_at?: string
        }
        Relationships: []
      }
      curriculum_slos: {
        Row: {
          code: string
          id: string
          title: string
        }
        Insert: {
          code: string
          id?: string
          title: string
        }
        Update: {
          code?: string
          id?: string
          title?: string
        }
        Relationships: []
      }
      email_events: {
        Row: {
          created_at: string
          email: string
          event: string
          id: string
          metadata: Json
          provider_message_id: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          event: string
          id?: string
          metadata?: Json
          provider_message_id?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          event?: string
          id?: string
          metadata?: Json
          provider_message_id?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      exam_attempt_items: {
        Row: {
          attempt_id: string
          correct_key: string | null
          created_at: string
          id: string
          position: number | null
          question_id: string
          selected_key: string | null
          topic: string | null
          user_id: string
        }
        Insert: {
          attempt_id: string
          correct_key?: string | null
          created_at?: string
          id?: string
          position?: number | null
          question_id: string
          selected_key?: string | null
          topic?: string | null
          user_id: string
        }
        Update: {
          attempt_id?: string
          correct_key?: string | null
          created_at?: string
          id?: string
          position?: number | null
          question_id?: string
          selected_key?: string | null
          topic?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_attempt_items_attempt_fk"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "exam_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_attempts: {
        Row: {
          breakdown: Json | null
          correct_count: number
          created_at: string
          duration_sec: number
          finished_at: string | null
          id: string
          mode: string
          question_ids: string[]
          source: string
          started_at: string
          total_attempted: number
          total_questions: number
          updated_at: string
          user_id: string
        }
        Insert: {
          breakdown?: Json | null
          correct_count?: number
          created_at?: string
          duration_sec?: number
          finished_at?: string | null
          id?: string
          mode: string
          question_ids: string[]
          source?: string
          started_at?: string
          total_attempted?: number
          total_questions?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          breakdown?: Json | null
          correct_count?: number
          created_at?: string
          duration_sec?: number
          finished_at?: string | null
          id?: string
          mode?: string
          question_ids?: string[]
          source?: string
          started_at?: string
          total_attempted?: number
          total_questions?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      exam_question_discussions: {
        Row: {
          author_id: string
          created_at: string
          id: string
          kind: string
          message: string
          question_id: string
        }
        Insert: {
          author_id: string
          created_at?: string
          id?: string
          kind?: string
          message: string
          question_id: string
        }
        Update: {
          author_id?: string
          created_at?: string
          id?: string
          kind?: string
          message?: string
          question_id?: string
        }
        Relationships: []
      }
      exam_question_flags: {
        Row: {
          assigned_to: string | null
          comment: string | null
          created_at: string
          flagged_by: string
          id: string
          question_id: string
          question_source: string
          resolution_note: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["flag_status"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          comment?: string | null
          created_at?: string
          flagged_by: string
          id?: string
          question_id: string
          question_source?: string
          resolution_note?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["flag_status"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          comment?: string | null
          created_at?: string
          flagged_by?: string
          id?: string
          question_id?: string
          question_source?: string
          resolution_note?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["flag_status"]
          updated_at?: string
        }
        Relationships: []
      }
      exam_review_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by: string
          created_at: string
          id: string
          note: string | null
          question_id: string
          reviewed_at: string | null
          reviewer_id: string
          status: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by: string
          created_at?: string
          id?: string
          note?: string | null
          question_id: string
          reviewed_at?: string | null
          reviewer_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string
          created_at?: string
          id?: string
          note?: string | null
          question_id?: string
          reviewed_at?: string | null
          reviewer_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_review_assignments_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      forum_flags: {
        Row: {
          assigned_to: string | null
          created_at: string
          flagged_by: string
          id: string
          reason: string
          reply_id: string | null
          resolution_note: string | null
          status: Database["public"]["Enums"]["forum_flag_status"]
          thread_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          flagged_by: string
          id?: string
          reason: string
          reply_id?: string | null
          resolution_note?: string | null
          status?: Database["public"]["Enums"]["forum_flag_status"]
          thread_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          flagged_by?: string
          id?: string
          reason?: string
          reply_id?: string | null
          resolution_note?: string | null
          status?: Database["public"]["Enums"]["forum_flag_status"]
          thread_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      forum_likes: {
        Row: {
          created_at: string
          id: string
          reply_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reply_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reply_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_likes_reply_id_fkey"
            columns: ["reply_id"]
            isOneToOne: false
            referencedRelation: "forum_replies"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_reactions: {
        Row: {
          created_at: string
          id: string
          reaction: string
          reply_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reaction: string
          reply_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reaction?: string
          reply_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_reactions_reply_id_fkey"
            columns: ["reply_id"]
            isOneToOne: false
            referencedRelation: "forum_replies"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_replies: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          parent_id: string | null
          thread_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          parent_id?: string | null
          thread_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          thread_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_replies_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "forum_replies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_replies_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "forum_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_reply_votes: {
        Row: {
          created_at: string
          id: string
          reply_id: string
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          reply_id: string
          updated_at?: string
          user_id: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          reply_id?: string
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "forum_reply_votes_reply_id_fkey"
            columns: ["reply_id"]
            isOneToOne: false
            referencedRelation: "forum_replies"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_section_requests: {
        Row: {
          created_at: string
          description: string | null
          id: string
          status: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          status?: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      forum_thread_votes: {
        Row: {
          created_at: string
          id: string
          thread_id: string
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          thread_id: string
          updated_at?: string
          user_id: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          thread_id?: string
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "forum_thread_votes_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "forum_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_threads: {
        Row: {
          author_id: string
          category_id: string
          closed: boolean
          content: string
          created_at: string
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          category_id: string
          closed?: boolean
          content: string
          created_at?: string
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          category_id?: string
          closed?: boolean
          content?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_threads_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "forum_categories"
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
      gurus: {
        Row: {
          created_at: string
          exams: string[]
          id: string
          name: string
          specialty: string | null
        }
        Insert: {
          created_at?: string
          exams?: string[]
          id?: string
          name: string
          specialty?: string | null
        }
        Update: {
          created_at?: string
          exams?: string[]
          id?: string
          name?: string
          specialty?: string | null
        }
        Relationships: []
      }
      knowledge_base: {
        Row: {
          content: string | null
          created_at: string | null
          exam_type: Database["public"]["Enums"]["exam_type_enum"]
          file_url: string | null
          id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          exam_type: Database["public"]["Enums"]["exam_type_enum"]
          file_url?: string | null
          id?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          exam_type?: Database["public"]["Enums"]["exam_type_enum"]
          file_url?: string | null
          id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      knowledge_base_slos: {
        Row: {
          created_at: string | null
          kb_id: string
          slo_id: string
        }
        Insert: {
          created_at?: string | null
          kb_id: string
          slo_id: string
        }
        Update: {
          created_at?: string | null
          kb_id?: string
          slo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_slos_kb_id_fkey"
            columns: ["kb_id"]
            isOneToOne: false
            referencedRelation: "knowledge_base"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_base_slos_slo_id_fkey"
            columns: ["slo_id"]
            isOneToOne: false
            referencedRelation: "curriculum_slos"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base_terms: {
        Row: {
          created_at: string | null
          kb_id: string
          term_id: string
        }
        Insert: {
          created_at?: string | null
          kb_id: string
          term_id: string
        }
        Update: {
          created_at?: string | null
          kb_id?: string
          term_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_terms_kb_id_fkey"
            columns: ["kb_id"]
            isOneToOne: false
            referencedRelation: "knowledge_base"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_base_terms_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "taxonomy_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          source_page: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          source_page?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          source_page?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json
          id: string
          read_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          read_at?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          read_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
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
          cover_image_url: string | null
          created_at: string
          credentials: string | null
          email: string | null
          employer_tags: string[] | null
          exam_interests: string[]
          exams: string[] | null
          facebook: string | null
          full_name: string | null
          github: string | null
          hospital: string | null
          id: string
          instagram: string | null
          languages: string[] | null
          linkedin: string | null
          notification_settings: Json | null
          onboarding_progress: Json
          onboarding_required: boolean
          phone: string | null
          position: string | null
          position_tags: string[] | null
          price_per_30min: number | null
          primary_specialty: string | null
          show_profile_public: boolean
          show_socials_public: boolean
          specialty: string | null
          subscription_tier:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          timezone: string | null
          title: string | null
          twitter: string | null
          updated_at: string
          user_id: string
          website: string | null
          years_experience: number | null
          youtube: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          calendar_sync_token?: string | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string
          credentials?: string | null
          email?: string | null
          employer_tags?: string[] | null
          exam_interests?: string[]
          exams?: string[] | null
          facebook?: string | null
          full_name?: string | null
          github?: string | null
          hospital?: string | null
          id?: string
          instagram?: string | null
          languages?: string[] | null
          linkedin?: string | null
          notification_settings?: Json | null
          onboarding_progress?: Json
          onboarding_required?: boolean
          phone?: string | null
          position?: string | null
          position_tags?: string[] | null
          price_per_30min?: number | null
          primary_specialty?: string | null
          show_profile_public?: boolean
          show_socials_public?: boolean
          specialty?: string | null
          subscription_tier?:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          timezone?: string | null
          title?: string | null
          twitter?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
          years_experience?: number | null
          youtube?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          calendar_sync_token?: string | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string
          credentials?: string | null
          email?: string | null
          employer_tags?: string[] | null
          exam_interests?: string[]
          exams?: string[] | null
          facebook?: string | null
          full_name?: string | null
          github?: string | null
          hospital?: string | null
          id?: string
          instagram?: string | null
          languages?: string[] | null
          linkedin?: string | null
          notification_settings?: Json | null
          onboarding_progress?: Json
          onboarding_required?: boolean
          phone?: string | null
          position?: string | null
          position_tags?: string[] | null
          price_per_30min?: number | null
          primary_specialty?: string | null
          show_profile_public?: boolean
          show_socials_public?: boolean
          specialty?: string | null
          subscription_tier?:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          timezone?: string | null
          title?: string | null
          twitter?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
          years_experience?: number | null
          youtube?: string | null
        }
        Relationships: []
      }
      question_curriculum_map: {
        Row: {
          created_at: string
          curriculum_id: string
          question_id: string
        }
        Insert: {
          created_at?: string
          curriculum_id: string
          question_id: string
        }
        Update: {
          created_at?: string
          curriculum_id?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_curriculum_map_curriculum_id_fkey"
            columns: ["curriculum_id"]
            isOneToOne: false
            referencedRelation: "curriculum_map"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_curriculum_map_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      question_set_items: {
        Row: {
          created_at: string
          position: number
          question_id: string
          set_id: string
        }
        Insert: {
          created_at?: string
          position?: number
          question_id: string
          set_id: string
        }
        Update: {
          created_at?: string
          position?: number
          question_id?: string
          set_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_set_items_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "question_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      question_sets: {
        Row: {
          created_at: string
          created_by: string
          currency: Database["public"]["Enums"]["currency_code"]
          description: string | null
          id: string
          price_cents: number
          status: Database["public"]["Enums"]["question_set_status"]
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          currency?: Database["public"]["Enums"]["currency_code"]
          description?: string | null
          id?: string
          price_cents?: number
          status?: Database["public"]["Enums"]["question_set_status"]
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          description?: string | null
          id?: string
          price_cents?: number
          status?: Database["public"]["Enums"]["question_set_status"]
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      question_slos: {
        Row: {
          question_id: string
          slo_id: string
        }
        Insert: {
          question_id: string
          slo_id: string
        }
        Update: {
          question_id?: string
          slo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_slos_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "reviewed_exam_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_slos_slo_id_fkey"
            columns: ["slo_id"]
            isOneToOne: false
            referencedRelation: "curriculum_slos"
            referencedColumns: ["id"]
          },
        ]
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
      rate_limit_log: {
        Row: {
          blocked: boolean
          created_at: string
          endpoint: string
          id: string
          ip_address: unknown
          request_count: number
          user_id: string | null
          window_start: string
        }
        Insert: {
          blocked?: boolean
          created_at?: string
          endpoint: string
          id?: string
          ip_address: unknown
          request_count?: number
          user_id?: string | null
          window_start?: string
        }
        Update: {
          blocked?: boolean
          created_at?: string
          endpoint?: string
          id?: string
          ip_address?: unknown
          request_count?: number
          user_id?: string | null
          window_start?: string
        }
        Relationships: []
      }
      rcem_slos: {
        Row: {
          code: string
          created_at: string | null
          exam: Database["public"]["Enums"]["exam_type_enum"] | null
          id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          exam?: Database["public"]["Enums"]["exam_type_enum"] | null
          id?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          exam?: Database["public"]["Enums"]["exam_type_enum"] | null
          id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      reactions: {
        Row: {
          content_id: string
          created_at: string
          emoji: string
          id: string
          target: Database["public"]["Enums"]["reaction_target"]
          updated_at: string
          user_id: string
        }
        Insert: {
          content_id: string
          created_at?: string
          emoji: string
          id?: string
          target: Database["public"]["Enums"]["reaction_target"]
          updated_at?: string
          user_id: string
        }
        Update: {
          content_id?: string
          created_at?: string
          emoji?: string
          id?: string
          target?: Database["public"]["Enums"]["reaction_target"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      review_assignments: {
        Row: {
          assigned_at: string
          created_at: string
          guru_id: string
          id: string
          question_id: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          created_at?: string
          guru_id: string
          id?: string
          question_id: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          created_at?: string
          guru_id?: string
          id?: string
          question_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_assignments_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "exam_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_assignments_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "review_exam_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      review_exam_questions: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          correct_answer: string
          created_at: string
          created_by: string
          exam_type: Database["public"]["Enums"]["exam_type_enum"] | null
          explanation: string | null
          id: string
          options: Json
          question: string
          status: Database["public"]["Enums"]["review_question_status"]
          tags: string[] | null
          topic: string | null
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          correct_answer: string
          created_at?: string
          created_by: string
          exam_type?: Database["public"]["Enums"]["exam_type_enum"] | null
          explanation?: string | null
          id?: string
          options: Json
          question: string
          status?: Database["public"]["Enums"]["review_question_status"]
          tags?: string[] | null
          topic?: string | null
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          correct_answer?: string
          created_at?: string
          created_by?: string
          exam_type?: Database["public"]["Enums"]["exam_type_enum"] | null
          explanation?: string | null
          id?: string
          options?: Json
          question?: string
          status?: Database["public"]["Enums"]["review_question_status"]
          tags?: string[] | null
          topic?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      review_feedback: {
        Row: {
          approved: boolean | null
          assignment_id: string
          created_at: string
          feedback: string | null
          guru_id: string
          id: string
          reviewed_at: string
          stars: number | null
          updated_at: string
        }
        Insert: {
          approved?: boolean | null
          assignment_id: string
          created_at?: string
          feedback?: string | null
          guru_id: string
          id?: string
          reviewed_at?: string
          stars?: number | null
          updated_at?: string
        }
        Update: {
          approved?: boolean | null
          assignment_id?: string
          created_at?: string
          feedback?: string | null
          guru_id?: string
          id?: string
          reviewed_at?: string
          stars?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_feedback_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "review_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      review_invitations: {
        Row: {
          created_at: string
          email: string
          id: string
          source: string
          status: string
          trustpilot_invite_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          source: string
          status?: string
          trustpilot_invite_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          source?: string
          status?: string
          trustpilot_invite_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      review_publish_log: {
        Row: {
          id: string
          published_at: string
          published_by: string
          question_id: string
        }
        Insert: {
          id?: string
          published_at?: string
          published_by: string
          question_id: string
        }
        Update: {
          id?: string
          published_at?: string
          published_by?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_publish_log_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "exam_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_publish_log_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "review_exam_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      reviewed_exam_questions: {
        Row: {
          answer_key: string | null
          correct_index: number | null
          created_at: string
          difficulty: string | null
          exam: string
          explanation: string | null
          id: string
          options: string[] | null
          reviewed_at: string | null
          reviewer_id: string | null
          status: string
          stem: string
          subtopic: string | null
          tags: string[] | null
          topic: string | null
          updated_at: string
        }
        Insert: {
          answer_key?: string | null
          correct_index?: number | null
          created_at?: string
          difficulty?: string | null
          exam: string
          explanation?: string | null
          id?: string
          options?: string[] | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: string
          stem: string
          subtopic?: string | null
          tags?: string[] | null
          topic?: string | null
          updated_at?: string
        }
        Update: {
          answer_key?: string | null
          correct_index?: number | null
          created_at?: string
          difficulty?: string | null
          exam?: string
          explanation?: string | null
          id?: string
          options?: string[] | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: string
          stem?: string
          subtopic?: string | null
          tags?: string[] | null
          topic?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviewed_exam_questions_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "gurus"
            referencedColumns: ["id"]
          },
        ]
      }
      security_audit_log: {
        Row: {
          created_at: string
          id: string
          ip_address: unknown | null
          new_data: Json | null
          old_data: Json | null
          operation: string
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: unknown | null
          new_data?: Json | null
          old_data?: Json | null
          operation: string
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: unknown | null
          new_data?: Json | null
          old_data?: Json | null
          operation?: string
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      security_config: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
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
      taxonomy_post_terms: {
        Row: {
          created_at: string
          post_id: string
          term_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          term_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          term_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_tpt_post"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taxonomy_post_terms_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "taxonomy_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      taxonomy_profile_terms: {
        Row: {
          created_at: string
          profile_id: string
          term_id: string
        }
        Insert: {
          created_at?: string
          profile_id: string
          term_id: string
        }
        Update: {
          created_at?: string
          profile_id?: string
          term_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_tpr_profile"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taxonomy_profile_terms_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "taxonomy_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      taxonomy_question_terms: {
        Row: {
          created_at: string
          question_id: string
          term_id: string
        }
        Insert: {
          created_at?: string
          question_id: string
          term_id: string
        }
        Update: {
          created_at?: string
          question_id?: string
          term_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_tqt_question"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taxonomy_question_terms_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "taxonomy_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      taxonomy_terms: {
        Row: {
          created_at: string
          description: string | null
          id: string
          kind: Database["public"]["Enums"]["taxonomy_type"]
          parent_id: string | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          kind: Database["public"]["Enums"]["taxonomy_type"]
          parent_id?: string | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["taxonomy_type"]
          parent_id?: string | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "taxonomy_terms_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "taxonomy_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      taxonomy_thread_terms: {
        Row: {
          created_at: string
          term_id: string
          thread_id: string
        }
        Insert: {
          created_at?: string
          term_id: string
          thread_id: string
        }
        Update: {
          created_at?: string
          term_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_ttt_thread"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "forum_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taxonomy_thread_terms_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "taxonomy_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      user_exam_sessions: {
        Row: {
          completed_at: string | null
          correct: number
          created_at: string
          exam: string
          id: string
          started_at: string
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          correct?: number
          created_at?: string
          exam: string
          id?: string
          started_at?: string
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          correct?: number
          created_at?: string
          exam?: string
          id?: string
          started_at?: string
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_question_events: {
        Row: {
          created_at: string
          id: string
          outcome: string
          question_id: string
          session_id: string
          time_ms: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          outcome: string
          question_id: string
          session_id: string
          time_ms?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          outcome?: string
          question_id?: string
          session_id?: string
          time_ms?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_question_events_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "reviewed_exam_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_question_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "user_exam_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_question_sessions: {
        Row: {
          attempts: number
          created_at: string
          exam: string
          id: string
          is_correct: boolean
          is_flagged: boolean
          last_action_at: string
          last_selected: string | null
          notes: string | null
          question_id: string
          started_at: string
          time_spent_seconds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          exam: string
          id?: string
          is_correct?: boolean
          is_flagged?: boolean
          last_action_at?: string
          last_selected?: string | null
          notes?: string | null
          question_id: string
          started_at?: string
          time_spent_seconds?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          exam?: string
          id?: string
          is_correct?: boolean
          is_flagged?: boolean
          last_action_at?: string
          last_selected?: string | null
          notes?: string | null
          question_id?: string
          started_at?: string
          time_spent_seconds?: number
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
      user_social_accounts: {
        Row: {
          avatar_url: string | null
          connected_at: string
          external_user_id: string | null
          handle: string | null
          id: string
          profile_url: string | null
          provider: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          connected_at?: string
          external_user_id?: string | null
          handle?: string | null
          id?: string
          profile_url?: string | null
          provider: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          connected_at?: string
          external_user_id?: string | null
          handle?: string | null
          id?: string
          profile_url?: string | null
          provider?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      exam_questions: {
        Row: {
          choices: Json | null
          correct_index: number | null
          created_at: string | null
          created_by: string | null
          exam_type: Database["public"]["Enums"]["exam_type_enum"] | null
          explanation: string | null
          id: string | null
          status: string | null
          stem: string | null
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          choices?: Json | null
          correct_index?: never
          created_at?: string | null
          created_by?: string | null
          exam_type?: Database["public"]["Enums"]["exam_type_enum"] | null
          explanation?: string | null
          id?: string | null
          status?: never
          stem?: string | null
          tags?: never
          updated_at?: string | null
        }
        Update: {
          choices?: Json | null
          correct_index?: never
          created_at?: string | null
          created_by?: string | null
          exam_type?: Database["public"]["Enums"]["exam_type_enum"] | null
          explanation?: string | null
          id?: string | null
          status?: never
          stem?: string | null
          tags?: never
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _map_exam_type_to_enum: {
        Args: { _val: string }
        Returns: Database["public"]["Enums"]["exam_type_enum"]
      }
      _require_auth: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      ai_search_content: {
        Args: {
          filter_source?: string
          match_count?: number
          query_embedding: string
        }
        Returns: {
          id: string
          similarity: number
          slug_url: string
          source_type: string
          tags: string[]
          text_chunk: string
          title: string
        }[]
      }
      assign_reviewer: {
        Args: { p_note: string; p_post_id: string; p_reviewer_id: string }
        Returns: undefined
      }
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      check_rate_limit: {
        Args: { endpoint_name: string; max_requests_per_minute?: number }
        Returns: boolean
      }
      cleanup_old_audit_logs: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      create_blog_draft: {
        Args: {
          p_category_id: string
          p_content_md: string
          p_tags: string[]
          p_title: string
        }
        Returns: {
          assigned_at: string | null
          assigned_by: string | null
          author_id: string
          category_id: string | null
          content: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          is_featured: boolean
          likes_count: number
          published_at: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          slug: string | null
          status: Database["public"]["Enums"]["blog_post_status"]
          submitted_at: string | null
          tags: string[] | null
          title: string
          updated_at: string
          view_count: number
        }
      }
      create_exam_draft: {
        Args: {
          p_choices: Json
          p_correct_index: number
          p_exam_type: Database["public"]["Enums"]["exam_type_enum"]
          p_explanation: string
          p_stem: string
          p_tags: string[]
        }
        Returns: {
          choices: Json | null
          correct_index: number | null
          created_at: string | null
          created_by: string | null
          exam_type: Database["public"]["Enums"]["exam_type_enum"] | null
          explanation: string | null
          id: string | null
          status: string | null
          stem: string | null
          tags: string[] | null
          updated_at: string | null
        }[]
      }
      exam_approve: {
        Args: { p_question_id: string }
        Returns: undefined
      }
      exam_publish: {
        Args: { p_question_id: string }
        Returns: undefined
      }
      exam_request_changes: {
        Args: { p_note: string; p_question_id: string }
        Returns: undefined
      }
      export_user_data: {
        Args: { target_user_id: string }
        Returns: Json
      }
      get_booking_summary: {
        Args: { booking_id: string }
        Returns: {
          communication_method: Database["public"]["Enums"]["communication_method"]
          end_datetime: string
          id: string
          meeting_link: string
          start_datetime: string
          status: Database["public"]["Enums"]["booking_status"]
        }[]
      }
      get_public_guru_profile: {
        Args: { guru_user_id: string }
        Returns: {
          avatar_url: string
          bio: string
          country: string
          cover_image_url: string
          created_at: string
          credentials: string
          exams: string[]
          facebook: string
          full_name: string
          github: string
          hospital: string
          id: string
          instagram: string
          languages: string[]
          linkedin: string
          price_per_30min: number
          primary_specialty: string
          specialty: string
          timezone: string
          title: string
          twitter: string
          updated_at: string
          user_id: string
          user_position: string
          website: string
          years_experience: number
          youtube: string
        }[]
      }
      get_user_role_flags: {
        Args: { p_user_id: string }
        Returns: {
          is_admin: boolean
          is_guru: boolean
        }[]
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: string
      }
      list_all_posts_admin: {
        Args: { p_limit: number; p_offset: number; p_status: string }
        Returns: {
          assigned_at: string | null
          assigned_by: string | null
          author_id: string
          category_id: string | null
          content: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          is_featured: boolean
          likes_count: number
          published_at: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          slug: string | null
          status: Database["public"]["Enums"]["blog_post_status"]
          submitted_at: string | null
          tags: string[] | null
          title: string
          updated_at: string
          view_count: number
        }[]
      }
      list_exam_reviewer_queue: {
        Args: { p_limit: number; p_offset: number }
        Returns: {
          choices: Json | null
          correct_index: number | null
          created_at: string | null
          created_by: string | null
          exam_type: Database["public"]["Enums"]["exam_type_enum"] | null
          explanation: string | null
          id: string | null
          status: string | null
          stem: string | null
          tags: string[] | null
          updated_at: string | null
        }[]
      }
      list_my_drafts: {
        Args: { p_limit: number; p_offset: number }
        Returns: {
          assigned_at: string | null
          assigned_by: string | null
          author_id: string
          category_id: string | null
          content: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          is_featured: boolean
          likes_count: number
          published_at: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          slug: string | null
          status: Database["public"]["Enums"]["blog_post_status"]
          submitted_at: string | null
          tags: string[] | null
          title: string
          updated_at: string
          view_count: number
        }[]
      }
      list_my_exam_drafts: {
        Args: { p_limit: number; p_offset: number }
        Returns: {
          choices: Json | null
          correct_index: number | null
          created_at: string | null
          created_by: string | null
          exam_type: Database["public"]["Enums"]["exam_type_enum"] | null
          explanation: string | null
          id: string | null
          status: string | null
          stem: string | null
          tags: string[] | null
          updated_at: string | null
        }[]
      }
      list_my_exam_submissions: {
        Args: { p_limit: number; p_offset: number }
        Returns: {
          choices: Json | null
          correct_index: number | null
          created_at: string | null
          created_by: string | null
          exam_type: Database["public"]["Enums"]["exam_type_enum"] | null
          explanation: string | null
          id: string | null
          status: string | null
          stem: string | null
          tags: string[] | null
          updated_at: string | null
        }[]
      }
      list_my_submissions: {
        Args: { p_limit: number; p_offset: number }
        Returns: {
          assigned_at: string | null
          assigned_by: string | null
          author_id: string
          category_id: string | null
          content: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          is_featured: boolean
          likes_count: number
          published_at: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          slug: string | null
          status: Database["public"]["Enums"]["blog_post_status"]
          submitted_at: string | null
          tags: string[] | null
          title: string
          updated_at: string
          view_count: number
        }[]
      }
      list_public_reviewed_questions: {
        Args: {
          p_exam?: string
          p_limit?: number
          p_offset?: number
          p_q?: string
          p_topic?: string
        }
        Returns: {
          exam_type: string
          id: string
          reviewed_at: string
          stem: string
        }[]
      }
      list_reviewer_queue: {
        Args: { p_limit: number; p_offset: number }
        Returns: {
          assigned_at: string | null
          assigned_by: string | null
          author_id: string
          category_id: string | null
          content: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          is_featured: boolean
          likes_count: number
          published_at: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          slug: string | null
          status: Database["public"]["Enums"]["blog_post_status"]
          submitted_at: string | null
          tags: string[] | null
          title: string
          updated_at: string
          view_count: number
        }[]
      }
      review_approve_publish: {
        Args: { p_post_id: string }
        Returns: undefined
      }
      review_request_changes: {
        Args: { p_note: string; p_post_id: string }
        Returns: undefined
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      submit_blog_for_review: {
        Args: { p_post_id: string }
        Returns: undefined
      }
      submit_exam_for_review: {
        Args: { p_question_id: string }
        Returns: undefined
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      ai_answer_feedback:
        | "none"
        | "too_easy"
        | "hallucinated"
        | "wrong"
        | "not_relevant"
      app_role: "user" | "guru" | "admin"
      availability_type: "default" | "exception"
      blog_comment_reaction_type: "like" | "thumbs_up" | "thumbs_down"
      blog_post_status: "draft" | "in_review" | "published" | "archived"
      blog_reaction_type:
        | "like"
        | "love"
        | "insightful"
        | "curious"
        | "thumbs_up"
        | "thumbs_down"
      booking_payment_status: "unpaid" | "paid" | "refunded"
      booking_status:
        | "pending_payment"
        | "confirmed"
        | "cancelled"
        | "completed"
      communication_method: "zoom" | "google_meet" | "phone"
      currency_code: "USD" | "GBP" | "PKR"
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
      exam_type_enum:
        | "MRCEM_PRIMARY"
        | "MRCEM_SBA"
        | "FRCEM_SBA"
        | "OTHER"
        | "FCPS_PART1"
        | "FCPS_IMM"
        | "FCPS_PART2"
      flag_status: "open" | "assigned" | "resolved" | "removed" | "archived"
      forum_flag_status: "open" | "in_review" | "resolved" | "dismissed"
      guru_application_status: "pending" | "approved" | "rejected"
      notification_type:
        | "question_flagged"
        | "flag_assigned"
        | "flag_resolved"
        | "assignment_created"
        | "message"
        | "system"
      payment_method: "stripe" | "paypal" | "free"
      payment_status: "pending" | "completed" | "refunded" | "failed"
      post_status: "draft" | "submitted" | "approved" | "rejected" | "published"
      question_set_status: "draft" | "published" | "archived"
      question_status: "pending" | "approved" | "rejected"
      reaction_target:
        | "forum_thread"
        | "forum_reply"
        | "blog_post"
        | "blog_comment"
        | "exam_question"
        | "exam_answer"
      reminder_type: "email" | "sms" | "whatsapp" | "one_hour_before"
      review_assignment_status:
        | "pending"
        | "completed"
        | "cancelled"
        | "pending_review"
      review_question_status: "draft" | "under_review" | "published"
      subscription_tier: "free" | "exam" | "consultation" | "premium"
      taxonomy_type: "specialty" | "category" | "topic" | "exam" | "forum"
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
      ai_answer_feedback: [
        "none",
        "too_easy",
        "hallucinated",
        "wrong",
        "not_relevant",
      ],
      app_role: ["user", "guru", "admin"],
      availability_type: ["default", "exception"],
      blog_comment_reaction_type: ["like", "thumbs_up", "thumbs_down"],
      blog_post_status: ["draft", "in_review", "published", "archived"],
      blog_reaction_type: [
        "like",
        "love",
        "insightful",
        "curious",
        "thumbs_up",
        "thumbs_down",
      ],
      booking_payment_status: ["unpaid", "paid", "refunded"],
      booking_status: [
        "pending_payment",
        "confirmed",
        "cancelled",
        "completed",
      ],
      communication_method: ["zoom", "google_meet", "phone"],
      currency_code: ["USD", "GBP", "PKR"],
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
      exam_type_enum: [
        "MRCEM_PRIMARY",
        "MRCEM_SBA",
        "FRCEM_SBA",
        "OTHER",
        "FCPS_PART1",
        "FCPS_IMM",
        "FCPS_PART2",
      ],
      flag_status: ["open", "assigned", "resolved", "removed", "archived"],
      forum_flag_status: ["open", "in_review", "resolved", "dismissed"],
      guru_application_status: ["pending", "approved", "rejected"],
      notification_type: [
        "question_flagged",
        "flag_assigned",
        "flag_resolved",
        "assignment_created",
        "message",
        "system",
      ],
      payment_method: ["stripe", "paypal", "free"],
      payment_status: ["pending", "completed", "refunded", "failed"],
      post_status: ["draft", "submitted", "approved", "rejected", "published"],
      question_set_status: ["draft", "published", "archived"],
      question_status: ["pending", "approved", "rejected"],
      reaction_target: [
        "forum_thread",
        "forum_reply",
        "blog_post",
        "blog_comment",
        "exam_question",
        "exam_answer",
      ],
      reminder_type: ["email", "sms", "whatsapp", "one_hour_before"],
      review_assignment_status: [
        "pending",
        "completed",
        "cancelled",
        "pending_review",
      ],
      review_question_status: ["draft", "under_review", "published"],
      subscription_tier: ["free", "exam", "consultation", "premium"],
      taxonomy_type: ["specialty", "category", "topic", "exam", "forum"],
    },
  },
} as const
