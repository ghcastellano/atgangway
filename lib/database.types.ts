/**
 * Tipos GERADOS do schema vivo do Supabase (projeto cuaocjxofaizefzcxlyc).
 *
 * Não edite à mão. Regenera com o MCP do Supabase
 * (generate_typescript_types) ou com a CLI:
 *
 *   supabase gen types typescript --project-id cuaocjxofaizefzcxlyc > lib/database.types.ts
 *
 * Por que existe: os tipos manuais em lib/types.ts e lib/catalog.ts
 * nasceram de leitura do SQL e divergiram do banco em silêncio — 45
 * migrações aplicadas em produção contra 13 arquivos no repositório.
 * Este arquivo é a verdade do banco no momento da geração, e o cliente
 * tipado (createClient<Database>) faz o tsc apontar o campo que sumiu
 * ou mudou de tipo ANTES do deploy, não no log de produção.
 */
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
      admin_emails: {
        Row: {
          email: string
        }
        Insert: {
          email: string
        }
        Update: {
          email?: string
        }
        Relationships: []
      }
      app_secrets: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      brands: {
        Row: {
          active: boolean
          created_at: string
          id: string
          logo_path: string | null
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          logo_path?: string | null
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          logo_path?: string | null
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      call_reminders: {
        Row: {
          call_date: string
          recipient: string | null
          sent_at: string
          ship_id: string
          user_id: string
        }
        Insert: {
          call_date: string
          recipient?: string | null
          sent_at?: string
          ship_id: string
          user_id: string
        }
        Update: {
          call_date?: string
          recipient?: string | null
          sent_at?: string
          ship_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_reminders_ship_id_fkey"
            columns: ["ship_id"]
            isOneToOne: false
            referencedRelation: "ships"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          active: boolean
          created_at: string
          depth: number
          description: string | null
          icon: string | null
          id: string
          image_path: string | null
          name: string
          parent_id: string | null
          path: string
          slug: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          depth?: number
          description?: string | null
          icon?: string | null
          id?: string
          image_path?: string | null
          name: string
          parent_id?: string | null
          path?: string
          slug: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          depth?: number
          description?: string | null
          icon?: string | null
          id?: string
          image_path?: string | null
          name?: string
          parent_id?: string | null
          path?: string
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      credits: {
        Row: {
          amount_usd: number
          created_at: string
          id: string
          kind: string
          note: string | null
          order_id: string | null
          rate_pct: number | null
          user_id: string
        }
        Insert: {
          amount_usd: number
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          order_id?: string | null
          rate_pct?: number | null
          user_id: string
        }
        Update: {
          amount_usd?: number
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          order_id?: string | null
          rate_pct?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credits_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_ranks: {
        Row: {
          department: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          department: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          department?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      fx_rates: {
        Row: {
          fetched_at: string
          quote_date: string
          source: string
          usd_brl_buy: number
          usd_brl_sell: number
        }
        Insert: {
          fetched_at?: string
          quote_date: string
          source?: string
          usd_brl_buy: number
          usd_brl_sell: number
        }
        Update: {
          fetched_at?: string
          quote_date?: string
          source?: string
          usd_brl_buy?: number
          usd_brl_sell?: number
        }
        Relationships: []
      }
      order_emails: {
        Row: {
          kind: string
          order_id: string
          recipient: string | null
          sent_at: string
        }
        Insert: {
          kind: string
          order_id: string
          recipient?: string | null
          sent_at?: string
        }
        Update: {
          kind?: string
          order_id?: string
          recipient?: string | null
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_emails_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          compare_at_cents: number | null
          emoji: string | null
          id: string
          image_path: string | null
          name: string
          order_id: string
          product_id: string | null
          qty: number
          sku: string | null
          unit_price_cents: number | null
          unit_price_usd: number
          variant_id: string | null
        }
        Insert: {
          compare_at_cents?: number | null
          emoji?: string | null
          id?: string
          image_path?: string | null
          name: string
          order_id: string
          product_id?: string | null
          qty: number
          sku?: string | null
          unit_price_cents?: number | null
          unit_price_usd: number
          variant_id?: string | null
        }
        Update: {
          compare_at_cents?: number | null
          emoji?: string | null
          id?: string
          image_path?: string | null
          name?: string
          order_id?: string
          product_id?: string | null
          qty?: number
          sku?: string | null
          unit_price_cents?: number | null
          unit_price_usd?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          balance_cents: number | null
          balance_usd: number
          code: string
          contact_name: string | null
          contact_rank: string | null
          contact_whatsapp: string | null
          created_at: string
          credit_applied_usd: number
          delivered_at: string | null
          delivery_date: string | null
          delivery_photo_path: string | null
          delivery_promise: string | null
          deposit_cents: number | null
          deposit_usd: number
          id: string
          idempotency_key: string | null
          note: string | null
          payment_method: string | null
          port_id: string | null
          previous_status: string | null
          ship_id: string | null
          status: string
          status_changed_at: string | null
          stripe_session_id: string | null
          subtotal_cents: number | null
          subtotal_usd: number
          updated_at: string
          user_id: string
          vessel_agent: string | null
          vessel_berth: string | null
          vessel_flag: string | null
          vessel_imo: string | null
          vessel_name: string | null
        }
        Insert: {
          balance_cents?: number | null
          balance_usd: number
          code: string
          contact_name?: string | null
          contact_rank?: string | null
          contact_whatsapp?: string | null
          created_at?: string
          credit_applied_usd?: number
          delivered_at?: string | null
          delivery_date?: string | null
          delivery_photo_path?: string | null
          delivery_promise?: string | null
          deposit_cents?: number | null
          deposit_usd: number
          id?: string
          idempotency_key?: string | null
          note?: string | null
          payment_method?: string | null
          port_id?: string | null
          previous_status?: string | null
          ship_id?: string | null
          status?: string
          status_changed_at?: string | null
          stripe_session_id?: string | null
          subtotal_cents?: number | null
          subtotal_usd: number
          updated_at?: string
          user_id: string
          vessel_agent?: string | null
          vessel_berth?: string | null
          vessel_flag?: string | null
          vessel_imo?: string | null
          vessel_name?: string | null
        }
        Update: {
          balance_cents?: number | null
          balance_usd?: number
          code?: string
          contact_name?: string | null
          contact_rank?: string | null
          contact_whatsapp?: string | null
          created_at?: string
          credit_applied_usd?: number
          delivered_at?: string | null
          delivery_date?: string | null
          delivery_photo_path?: string | null
          delivery_promise?: string | null
          deposit_cents?: number | null
          deposit_usd?: number
          id?: string
          idempotency_key?: string | null
          note?: string | null
          payment_method?: string | null
          port_id?: string | null
          previous_status?: string | null
          ship_id?: string | null
          status?: string
          status_changed_at?: string | null
          stripe_session_id?: string | null
          subtotal_cents?: number | null
          subtotal_usd?: number
          updated_at?: string
          user_id?: string
          vessel_agent?: string | null
          vessel_berth?: string | null
          vessel_flag?: string | null
          vessel_imo?: string | null
          vessel_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_port_id_fkey"
            columns: ["port_id"]
            isOneToOne: false
            referencedRelation: "ports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_ship_id_fkey"
            columns: ["ship_id"]
            isOneToOne: false
            referencedRelation: "ships"
            referencedColumns: ["id"]
          },
        ]
      }
      port_delivery_rules: {
        Row: {
          active: boolean
          created_at: string
          delivery_offset_days: number
          delivery_weekdays: number[] | null
          id: string
          label: string | null
          min_stay_hours: number | null
          order_weekdays: number[]
          port_id: string
          sort_order: number
          vessel_must_stay_until: string | null
          window_end: string
          window_start: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          delivery_offset_days?: number
          delivery_weekdays?: number[] | null
          id?: string
          label?: string | null
          min_stay_hours?: number | null
          order_weekdays?: number[]
          port_id: string
          sort_order?: number
          vessel_must_stay_until?: string | null
          window_end?: string
          window_start?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          delivery_offset_days?: number
          delivery_weekdays?: number[] | null
          id?: string
          label?: string | null
          min_stay_hours?: number | null
          order_weekdays?: number[]
          port_id?: string
          sort_order?: number
          vessel_must_stay_until?: string | null
          window_end?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "port_delivery_rules_port_id_fkey"
            columns: ["port_id"]
            isOneToOne: false
            referencedRelation: "ports"
            referencedColumns: ["id"]
          },
        ]
      }
      ports: {
        Row: {
          active: boolean
          country_code: string
          created_at: string
          delivery_fee_cents: number
          fulfilment_kind: string
          id: string
          min_order_cents: number
          name: string
          note: string | null
          slug: string
          sort_order: number
          timezone: string
          unlocode: string | null
        }
        Insert: {
          active?: boolean
          country_code?: string
          created_at?: string
          delivery_fee_cents?: number
          fulfilment_kind?: string
          id?: string
          min_order_cents?: number
          name: string
          note?: string | null
          slug: string
          sort_order?: number
          timezone?: string
          unlocode?: string | null
        }
        Update: {
          active?: boolean
          country_code?: string
          created_at?: string
          delivery_fee_cents?: number
          fulfilment_kind?: string
          id?: string
          min_order_cents?: number
          name?: string
          note?: string | null
          slug?: string
          sort_order?: number
          timezone?: string
          unlocode?: string | null
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          category_id: string
          position: number
          product_id: string
        }
        Insert: {
          category_id: string
          position?: number
          product_id: string
        }
        Update: {
          category_id?: string
          position?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt: string | null
          attribution: string | null
          created_at: string
          height: number | null
          id: string
          license: string | null
          path: string
          product_id: string
          sort_order: number
          source_title: string | null
          source_url: string | null
          width: number | null
        }
        Insert: {
          alt?: string | null
          attribution?: string | null
          created_at?: string
          height?: number | null
          id?: string
          license?: string | null
          path: string
          product_id: string
          sort_order?: number
          source_title?: string | null
          source_url?: string | null
          width?: number | null
        }
        Update: {
          alt?: string | null
          attribution?: string | null
          created_at?: string
          height?: number | null
          id?: string
          license?: string | null
          path?: string
          product_id?: string
          sort_order?: number
          source_title?: string | null
          source_url?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          active: boolean
          compare_at_cents: number | null
          cost_cents: number | null
          created_at: string
          ean: string | null
          id: string
          image_path: string | null
          option_label: string | null
          options: Json
          price_cents: number
          product_id: string
          sku: string
          sort_order: number
          stock_qty: number
          track_stock: boolean
          weight_grams: number | null
        }
        Insert: {
          active?: boolean
          compare_at_cents?: number | null
          cost_cents?: number | null
          created_at?: string
          ean?: string | null
          id?: string
          image_path?: string | null
          option_label?: string | null
          options?: Json
          price_cents: number
          product_id: string
          sku: string
          sort_order?: number
          stock_qty?: number
          track_stock?: boolean
          weight_grams?: number | null
        }
        Update: {
          active?: boolean
          compare_at_cents?: number | null
          cost_cents?: number | null
          created_at?: string
          ean?: string | null
          id?: string
          image_path?: string | null
          option_label?: string | null
          options?: Json
          price_cents?: number
          product_id?: string
          sku?: string
          sort_order?: number
          stock_qty?: number
          track_stock?: boolean
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          badge: string | null
          brand_id: string | null
          category: string
          compare_at_cents: number | null
          created_at: string
          default_variant_id: string | null
          description: string | null
          emoji: string
          id: string
          max_price_cents: number | null
          max_qty: number | null
          min_qty: number
          name: string
          price_cents: number
          price_usd: number
          primary_category_id: string | null
          primary_image_path: string | null
          published_at: string | null
          search_tsv: unknown
          short_description: string | null
          sku: string | null
          slug: string | null
          sort_order: number
          specs: string[] | null
          stock_qty: number
          tax_class: string
          tracks_stock: boolean
          updated_at: string
          variant_count: number
          weight_grams: number | null
        }
        Insert: {
          active?: boolean
          badge?: string | null
          brand_id?: string | null
          category?: string
          compare_at_cents?: number | null
          created_at?: string
          default_variant_id?: string | null
          description?: string | null
          emoji?: string
          id?: string
          max_price_cents?: number | null
          max_qty?: number | null
          min_qty?: number
          name: string
          price_cents?: number
          price_usd?: number
          primary_category_id?: string | null
          primary_image_path?: string | null
          published_at?: string | null
          search_tsv?: unknown
          short_description?: string | null
          sku?: string | null
          slug?: string | null
          sort_order?: number
          specs?: string[] | null
          stock_qty?: number
          tax_class?: string
          tracks_stock?: boolean
          updated_at?: string
          variant_count?: number
          weight_grams?: number | null
        }
        Update: {
          active?: boolean
          badge?: string | null
          brand_id?: string | null
          category?: string
          compare_at_cents?: number | null
          created_at?: string
          default_variant_id?: string | null
          description?: string | null
          emoji?: string
          id?: string
          max_price_cents?: number | null
          max_qty?: number | null
          min_qty?: number
          name?: string
          price_cents?: number
          price_usd?: number
          primary_category_id?: string | null
          primary_image_path?: string | null
          published_at?: string | null
          search_tsv?: unknown
          short_description?: string | null
          sku?: string | null
          slug?: string | null
          sort_order?: number
          specs?: string[] | null
          stock_qty?: number
          tax_class?: string
          tracks_stock?: boolean
          updated_at?: string
          variant_count?: number
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_default_variant_id_fkey"
            columns: ["default_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_primary_category_id_fkey"
            columns: ["primary_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          nationality: string | null
          port_id: string | null
          profile_completed_at: string | null
          rank_slug: string | null
          referral_code: string | null
          referred_by: string | null
          role: string
          ship_id: string | null
          vessel_flag: string | null
          vessel_imo: string | null
          vessel_name: string | null
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          nationality?: string | null
          port_id?: string | null
          profile_completed_at?: string | null
          rank_slug?: string | null
          referral_code?: string | null
          referred_by?: string | null
          role?: string
          ship_id?: string | null
          vessel_flag?: string | null
          vessel_imo?: string | null
          vessel_name?: string | null
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          nationality?: string | null
          port_id?: string | null
          profile_completed_at?: string | null
          rank_slug?: string | null
          referral_code?: string | null
          referred_by?: string | null
          role?: string
          ship_id?: string | null
          vessel_flag?: string | null
          vessel_imo?: string | null
          vessel_name?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_port_id_fkey"
            columns: ["port_id"]
            isOneToOne: false
            referencedRelation: "ports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_rank_slug_fkey"
            columns: ["rank_slug"]
            isOneToOne: false
            referencedRelation: "crew_ranks"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_ship_id_fkey"
            columns: ["ship_id"]
            isOneToOne: false
            referencedRelation: "ships"
            referencedColumns: ["id"]
          },
        ]
      }
      ship_eta_history: {
        Row: {
          delta_hours: number | null
          eta: string
          id: string
          recorded_at: string
          ship_id: string
          source: string
        }
        Insert: {
          delta_hours?: number | null
          eta: string
          id?: string
          recorded_at?: string
          ship_id: string
          source?: string
        }
        Update: {
          delta_hours?: number | null
          eta?: string
          id?: string
          recorded_at?: string
          ship_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "ship_eta_history_ship_id_fkey"
            columns: ["ship_id"]
            isOneToOne: false
            referencedRelation: "ships"
            referencedColumns: ["id"]
          },
        ]
      }
      ships: {
        Row: {
          active: boolean
          ata: string | null
          berth: string | null
          created_at: string
          created_by: string | null
          cutoff_hours: number
          delay_hours: number
          eta: string
          eta_source: string
          flag: string | null
          id: string
          image_path: string | null
          imo: string | null
          last_synced_at: string | null
          mmsi: string | null
          name: string
          previous_eta: string | null
          search_name: string | null
          sync_key: string | null
          verified: boolean
          voyage: string | null
        }
        Insert: {
          active?: boolean
          ata?: string | null
          berth?: string | null
          created_at?: string
          created_by?: string | null
          cutoff_hours?: number
          delay_hours?: number
          eta: string
          eta_source?: string
          flag?: string | null
          id?: string
          image_path?: string | null
          imo?: string | null
          last_synced_at?: string | null
          mmsi?: string | null
          name: string
          previous_eta?: string | null
          search_name?: string | null
          sync_key?: string | null
          verified?: boolean
          voyage?: string | null
        }
        Update: {
          active?: boolean
          ata?: string | null
          berth?: string | null
          created_at?: string
          created_by?: string | null
          cutoff_hours?: number
          delay_hours?: number
          eta?: string
          eta_source?: string
          flag?: string | null
          id?: string
          image_path?: string | null
          imo?: string | null
          last_synced_at?: string | null
          mmsi?: string | null
          name?: string
          previous_eta?: string | null
          search_name?: string | null
          sync_key?: string | null
          verified?: boolean
          voyage?: string | null
        }
        Relationships: []
      }
      stripe_events: {
        Row: {
          id: string
          order_id: string | null
          received_at: string
          type: string
        }
        Insert: {
          id: string
          order_id?: string | null
          received_at?: string
          type: string
        }
        Update: {
          id?: string
          order_id?: string | null
          received_at?: string
          type?: string
        }
        Relationships: []
      }
      wishlists: {
        Row: {
          created_at: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_order_credit: { Args: { p_order: string }; Returns: number }
      category_counts: {
        Args: never
        Returns: {
          category_id: string
          product_count: number
        }[]
      }
      claim_call_reminders: { Args: { p_secret?: string }; Returns: Json }
      claim_order_email: {
        Args: { p_kind: string; p_order: string; p_secret?: string }
        Returns: Json
      }
      claim_referral: { Args: { p_code: string }; Returns: boolean }
      claim_vessel_imo: {
        Args: { p_imo: string; p_ship: string }
        Returns: Json
      }
      confirm_stripe_deposit: {
        Args: {
          p_event: string
          p_order: string
          p_secret: string
          p_session?: string
        }
        Returns: string
      }
      create_vessel: {
        Args: { p_flag?: string; p_imo?: string; p_name: string }
        Returns: string
      }
      credit_skipped_calls: { Args: { p_secret?: string }; Returns: Json }
      gen_referral_code: { Args: never; Returns: string }
      imo_checksum_ok: { Args: { p_imo: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_cron_secret: { Args: { p_secret: string }; Returns: boolean }
      list_products: {
        Args: {
          p_badge?: string
          p_brand?: string
          p_category?: string
          p_cursor?: string
          p_limit?: number
          p_query?: string
          p_sort?: string
        }
        Returns: {
          badge: string
          brand_name: string
          compare_at_cents: number
          cursor: string
          default_variant_id: string
          id: string
          max_price_cents: number
          name: string
          price_cents: number
          primary_image_path: string
          short_description: string
          sku: string
          slug: string
          sort_order: number
          stock_qty: number
          tracks_stock: boolean
          variant_count: number
        }[]
      }
      my_credit_balance: { Args: never; Returns: number }
      ops_daily: { Args: { p_secret?: string }; Returns: Json }
      ops_health: { Args: never; Returns: Json }
      place_order: {
        Args: {
          p_apply_credit?: boolean
          p_contact_name?: string
          p_contact_whatsapp?: string
          p_items?: Json
          p_key: string
          p_note?: string
          p_ship?: string
        }
        Returns: Json
      }
      products_rollup: { Args: { p_product: string }; Returns: undefined }
      referral_order_count: { Args: { p_user: string }; Returns: number }
      referral_rate: { Args: { p_user: string }; Returns: number }
      release_call_reminder: {
        Args: {
          p_call_date: string
          p_secret?: string
          p_ship: string
          p_user: string
        }
        Returns: boolean
      }
      release_order_email: {
        Args: { p_kind: string; p_order: string; p_secret?: string }
        Returns: boolean
      }
      rotate_ship_calls: { Args: { p_secret?: string }; Returns: Json }
      search_vessels: {
        Args: { p_query: string }
        Returns: {
          eta: string
          flag: string
          id: string
          image_path: string
          imo: string
          name: string
          verified: boolean
        }[]
      }
      set_order_stripe_session: {
        Args: { p_order: string; p_session: string }
        Returns: boolean
      }
      ship_key: { Args: { p_name: string }; Returns: string }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      slugify: { Args: { p: string }; Returns: string }
      sync_ship_eta: {
        Args: {
          p_berth?: string
          p_eta: string
          p_imo?: string
          p_name: string
          p_secret?: string
          p_source?: string
          p_voyage?: string
        }
        Returns: Json
      }
      upsert_fx_rate: {
        Args: {
          p_buy: number
          p_date: string
          p_secret: string
          p_sell: number
          p_source: string
        }
        Returns: string
      }
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
