// Generated from Supabase (project worpdncyiozjfbguxukb). Regenerate with:
// npx supabase gen types typescript --project-id worpdncyiozjfbguxukb > lib/database.types.ts

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
      business_group_members: {
        Row: {
          group_id: string
          id: string
          invited_at: string | null
          invited_by: string | null
          joined_at: string
          role: string
          status: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          joined_at?: string
          role?: string
          status?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          joined_at?: string
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "business_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_group_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      business_group_properties: {
        Row: {
          added_at: string
          added_by: string | null
          group_id: string
          id: string
          property_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          group_id: string
          id?: string
          property_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          group_id?: string
          id?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_group_properties_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_group_properties_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "business_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_group_properties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      business_groups: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_alerts: {
        Row: {
          alert_type: string
          contract_id: string
          dismissed_at: string | null
          id: string
          owner_id: string
          sent_at: string
        }
        Insert: {
          alert_type: string
          contract_id: string
          dismissed_at?: string | null
          id?: string
          owner_id: string
          sent_at?: string
        }
        Update: {
          alert_type?: string
          contract_id?: string
          dismissed_at?: string | null
          id?: string
          owner_id?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_alerts_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_alerts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_attachments: {
        Row: {
          contract_id: string
          created_at: string | null
          file_size: number | null
          id: string
          name: string
          owner_id: string
          storage_path: string
        }
        Insert: {
          contract_id: string
          created_at?: string | null
          file_size?: number | null
          id?: string
          name: string
          owner_id: string
          storage_path: string
        }
        Update: {
          contract_id?: string
          created_at?: string | null
          file_size?: number | null
          id?: string
          name?: string
          owner_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_attachments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_attachments_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_custom_sections: {
        Row: {
          body: string
          contract_id: string
          created_at: string | null
          id: string
          order_index: number
          owner_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          body?: string
          contract_id: string
          created_at?: string | null
          id?: string
          order_index?: number
          owner_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          body?: string
          contract_id?: string
          created_at?: string | null
          id?: string
          order_index?: number
          owner_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_custom_sections_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_custom_sections_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_notification_logs: {
        Row: {
          channel: string
          contract_id: string
          days_before: number
          error_message: string | null
          id: string
          owner_id: string
          sent_at: string
          status: string
          trigger_id: string | null
        }
        Insert: {
          channel: string
          contract_id: string
          days_before: number
          error_message?: string | null
          id?: string
          owner_id: string
          sent_at?: string
          status: string
          trigger_id?: string | null
        }
        Update: {
          channel?: string
          contract_id?: string
          days_before?: number
          error_message?: string | null
          id?: string
          owner_id?: string
          sent_at?: string
          status?: string
          trigger_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_notification_logs_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_notification_logs_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_notification_logs_trigger_id_fkey"
            columns: ["trigger_id"]
            isOneToOne: false
            referencedRelation: "notification_triggers"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_occupants: {
        Row: {
          contract_id: string
          created_at: string
          current_address: string | null
          date_of_birth: string | null
          email: string | null
          full_name: string
          id: string
          license_number: string | null
          owner_id: string
          phone: string | null
          role: string
          signature: string | null
          signed_at: string | null
          snapshot: Json | null
          ssn_last4: string | null
          tenant_id: string | null
        }
        Insert: {
          contract_id: string
          created_at?: string
          current_address?: string | null
          date_of_birth?: string | null
          email?: string | null
          full_name: string
          id?: string
          license_number?: string | null
          owner_id: string
          phone?: string | null
          role?: string
          signature?: string | null
          signed_at?: string | null
          snapshot?: Json | null
          ssn_last4?: string | null
          tenant_id?: string | null
        }
        Update: {
          contract_id?: string
          created_at?: string
          current_address?: string | null
          date_of_birth?: string | null
          email?: string | null
          full_name?: string
          id?: string
          license_number?: string | null
          owner_id?: string
          phone?: string | null
          role?: string
          signature?: string | null
          signed_at?: string | null
          snapshot?: Json | null
          ssn_last4?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_occupants_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_occupants_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_occupants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_sections: {
        Row: {
          contract_id: string
          enabled: boolean
          id: string
          order_index: number
          section_code: string
        }
        Insert: {
          contract_id: string
          enabled?: boolean
          id?: string
          order_index?: number
          section_code: string
        }
        Update: {
          contract_id?: string
          enabled?: boolean
          id?: string
          order_index?: number
          section_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_sections_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          contract_type: string
          created_at: string
          description: string | null
          file_url: string
          id: string
          is_default: boolean
          is_system: boolean
          jurisdiction: string | null
          name: string
          owner_id: string | null
          template_version: string
        }
        Insert: {
          contract_type?: string
          created_at?: string
          description?: string | null
          file_url: string
          id?: string
          is_default?: boolean
          is_system?: boolean
          jurisdiction?: string | null
          name: string
          owner_id?: string | null
          template_version?: string
        }
        Update: {
          contract_type?: string
          created_at?: string
          description?: string | null
          file_url?: string
          id?: string
          is_default?: boolean
          is_system?: boolean
          jurisdiction?: string | null
          name?: string
          owner_id?: string | null
          template_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_templates_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          amenities: Json | null
          contract_type: Database["public"]["Enums"]["contract_type"]
          created_at: string | null
          docx_url: string | null
          engine_mode: string
          furnishings: Json
          governing_law: string | null
          id: string
          is_renewal: boolean
          key_count: number
          landlord_signature: string | null
          language: string
          late_fee_daily_amount: number
          late_fee_day: number
          late_fee_fixed_amount: number
          late_fee_grace_period_days: number
          late_fee_type: string
          lease_end: string
          lease_months: number
          lease_start: string
          occupant_count: number
          occupant_names: string[] | null
          opened_at: string | null
          owner_id: string
          parent_contract_id: string | null
          payment_due_day: number
          pdf_url: string | null
          property_id: string
          property_snapshot: Json | null
          rent_amount: number
          rent_amount_verbal: string | null
          rules: Json
          security_deposit: number
          sent_at: string | null
          signed_at: string | null
          status: Database["public"]["Enums"]["contract_status"]
          suppress_notifications: boolean
          template_id: string | null
          template_version: string | null
          tenant_id: string
          tenant_signature: string | null
          tenant_snapshot: Json | null
          unit_number: string | null
          updated_at: string | null
          utilities: Json
        }
        Insert: {
          amenities?: Json | null
          contract_type?: Database["public"]["Enums"]["contract_type"]
          created_at?: string | null
          docx_url?: string | null
          engine_mode?: string
          furnishings?: Json
          governing_law?: string | null
          id?: string
          is_renewal?: boolean
          key_count?: number
          landlord_signature?: string | null
          language?: string
          late_fee_daily_amount?: number
          late_fee_day?: number
          late_fee_fixed_amount?: number
          late_fee_grace_period_days?: number
          late_fee_type?: string
          lease_end: string
          lease_months: number
          lease_start: string
          occupant_count?: number
          occupant_names?: string[] | null
          opened_at?: string | null
          owner_id: string
          parent_contract_id?: string | null
          payment_due_day?: number
          pdf_url?: string | null
          property_id: string
          property_snapshot?: Json | null
          rent_amount: number
          rent_amount_verbal?: string | null
          rules?: Json
          security_deposit?: number
          sent_at?: string | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          suppress_notifications?: boolean
          template_id?: string | null
          template_version?: string | null
          tenant_id: string
          tenant_signature?: string | null
          tenant_snapshot?: Json | null
          unit_number?: string | null
          updated_at?: string | null
          utilities?: Json
        }
        Update: {
          amenities?: Json | null
          contract_type?: Database["public"]["Enums"]["contract_type"]
          created_at?: string | null
          docx_url?: string | null
          engine_mode?: string
          furnishings?: Json
          governing_law?: string | null
          id?: string
          is_renewal?: boolean
          key_count?: number
          landlord_signature?: string | null
          language?: string
          late_fee_daily_amount?: number
          late_fee_day?: number
          late_fee_fixed_amount?: number
          late_fee_grace_period_days?: number
          late_fee_type?: string
          lease_end?: string
          lease_months?: number
          lease_start?: string
          occupant_count?: number
          occupant_names?: string[] | null
          opened_at?: string | null
          owner_id?: string
          parent_contract_id?: string | null
          payment_due_day?: number
          pdf_url?: string | null
          property_id?: string
          property_snapshot?: Json | null
          rent_amount?: number
          rent_amount_verbal?: string | null
          rules?: Json
          security_deposit?: number
          sent_at?: string | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          suppress_notifications?: boolean
          template_id?: string | null
          template_version?: string | null
          tenant_id?: string
          tenant_signature?: string | null
          tenant_snapshot?: Json | null
          unit_number?: string | null
          updated_at?: string | null
          utilities?: Json
        }
        Relationships: [
          {
            foreignKeyName: "contracts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_parent_contract_id_fkey"
            columns: ["parent_contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      group_property_ownership: {
        Row: {
          group_id: string
          id: string
          ownership_pct: number
          property_id: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          ownership_pct?: number
          property_id: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          ownership_pct?: number
          property_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_property_ownership_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "business_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_property_ownership_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_property_ownership_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_triggers: {
        Row: {
          created_at: string
          days_before: number
          id: string
          is_active: boolean
          label: string | null
          owner_id: string
          send_email: boolean
          send_sms: boolean
        }
        Insert: {
          created_at?: string
          days_before: number
          id?: string
          is_active?: boolean
          label?: string | null
          owner_id: string
          send_email?: boolean
          send_sms?: boolean
        }
        Update: {
          created_at?: string
          days_before?: number
          id?: string
          is_active?: boolean
          label?: string | null
          owner_id?: string
          send_email?: boolean
          send_sms?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "notification_triggers_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_name: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          locale: string
          phone: string | null
          plan: string
          role: string
          username: string | null
        }
        Insert: {
          company_name?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          locale?: string
          phone?: string | null
          plan?: string
          role?: string
          username?: string | null
        }
        Update: {
          company_name?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          locale?: string
          phone?: string | null
          plan?: string
          role?: string
          username?: string | null
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string
          bathroom_count: number
          city: string
          country: string | null
          created_at: string | null
          id: string
          jurisdiction: string
          latitude: number | null
          longitude: number | null
          name: string
          owner_id: string
          parking_available: boolean
          parking_count: number | null
          state: string
          unit: string | null
          unit_count: number
          zip: string | null
        }
        Insert: {
          address: string
          bathroom_count?: number
          city: string
          country?: string | null
          created_at?: string | null
          id?: string
          jurisdiction?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          owner_id: string
          parking_available?: boolean
          parking_count?: number | null
          state?: string
          unit?: string | null
          unit_count?: number
          zip?: string | null
        }
        Update: {
          address?: string
          bathroom_count?: number
          city?: string
          country?: string | null
          created_at?: string | null
          id?: string
          jurisdiction?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          owner_id?: string
          parking_available?: boolean
          parking_count?: number | null
          state?: string
          unit?: string | null
          unit_count?: number
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      property_co_owners: {
        Row: {
          accepted_at: string | null
          co_owner_id: string
          id: string
          invited_at: string
          owner_id: string
          ownership_pct: number
          property_id: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          co_owner_id: string
          id?: string
          invited_at?: string
          owner_id: string
          ownership_pct: number
          property_id: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          co_owner_id?: string
          id?: string
          invited_at?: string
          owner_id?: string
          ownership_pct?: number
          property_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_co_owners_co_owner_id_fkey"
            columns: ["co_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_co_owners_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_co_owners_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string | null
          description: string | null
          expense_date: string
          id: string
          is_mortgage_interest: boolean
          is_tax_deductible: boolean | null
          property_id: string
          receipt_url: string | null
          user_id: string
          vendor: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string | null
          description?: string | null
          expense_date: string
          id?: string
          is_mortgage_interest?: boolean
          is_tax_deductible?: boolean | null
          property_id: string
          receipt_url?: string | null
          user_id: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          is_mortgage_interest?: boolean
          is_tax_deductible?: boolean | null
          property_id?: string
          receipt_url?: string | null
          user_id?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_expenses_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_managers: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          invite_token: string | null
          invited_at: string
          manager_email: string
          manager_user_id: string | null
          owner_id: string
          permissions: Json
          property_ids: string[]
          status: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invite_token?: string | null
          invited_at?: string
          manager_email: string
          manager_user_id?: string | null
          owner_id: string
          permissions?: Json
          property_ids?: string[]
          status?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invite_token?: string | null
          invited_at?: string
          manager_email?: string
          manager_user_id?: string | null
          owner_id?: string
          permissions?: Json
          property_ids?: string[]
          status?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          owner_id: string
          plan: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          owner_id: string
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          owner_id?: string
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tenant_invites: {
        Row: {
          contract_id: string
          created_at: string
          expires_at: string
          id: string
          owner_id: string
          tenant_email: string
          tenant_name: string
          token: string
          used: boolean
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          contract_id: string
          created_at?: string
          expires_at?: string
          id?: string
          owner_id: string
          tenant_email: string
          tenant_name?: string
          token: string
          used?: boolean
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          contract_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          owner_id?: string
          tenant_email?: string
          tenant_name?: string
          token?: string
          used?: boolean
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_invites_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_invites_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string | null
          current_address: string | null
          current_city: string | null
          current_country: string | null
          current_state: string | null
          current_street: string | null
          current_unit: string | null
          current_zip: string | null
          date_of_birth: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          employer_name: string | null
          employer_phone: string | null
          full_name: string
          id: string
          license_number: string | null
          monthly_income: number | null
          owner_id: string
          phone: string | null
          previous_city: string | null
          previous_country: string | null
          previous_state: string | null
          previous_street: string | null
          previous_unit: string | null
          previous_zip: string | null
          ssn_last4: string | null
        }
        Insert: {
          created_at?: string | null
          current_address?: string | null
          current_city?: string | null
          current_country?: string | null
          current_state?: string | null
          current_street?: string | null
          current_unit?: string | null
          current_zip?: string | null
          date_of_birth?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employer_name?: string | null
          employer_phone?: string | null
          full_name: string
          id?: string
          license_number?: string | null
          monthly_income?: number | null
          owner_id: string
          phone?: string | null
          previous_city?: string | null
          previous_country?: string | null
          previous_state?: string | null
          previous_street?: string | null
          previous_unit?: string | null
          previous_zip?: string | null
          ssn_last4?: string | null
        }
        Update: {
          created_at?: string | null
          current_address?: string | null
          current_city?: string | null
          current_country?: string | null
          current_state?: string | null
          current_street?: string | null
          current_unit?: string | null
          current_zip?: string | null
          date_of_birth?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employer_name?: string | null
          employer_phone?: string | null
          full_name?: string
          id?: string
          license_number?: string | null
          monthly_income?: number | null
          owner_id?: string
          phone?: string | null
          previous_city?: string | null
          previous_country?: string | null
          previous_state?: string | null
          previous_street?: string | null
          previous_unit?: string | null
          previous_zip?: string | null
          ssn_last4?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenants_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_section_templates: {
        Row: {
          body: string
          created_at: string | null
          id: string
          owner_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          body?: string
          created_at?: string | null
          id?: string
          owner_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          owner_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_section_templates_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlist: {
        Row: {
          baths: number | null
          beds: number | null
          city: string | null
          detail_url: string | null
          home_status: string | null
          home_type: string | null
          id: string
          img_src: string | null
          owner_id: string
          price: number | null
          saved_at: string | null
          state: string | null
          street: string | null
          zillow_id: string
        }
        Insert: {
          baths?: number | null
          beds?: number | null
          city?: string | null
          detail_url?: string | null
          home_status?: string | null
          home_type?: string | null
          id?: string
          img_src?: string | null
          owner_id: string
          price?: number | null
          saved_at?: string | null
          state?: string | null
          street?: string | null
          zillow_id: string
        }
        Update: {
          baths?: number | null
          beds?: number | null
          city?: string | null
          detail_url?: string | null
          home_status?: string | null
          home_type?: string | null
          id?: string
          img_src?: string | null
          owner_id?: string
          price?: number | null
          saved_at?: string | null
          state?: string | null
          street?: string | null
          zillow_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      crim_tax_rates: {
        Row: {
          fiscal_year: string | null
          inmueble_rate: number | null
          mueble_rate: number | null
          municipality: string | null
          source_url: string | null
        }
        Insert: {
          fiscal_year?: string | null
          inmueble_rate?: number | null
          mueble_rate?: number | null
          municipality?: string | null
          source_url?: string | null
        }
        Update: {
          fiscal_year?: string | null
          inmueble_rate?: number | null
          mueble_rate?: number | null
          municipality?: string | null
          source_url?: string | null
        }
        Relationships: []
      }
      zillow_market: {
        Row: {
          baths: number | null
          beds: number | null
          city: string | null
          daily_price_cut_rate: number | null
          daysOnZillow: number | null
          desperation_score: number | null
          detailUrl: string | null
          homeStatus: string | null
          homeType: string | null
          id: number | null
          imgSrc: string | null
          last_cut_date: string | null
          last_updated_date: string | null
          latitude: number | null
          longitude: number | null
          num_price_cuts: number | null
          original_price: number | null
          price: number | null
          price_cut_pct: number | null
          state: string | null
          street: string | null
          total_price_cut: number | null
          zipcode: string | null
        }
        Insert: {
          baths?: number | null
          beds?: number | null
          city?: string | null
          daily_price_cut_rate?: number | null
          daysOnZillow?: number | null
          desperation_score?: number | null
          detailUrl?: string | null
          homeStatus?: string | null
          homeType?: string | null
          id?: number | null
          imgSrc?: string | null
          last_cut_date?: string | null
          last_updated_date?: string | null
          latitude?: number | null
          longitude?: number | null
          num_price_cuts?: number | null
          original_price?: number | null
          price?: number | null
          price_cut_pct?: number | null
          state?: string | null
          street?: string | null
          total_price_cut?: number | null
          zipcode?: string | null
        }
        Update: {
          baths?: number | null
          beds?: number | null
          city?: string | null
          daily_price_cut_rate?: number | null
          daysOnZillow?: number | null
          desperation_score?: number | null
          detailUrl?: string | null
          homeStatus?: string | null
          homeType?: string | null
          id?: number | null
          imgSrc?: string | null
          last_cut_date?: string | null
          last_updated_date?: string | null
          latitude?: number | null
          longitude?: number | null
          num_price_cuts?: number | null
          original_price?: number | null
          price?: number | null
          price_cut_pct?: number | null
          state?: string | null
          street?: string | null
          total_price_cut?: number | null
          zipcode?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      is_group_admin: { Args: { gid: string }; Returns: boolean }
      is_group_member: { Args: { gid: string }; Returns: boolean }
      is_group_owner: { Args: { gid: string }; Returns: boolean }
      is_username_taken: { Args: { uname: string }; Returns: boolean }
      search_profiles: {
        Args: { query: string }
        Returns: {
          email: string
          full_name: string
          id: string
          username: string
        }[]
      }
      search_profiles_by_email: {
        Args: { search_email: string }
        Returns: {
          email: string
          full_name: string
          id: string
        }[]
      }
      shares_group_with: { Args: { other_user_id: string }; Returns: boolean }
    }
    Enums: {
      contract_status: "draft" | "sent" | "signed" | "expired"
      contract_type: "lease" | "rental" | "addendum"
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
      contract_status: ["draft", "sent", "signed", "expired"],
      contract_type: ["lease", "rental", "addendum"],
    },
  },
} as const
