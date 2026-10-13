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
      ai_usage: {
        Row: {
          captures: number
          company_id: string
          cost_usd_thousandths: number
          month: string
        }
        Insert: {
          captures?: number
          company_id: string
          cost_usd_thousandths?: number
          month: string
        }
        Update: {
          captures?: number
          company_id?: string
          cost_usd_thousandths?: number
          month?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      brand: {
        Row: {
          active: boolean
          company_id: string
          group_name: string | null
          id: number
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id: string
          group_name?: string | null
          id?: never
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          group_name?: string | null
          id?: never
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      comment: {
        Row: {
          author_id: string
          body: string
          company_id: string
          created_at: string
          display_id: string | null
          id: string
          kind: Database["public"]["Enums"]["comment_kind"]
          visit_id: string
        }
        Insert: {
          author_id: string
          body: string
          company_id: string
          created_at?: string
          display_id?: string | null
          id?: string
          kind: Database["public"]["Enums"]["comment_kind"]
          visit_id: string
        }
        Update: {
          author_id?: string
          body?: string
          company_id?: string
          created_at?: string
          display_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["comment_kind"]
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_company_id_visit_id_display_id_fkey"
            columns: ["company_id", "visit_id", "display_id"]
            isOneToOne: false
            referencedRelation: "display"
            referencedColumns: ["company_id", "visit_id", "id"]
          },
          {
            foreignKeyName: "comment_company_id_visit_id_display_id_fkey"
            columns: ["company_id", "visit_id", "display_id"]
            isOneToOne: false
            referencedRelation: "display_status"
            referencedColumns: ["company_id", "visit_id", "id"]
          },
          {
            foreignKeyName: "comment_company_id_visit_id_fkey"
            columns: ["company_id", "visit_id"]
            isOneToOne: false
            referencedRelation: "visit"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      company: {
        Row: {
          created_at: string
          geocoding_scope: Database["public"]["Enums"]["geocoding_scope"]
          id: string
          kind: Database["public"]["Enums"]["company_kind"]
          logo_version: number | null
          name: string
          owner_person_id: string | null
          photo_retention_months: number
          require_before_after: boolean
          require_shelf_facings: boolean
          show_whatsapp: boolean
          timezone: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          geocoding_scope?: Database["public"]["Enums"]["geocoding_scope"]
          id?: string
          kind: Database["public"]["Enums"]["company_kind"]
          logo_version?: number | null
          name: string
          owner_person_id?: string | null
          photo_retention_months?: number
          require_before_after?: boolean
          require_shelf_facings?: boolean
          show_whatsapp?: boolean
          timezone?: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          geocoding_scope?: Database["public"]["Enums"]["geocoding_scope"]
          id?: string
          kind?: Database["public"]["Enums"]["company_kind"]
          logo_version?: number | null
          name?: string
          owner_person_id?: string | null
          photo_retention_months?: number
          require_before_after?: boolean
          require_shelf_facings?: boolean
          show_whatsapp?: boolean
          timezone?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "company_owner_person_id_fkey"
            columns: ["owner_person_id"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
        ]
      }
      display: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          display_type_id: number
          id: string
          reference: string | null
          sort_order: number
          source: Database["public"]["Enums"]["display_source"]
          updated_at: string
          version: number
          visit_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          display_type_id: number
          id?: string
          reference?: string | null
          sort_order?: number
          source?: Database["public"]["Enums"]["display_source"]
          updated_at?: string
          version?: number
          visit_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          display_type_id?: number
          id?: string
          reference?: string | null
          sort_order?: number
          source?: Database["public"]["Enums"]["display_source"]
          updated_at?: string
          version?: number
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "display_company_id_display_type_id_fkey"
            columns: ["company_id", "display_type_id"]
            isOneToOne: false
            referencedRelation: "display_type"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "display_company_id_visit_id_fkey"
            columns: ["company_id", "visit_id"]
            isOneToOne: false
            referencedRelation: "visit"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "display_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
        ]
      }
      display_type: {
        Row: {
          active: boolean
          company_id: string
          id: number
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id: string
          id?: never
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          id?: never
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "display_type_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      dni_lookup: {
        Row: {
          company_id: string
          dni_hash: string
          found: boolean
          id: number
          searched_at: string
          searched_by: string
        }
        Insert: {
          company_id: string
          dni_hash: string
          found: boolean
          id?: never
          searched_at?: string
          searched_by: string
        }
        Update: {
          company_id?: string
          dni_hash?: string
          found?: boolean
          id?: never
          searched_at?: string
          searched_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "dni_lookup_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dni_lookup_searched_by_fkey"
            columns: ["searched_by"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
        ]
      }
      import_format: {
        Row: {
          company_id: string
          created_at: string
          id: string
          last_used_at: string | null
          mapping: Json
          name: string
          signature: string
          updated_at: string
          version: number
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          last_used_at?: string | null
          mapping: Json
          name: string
          signature: string
          updated_at?: string
          version?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          last_used_at?: string | null
          mapping?: Json
          name?: string
          signature?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_format_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      membership: {
        Row: {
          company_id: string
          created_at: string
          id: string
          invited_by: string | null
          person_id: string
          roles: Database["public"]["Enums"]["role"][]
          starts_on: string
          status: Database["public"]["Enums"]["membership_status"]
          team_id: string | null
          updated_at: string
          version: number
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          invited_by?: string | null
          person_id: string
          roles: Database["public"]["Enums"]["role"][]
          starts_on?: string
          status?: Database["public"]["Enums"]["membership_status"]
          team_id?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          invited_by?: string | null
          person_id?: string
          roles?: Database["public"]["Enums"]["role"][]
          starts_on?: string
          status?: Database["public"]["Enums"]["membership_status"]
          team_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "membership_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_company_id_team_id_fkey"
            columns: ["company_id", "team_id"]
            isOneToOne: false
            referencedRelation: "team"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "membership_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
        ]
      }
      message_template: {
        Row: {
          body: string
          company_id: string
          kind: Database["public"]["Enums"]["template_kind"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body: string
          company_id: string
          kind: Database["public"]["Enums"]["template_kind"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string
          company_id?: string
          kind?: Database["public"]["Enums"]["template_kind"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_template_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_template_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
        ]
      }
      person: {
        Row: {
          auth_user_id: string | null
          created_at: string
          first_name: string
          id: string
          last_name: string
          updated_at: string
          version: number
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          first_name: string
          id?: string
          last_name: string
          updated_at?: string
          version?: number
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          first_name?: string
          id?: string
          last_name?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      person_private: {
        Row: {
          birth_date: string | null
          dni: string
          person_id: string
          phone: string | null
          phone_verified_at: string | null
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          dni: string
          person_id: string
          phone?: string | null
          phone_verified_at?: string | null
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          dni?: string
          person_id?: string
          phone?: string | null
          phone_verified_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_private_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
        ]
      }
      photo: {
        Row: {
          bytes: number
          company_id: string
          created_at: string
          created_by: string
          deleted_at: string | null
          display_id: string | null
          height: number
          id: string
          kind: Database["public"]["Enums"]["photo_kind"]
          sort_order: number
          taken_at: string
          updated_at: string
          uploaded_at: string | null
          version: number
          visit_id: string
          width: number
        }
        Insert: {
          bytes: number
          company_id: string
          created_at?: string
          created_by: string
          deleted_at?: string | null
          display_id?: string | null
          height: number
          id: string
          kind: Database["public"]["Enums"]["photo_kind"]
          sort_order?: number
          taken_at: string
          updated_at?: string
          uploaded_at?: string | null
          version?: number
          visit_id: string
          width: number
        }
        Update: {
          bytes?: number
          company_id?: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          display_id?: string | null
          height?: number
          id?: string
          kind?: Database["public"]["Enums"]["photo_kind"]
          sort_order?: number
          taken_at?: string
          updated_at?: string
          uploaded_at?: string | null
          version?: number
          visit_id?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "photo_company_id_visit_id_display_id_fkey"
            columns: ["company_id", "visit_id", "display_id"]
            isOneToOne: false
            referencedRelation: "display"
            referencedColumns: ["company_id", "visit_id", "id"]
          },
          {
            foreignKeyName: "photo_company_id_visit_id_display_id_fkey"
            columns: ["company_id", "visit_id", "display_id"]
            isOneToOne: false
            referencedRelation: "display_status"
            referencedColumns: ["company_id", "visit_id", "id"]
          },
          {
            foreignKeyName: "photo_company_id_visit_id_fkey"
            columns: ["company_id", "visit_id"]
            isOneToOne: false
            referencedRelation: "visit"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "photo_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admin: {
        Row: {
          created_at: string
          person_id: string
        }
        Insert: {
          created_at?: string
          person_id: string
        }
        Update: {
          created_at?: string
          person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_admin_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
        ]
      }
      store: {
        Row: {
          address: string
          area: string | null
          company_id: string
          created_at: string
          created_by: string | null
          customer_number: string | null
          deleted_at: string | null
          id: string
          lat: number | null
          lng: number | null
          location_status: Database["public"]["Enums"]["location_status"]
          merged_into: string | null
          name: string | null
          source: Database["public"]["Enums"]["store_source"]
          updated_at: string
          version: number
        }
        Insert: {
          address: string
          area?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_number?: string | null
          deleted_at?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          location_status?: Database["public"]["Enums"]["location_status"]
          merged_into?: string | null
          name?: string | null
          source?: Database["public"]["Enums"]["store_source"]
          updated_at?: string
          version?: number
        }
        Update: {
          address?: string
          area?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_number?: string | null
          deleted_at?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          location_status?: Database["public"]["Enums"]["location_status"]
          merged_into?: string | null
          name?: string | null
          source?: Database["public"]["Enums"]["store_source"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "store_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_company_id_merged_into_fkey"
            columns: ["company_id", "merged_into"]
            isOneToOne: false
            referencedRelation: "store"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "store_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription: {
        Row: {
          auto_debit: boolean
          company_id: string
          currency: string
          ends_on: string | null
          estimated_amount_cents: number | null
          next_billing_on: string | null
          payment_method_summary: string | null
          plan: Database["public"]["Enums"]["plan_kind"]
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
        }
        Insert: {
          auto_debit?: boolean
          company_id: string
          currency?: string
          ends_on?: string | null
          estimated_amount_cents?: number | null
          next_billing_on?: string | null
          payment_method_summary?: string | null
          plan?: Database["public"]["Enums"]["plan_kind"]
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Update: {
          auto_debit?: boolean
          company_id?: string
          currency?: string
          ends_on?: string | null
          estimated_amount_cents?: number | null
          next_billing_on?: string | null
          payment_method_summary?: string | null
          plan?: Database["public"]["Enums"]["plan_kind"]
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      support_access: {
        Row: {
          admin_id: string
          company_id: string
          ends_at: string
          id: string
          reason: string
          starts_at: string
        }
        Insert: {
          admin_id: string
          company_id: string
          ends_at?: string
          id?: string
          reason: string
          starts_at?: string
        }
        Update: {
          admin_id?: string
          company_id?: string
          ends_at?: string
          id?: string
          reason?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_access_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_access_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_report: {
        Row: {
          company_id: string
          failed: number
          oldest_at: string | null
          pending: number
          person_id: string
          photos: number
          reported_at: string
        }
        Insert: {
          company_id: string
          failed?: number
          oldest_at?: string | null
          pending?: number
          person_id: string
          photos?: number
          reported_at?: string
        }
        Update: {
          company_id?: string
          failed?: number
          oldest_at?: string | null
          pending?: number
          person_id?: string
          photos?: number
          reported_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_report_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_report_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
        ]
      }
      team: {
        Row: {
          areas: string | null
          company_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
          version: number
        }
        Insert: {
          areas?: string | null
          company_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          version?: number
        }
        Update: {
          areas?: string | null
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "team_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      visit: {
        Row: {
          added_by: string
          arrived_at: string | null
          company_id: string
          consent: Database["public"]["Enums"]["consent_kind"] | null
          created_at: string
          deleted_at: string | null
          finished_at: string | null
          id: string
          merchandiser_id: string
          notes: string | null
          objection: string | null
          resumed_from: string | null
          retry_after: string | null
          review_status: Database["public"]["Enums"]["review_status"]
          reviewed_at: string | null
          reviewed_by: string | null
          sort_order: number
          source: Database["public"]["Enums"]["visit_source"]
          store_id: string
          task: string | null
          updated_at: string
          updated_by: string | null
          version: number
          work_date: string
          work_status: Database["public"]["Enums"]["work_status"]
          workday_id: string
        }
        Insert: {
          added_by: string
          arrived_at?: string | null
          company_id: string
          consent?: Database["public"]["Enums"]["consent_kind"] | null
          created_at?: string
          deleted_at?: string | null
          finished_at?: string | null
          id?: string
          merchandiser_id: string
          notes?: string | null
          objection?: string | null
          resumed_from?: string | null
          retry_after?: string | null
          review_status?: Database["public"]["Enums"]["review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          sort_order?: number
          source?: Database["public"]["Enums"]["visit_source"]
          store_id: string
          task?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
          work_date: string
          work_status?: Database["public"]["Enums"]["work_status"]
          workday_id: string
        }
        Update: {
          added_by?: string
          arrived_at?: string | null
          company_id?: string
          consent?: Database["public"]["Enums"]["consent_kind"] | null
          created_at?: string
          deleted_at?: string | null
          finished_at?: string | null
          id?: string
          merchandiser_id?: string
          notes?: string | null
          objection?: string | null
          resumed_from?: string | null
          retry_after?: string | null
          review_status?: Database["public"]["Enums"]["review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          sort_order?: number
          source?: Database["public"]["Enums"]["visit_source"]
          store_id?: string
          task?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
          work_date?: string
          work_status?: Database["public"]["Enums"]["work_status"]
          workday_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_company_id_resumed_from_fkey"
            columns: ["company_id", "resumed_from"]
            isOneToOne: false
            referencedRelation: "visit"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "visit_company_id_store_id_fkey"
            columns: ["company_id", "store_id"]
            isOneToOne: false
            referencedRelation: "store"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "visit_company_id_workday_id_fkey"
            columns: ["company_id", "workday_id"]
            isOneToOne: false
            referencedRelation: "workday"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "visit_merchandiser_id_fkey"
            columns: ["merchandiser_id"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_brand: {
        Row: {
          brand_id: number
          company_id: string
          visit_id: string
        }
        Insert: {
          brand_id: number
          company_id: string
          visit_id: string
        }
        Update: {
          brand_id?: number
          company_id?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_brand_company_id_brand_id_fkey"
            columns: ["company_id", "brand_id"]
            isOneToOne: false
            referencedRelation: "brand"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "visit_brand_company_id_visit_id_fkey"
            columns: ["company_id", "visit_id"]
            isOneToOne: false
            referencedRelation: "visit"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      visit_event: {
        Row: {
          actor_id: string | null
          company_id: string
          from_value: string | null
          id: number
          kind: Database["public"]["Enums"]["visit_event_kind"]
          occurred_at: string
          to_value: string | null
          visit_id: string
        }
        Insert: {
          actor_id?: string | null
          company_id: string
          from_value?: string | null
          id?: never
          kind: Database["public"]["Enums"]["visit_event_kind"]
          occurred_at?: string
          to_value?: string | null
          visit_id: string
        }
        Update: {
          actor_id?: string | null
          company_id?: string
          from_value?: string | null
          id?: never
          kind?: Database["public"]["Enums"]["visit_event_kind"]
          occurred_at?: string
          to_value?: string | null
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_event_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_event_company_id_visit_id_fkey"
            columns: ["company_id", "visit_id"]
            isOneToOne: false
            referencedRelation: "visit"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      visit_metric: {
        Row: {
          company_id: string
          metric_id: number
          quantity: number
          visit_id: string
        }
        Insert: {
          company_id: string
          metric_id: number
          quantity: number
          visit_id: string
        }
        Update: {
          company_id?: string
          metric_id?: number
          quantity?: number
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_metric_company_id_metric_id_fkey"
            columns: ["company_id", "metric_id"]
            isOneToOne: false
            referencedRelation: "work_metric"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "visit_metric_company_id_visit_id_fkey"
            columns: ["company_id", "visit_id"]
            isOneToOne: false
            referencedRelation: "visit"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      work_metric: {
        Row: {
          active: boolean
          company_id: string
          id: number
          name: string
          report_label: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id: string
          id?: never
          name: string
          report_label?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          id?: never
          name?: string
          report_label?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_metric_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
        ]
      }
      workday: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          deleted_at: string | null
          id: string
          merchandiser_id: string
          published_at: string | null
          status: Database["public"]["Enums"]["workday_status"]
          updated_at: string
          version: number
          work_date: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          deleted_at?: string | null
          id?: string
          merchandiser_id: string
          published_at?: string | null
          status?: Database["public"]["Enums"]["workday_status"]
          updated_at?: string
          version?: number
          work_date: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          id?: string
          merchandiser_id?: string
          published_at?: string | null
          status?: Database["public"]["Enums"]["workday_status"]
          updated_at?: string
          version?: number
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "workday_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workday_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workday_merchandiser_id_fkey"
            columns: ["merchandiser_id"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      daily_metrics: {
        Row: {
          company_id: string | null
          merchandiser_id: string | null
          metric_id: number | null
          quantity: number | null
          work_date: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visit_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_merchandiser_id_fkey"
            columns: ["merchandiser_id"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_progress: {
        Row: {
          added: number | null
          approved: number | null
          closed: number | null
          company_id: string | null
          done: number | null
          last_activity_at: string | null
          merchandiser_id: string | null
          needs_fix: number | null
          refused: number | null
          total: number | null
          visited: number | null
          work_date: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visit_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_merchandiser_id_fkey"
            columns: ["merchandiser_id"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
        ]
      }
      display_status: {
        Row: {
          arranged: boolean | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          display_type_id: number | null
          id: string | null
          reference: string | null
          sort_order: number | null
          source: Database["public"]["Enums"]["display_source"] | null
          updated_at: string | null
          version: number | null
          visit_id: string | null
        }
        Insert: {
          arranged?: never
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          display_type_id?: number | null
          id?: string | null
          reference?: string | null
          sort_order?: number | null
          source?: Database["public"]["Enums"]["display_source"] | null
          updated_at?: string | null
          version?: number | null
          visit_id?: string | null
        }
        Update: {
          arranged?: never
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          display_type_id?: number | null
          id?: string | null
          reference?: string | null
          sort_order?: number | null
          source?: Database["public"]["Enums"]["display_source"] | null
          updated_at?: string | null
          version?: number | null
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "display_company_id_display_type_id_fkey"
            columns: ["company_id", "display_type_id"]
            isOneToOne: false
            referencedRelation: "display_type"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "display_company_id_visit_id_fkey"
            columns: ["company_id", "visit_id"]
            isOneToOne: false
            referencedRelation: "visit"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "display_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_visit: {
        Args: {
          p_address?: string
          p_area?: string
          p_customer_number?: string
          p_display_types?: number[]
          p_id?: string
          p_lat?: number
          p_lng?: number
          p_location_status?: Database["public"]["Enums"]["location_status"]
          p_name?: string
          p_store?: string
          p_task?: string
          p_workday: string
        }
        Returns: string
      }
      company_people: {
        Args: { p_company: string }
        Returns: {
          first_name: string
          invited_at: string
          last_activity_at: string
          last_name: string
          membership_id: string
          person_id: string
          phone_last4: string
          roles: Database["public"]["Enums"]["role"][]
          starts_on: string
          status: Database["public"]["Enums"]["membership_status"]
          team_id: string
        }[]
      }
      complete_identity: {
        Args: {
          p_birth_date: string
          p_dni: string
          p_first_name: string
          p_last_name: string
          p_phone: string
        }
        Returns: string
      }
      copy_workday: { Args: { p_from: string; p_to: string }; Returns: number }
      create_personal_company: { Args: never; Returns: string }
      find_person_by_dni: {
        Args: { p_company: string; p_dni: string }
        Returns: {
          first_name: string
          is_member: boolean
          last_name: string
          person_id: string
          phone_last4: string
        }[]
      }
      has_password: { Args: never; Returns: boolean }
      import_mvp_backup: {
        Args: { p_company: string; p_data: Json }
        Returns: Json
      }
      import_workdays: {
        Args: {
          p_company: string
          p_date: string
          p_format?: Json
          p_rows: Json
        }
        Returns: Json
      }
      invite_person: {
        Args: {
          p_company: string
          p_dni: string
          p_first_name?: string
          p_last_name?: string
          p_phone?: string
          p_roles: Database["public"]["Enums"]["role"][]
          p_starts_on: string
          p_team: string
        }
        Returns: string
      }
      match_stores: {
        Args: { p_company: string; p_rows: Json }
        Returns: {
          address: string
          area: string
          customer_number: string
          idx: number
          location_status: Database["public"]["Enums"]["location_status"]
          matched_by: string
          name: string
          store_id: string
        }[]
      }
      merchandiser_pending: {
        Args: { p_before: string; p_company: string; p_merchandiser: string }
        Returns: {
          address: string
          finished_at: string
          pending_displays: number
          store_name: string
          visit_id: string
          work_date: string
          work_status: Database["public"]["Enums"]["work_status"]
        }[]
      }
      open_workday: {
        Args: { p_company: string; p_date: string }
        Returns: string
      }
      plan_workday: {
        Args: { p_company: string; p_date: string; p_merchandiser: string }
        Returns: string
      }
      report_sync: {
        Args: {
          p_company: string
          p_failed: number
          p_oldest?: string
          p_pending: number
          p_photos: number
        }
        Returns: undefined
      }
      request_fix: {
        Args: { p_body: string; p_display?: string; p_visit: string }
        Returns: undefined
      }
      respond_invitation: {
        Args: { p_accept: boolean; p_membership: string }
        Returns: undefined
      }
      resumable_visits: {
        Args: { p_before: string; p_company: string }
        Returns: {
          address: string
          finished_at: string
          pending_displays: number
          store_name: string
          visit_id: string
          work_date: string
          work_status: Database["public"]["Enums"]["work_status"]
        }[]
      }
      resume_visit: {
        Args: { p_id?: string; p_visit: string; p_workday: string }
        Returns: string
      }
      search_stores: {
        Args: { p_company: string; p_limit?: number; p_query: string }
        Returns: {
          address: string
          area: string
          customer_number: string
          id: string
          location_status: Database["public"]["Enums"]["location_status"]
          name: string
        }[]
      }
      team_day: {
        Args: { p_company: string; p_date: string }
        Returns: {
          approved: number
          closed: number
          first_name: string
          in_progress: number
          last_activity_at: string
          last_name: string
          last_place: string
          needs_fix: number
          person_id: string
          refused: number
          sync_failed: number
          sync_pending: number
          sync_photos: number
          sync_reported_at: string
          to_review: number
          total: number
          visited: number
          workday_id: string
          workday_status: Database["public"]["Enums"]["workday_status"]
        }[]
      }
    }
    Enums: {
      comment_kind: "fix_request" | "reply" | "note"
      company_kind: "distributor" | "brand" | "agency" | "personal"
      consent_kind: "yes" | "with_objection" | "refused" | "closed"
      display_source: "assigned" | "found"
      geocoding_scope: "caba" | "argentina"
      location_status: "verified" | "approximate" | "unverified"
      membership_status: "invited" | "active" | "declined" | "disabled"
      photo_kind: "storefront" | "before" | "after"
      plan_kind: "free" | "pilot" | "team" | "internal"
      review_status: "unreviewed" | "approved" | "needs_fix"
      role: "merchandiser" | "supervisor" | "admin"
      store_source: "imported" | "manual" | "merchandiser"
      subscription_status: "active" | "expired" | "canceled"
      template_kind: "before" | "after" | "daily_report" | "visit_report"
      visit_event_kind:
        | "created"
        | "work"
        | "review"
        | "reassigned"
        | "resumed"
        | "deleted"
      visit_source: "assigned" | "added"
      work_status: "pending" | "in_progress" | "done" | "refused" | "closed"
      workday_status: "draft" | "published" | "closed"
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
      comment_kind: ["fix_request", "reply", "note"],
      company_kind: ["distributor", "brand", "agency", "personal"],
      consent_kind: ["yes", "with_objection", "refused", "closed"],
      display_source: ["assigned", "found"],
      geocoding_scope: ["caba", "argentina"],
      location_status: ["verified", "approximate", "unverified"],
      membership_status: ["invited", "active", "declined", "disabled"],
      photo_kind: ["storefront", "before", "after"],
      plan_kind: ["free", "pilot", "team", "internal"],
      review_status: ["unreviewed", "approved", "needs_fix"],
      role: ["merchandiser", "supervisor", "admin"],
      store_source: ["imported", "manual", "merchandiser"],
      subscription_status: ["active", "expired", "canceled"],
      template_kind: ["before", "after", "daily_report", "visit_report"],
      visit_event_kind: [
        "created",
        "work",
        "review",
        "reassigned",
        "resumed",
        "deleted",
      ],
      visit_source: ["assigned", "added"],
      work_status: ["pending", "in_progress", "done", "refused", "closed"],
      workday_status: ["draft", "published", "closed"],
    },
  },
} as const
