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
      compliance_audit_log: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      compliance_checks: {
        Row: {
          details: Json
          framework: Database["public"]["Enums"]["compliance_framework"]
          id: string
          metric: Database["public"]["Enums"]["compliance_metric"]
          metric_value: number | null
          operator: Database["public"]["Enums"]["compliance_operator"]
          rule_code: string
          rule_id: string | null
          rule_name: string
          run_at: string
          run_by: string | null
          severity: Database["public"]["Enums"]["compliance_severity"]
          status: Database["public"]["Enums"]["compliance_status"]
          threshold_fail: number
          threshold_warn: number | null
        }
        Insert: {
          details?: Json
          framework: Database["public"]["Enums"]["compliance_framework"]
          id?: string
          metric: Database["public"]["Enums"]["compliance_metric"]
          metric_value?: number | null
          operator: Database["public"]["Enums"]["compliance_operator"]
          rule_code: string
          rule_id?: string | null
          rule_name: string
          run_at?: string
          run_by?: string | null
          severity: Database["public"]["Enums"]["compliance_severity"]
          status: Database["public"]["Enums"]["compliance_status"]
          threshold_fail: number
          threshold_warn?: number | null
        }
        Update: {
          details?: Json
          framework?: Database["public"]["Enums"]["compliance_framework"]
          id?: string
          metric?: Database["public"]["Enums"]["compliance_metric"]
          metric_value?: number | null
          operator?: Database["public"]["Enums"]["compliance_operator"]
          rule_code?: string
          rule_id?: string | null
          rule_name?: string
          run_at?: string
          run_by?: string | null
          severity?: Database["public"]["Enums"]["compliance_severity"]
          status?: Database["public"]["Enums"]["compliance_status"]
          threshold_fail?: number
          threshold_warn?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_checks_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "compliance_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_evidence: {
        Row: {
          created_at: string
          description: string | null
          id: string
          task_id: string
          title: string
          uploaded_by: string | null
          url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          task_id: string
          title: string
          uploaded_by?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          task_id?: string
          title?: string
          uploaded_by?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_evidence_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "compliance_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_rules: {
        Row: {
          active: boolean
          category: string
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          framework: Database["public"]["Enums"]["compliance_framework"]
          id: string
          is_preset: boolean
          metric: Database["public"]["Enums"]["compliance_metric"]
          name: string
          operator: Database["public"]["Enums"]["compliance_operator"]
          recommendation: string | null
          reference: string | null
          severity: Database["public"]["Enums"]["compliance_severity"]
          threshold_fail: number
          threshold_warn: number | null
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          framework?: Database["public"]["Enums"]["compliance_framework"]
          id?: string
          is_preset?: boolean
          metric: Database["public"]["Enums"]["compliance_metric"]
          name: string
          operator?: Database["public"]["Enums"]["compliance_operator"]
          recommendation?: string | null
          reference?: string | null
          severity?: Database["public"]["Enums"]["compliance_severity"]
          threshold_fail: number
          threshold_warn?: number | null
          unit?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          framework?: Database["public"]["Enums"]["compliance_framework"]
          id?: string
          is_preset?: boolean
          metric?: Database["public"]["Enums"]["compliance_metric"]
          name?: string
          operator?: Database["public"]["Enums"]["compliance_operator"]
          recommendation?: string | null
          reference?: string | null
          severity?: Database["public"]["Enums"]["compliance_severity"]
          threshold_fail?: number
          threshold_warn?: number | null
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      compliance_tasks: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          assignee: string | null
          check_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          framework: Database["public"]["Enums"]["compliance_framework"]
          id: string
          priority: number
          recommendation: string | null
          rejection_reason: string | null
          resolution: string | null
          rule_id: string | null
          severity: Database["public"]["Enums"]["compliance_severity"]
          status: Database["public"]["Enums"]["compliance_task_status"]
          submitted_at: string | null
          submitted_by: string | null
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          assignee?: string | null
          check_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          framework?: Database["public"]["Enums"]["compliance_framework"]
          id?: string
          priority?: number
          recommendation?: string | null
          rejection_reason?: string | null
          resolution?: string | null
          rule_id?: string | null
          severity?: Database["public"]["Enums"]["compliance_severity"]
          status?: Database["public"]["Enums"]["compliance_task_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          assignee?: string | null
          check_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          framework?: Database["public"]["Enums"]["compliance_framework"]
          id?: string
          priority?: number
          recommendation?: string | null
          rejection_reason?: string | null
          resolution?: string | null
          rule_id?: string | null
          severity?: Database["public"]["Enums"]["compliance_severity"]
          status?: Database["public"]["Enums"]["compliance_task_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_tasks_check_id_fkey"
            columns: ["check_id"]
            isOneToOne: false
            referencedRelation: "compliance_checks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_tasks_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "compliance_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_borrowers: {
        Row: {
          annual_revenue: number | null
          borrower_type: Database["public"]["Enums"]["borrower_type"]
          code: string
          country: string | null
          created_at: string
          created_by: string
          credit_rating: string | null
          id: string
          industry: string | null
          name: string
          notes: string | null
          pd: number
          updated_at: string
        }
        Insert: {
          annual_revenue?: number | null
          borrower_type?: Database["public"]["Enums"]["borrower_type"]
          code: string
          country?: string | null
          created_at?: string
          created_by: string
          credit_rating?: string | null
          id?: string
          industry?: string | null
          name: string
          notes?: string | null
          pd?: number
          updated_at?: string
        }
        Update: {
          annual_revenue?: number | null
          borrower_type?: Database["public"]["Enums"]["borrower_type"]
          code?: string
          country?: string | null
          created_at?: string
          created_by?: string
          credit_rating?: string | null
          id?: string
          industry?: string | null
          name?: string
          notes?: string | null
          pd?: number
          updated_at?: string
        }
        Relationships: []
      }
      credit_collateral: {
        Row: {
          collateral_type: Database["public"]["Enums"]["collateral_type"]
          created_at: string
          created_by: string
          currency: string
          description: string | null
          eligible_value: number
          haircut: number
          id: string
          loan_id: string
          market_value: number
          updated_at: string
          valuation_date: string | null
        }
        Insert: {
          collateral_type?: Database["public"]["Enums"]["collateral_type"]
          created_at?: string
          created_by: string
          currency?: string
          description?: string | null
          eligible_value?: number
          haircut?: number
          id?: string
          loan_id: string
          market_value?: number
          updated_at?: string
          valuation_date?: string | null
        }
        Update: {
          collateral_type?: Database["public"]["Enums"]["collateral_type"]
          created_at?: string
          created_by?: string
          currency?: string
          description?: string | null
          eligible_value?: number
          haircut?: number
          id?: string
          loan_id?: string
          market_value?: number
          updated_at?: string
          valuation_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_collateral_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "credit_loans"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_early_warnings: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          borrower_id: string | null
          id: string
          loan_id: string | null
          message: string | null
          severity: Database["public"]["Enums"]["watch_severity"]
          signal_type: string
          signal_value: number | null
          status: Database["public"]["Enums"]["warning_status"]
          threshold: number | null
          triggered_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          borrower_id?: string | null
          id?: string
          loan_id?: string | null
          message?: string | null
          severity?: Database["public"]["Enums"]["watch_severity"]
          signal_type: string
          signal_value?: number | null
          status?: Database["public"]["Enums"]["warning_status"]
          threshold?: number | null
          triggered_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          borrower_id?: string | null
          id?: string
          loan_id?: string | null
          message?: string | null
          severity?: Database["public"]["Enums"]["watch_severity"]
          signal_type?: string
          signal_value?: number | null
          status?: Database["public"]["Enums"]["warning_status"]
          threshold?: number | null
          triggered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_early_warnings_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "credit_borrowers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_early_warnings_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "credit_portfolio_summary"
            referencedColumns: ["borrower_id"]
          },
          {
            foreignKeyName: "credit_early_warnings_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "credit_loans"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_loans: {
        Row: {
          borrower_id: string
          ccf: number
          created_at: string
          created_by: string
          currency: string
          days_past_due: number
          disbursement_date: string | null
          ead: number
          expected_loss: number
          id: string
          interest_rate: number
          lgd: number
          loan_number: string
          maturity_date: string | null
          notes: string | null
          outstanding: number
          pd_override: number | null
          principal: number
          product_type: string
          status: Database["public"]["Enums"]["loan_status"]
          undrawn: number
          updated_at: string
        }
        Insert: {
          borrower_id: string
          ccf?: number
          created_at?: string
          created_by: string
          currency?: string
          days_past_due?: number
          disbursement_date?: string | null
          ead?: number
          expected_loss?: number
          id?: string
          interest_rate?: number
          lgd?: number
          loan_number: string
          maturity_date?: string | null
          notes?: string | null
          outstanding?: number
          pd_override?: number | null
          principal?: number
          product_type?: string
          status?: Database["public"]["Enums"]["loan_status"]
          undrawn?: number
          updated_at?: string
        }
        Update: {
          borrower_id?: string
          ccf?: number
          created_at?: string
          created_by?: string
          currency?: string
          days_past_due?: number
          disbursement_date?: string | null
          ead?: number
          expected_loss?: number
          id?: string
          interest_rate?: number
          lgd?: number
          loan_number?: string
          maturity_date?: string | null
          notes?: string | null
          outstanding?: number
          pd_override?: number | null
          principal?: number
          product_type?: string
          status?: Database["public"]["Enums"]["loan_status"]
          undrawn?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_loans_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "credit_borrowers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_loans_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "credit_portfolio_summary"
            referencedColumns: ["borrower_id"]
          },
        ]
      }
      credit_ratings: {
        Row: {
          agency: string
          borrower_id: string
          comment: string | null
          created_at: string
          id: string
          outlook: string | null
          pd: number | null
          rated_at: string
          rated_by: string | null
          rating: string
        }
        Insert: {
          agency?: string
          borrower_id: string
          comment?: string | null
          created_at?: string
          id?: string
          outlook?: string | null
          pd?: number | null
          rated_at?: string
          rated_by?: string | null
          rating: string
        }
        Update: {
          agency?: string
          borrower_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          outlook?: string | null
          pd?: number | null
          rated_at?: string
          rated_by?: string | null
          rating?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_ratings_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "credit_borrowers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_ratings_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "credit_portfolio_summary"
            referencedColumns: ["borrower_id"]
          },
        ]
      }
      credit_watchlist: {
        Row: {
          added_at: string
          added_by: string
          borrower_id: string | null
          id: string
          loan_id: string | null
          reason: string
          resolution: string | null
          resolved_at: string | null
          severity: Database["public"]["Enums"]["watch_severity"]
        }
        Insert: {
          added_at?: string
          added_by: string
          borrower_id?: string | null
          id?: string
          loan_id?: string | null
          reason: string
          resolution?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["watch_severity"]
        }
        Update: {
          added_at?: string
          added_by?: string
          borrower_id?: string | null
          id?: string
          loan_id?: string | null
          reason?: string
          resolution?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["watch_severity"]
        }
        Relationships: [
          {
            foreignKeyName: "credit_watchlist_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "credit_borrowers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_watchlist_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "credit_portfolio_summary"
            referencedColumns: ["borrower_id"]
          },
          {
            foreignKeyName: "credit_watchlist_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "credit_loans"
            referencedColumns: ["id"]
          },
        ]
      }
      import_history: {
        Row: {
          created_at: string
          created_by: string
          duration_ms: number
          errors: Json
          file_name: string
          id: string
          package_key: string
          package_label: string
          rows_failed: number
          rows_imported: number
          sheets: Json
          status: string
        }
        Insert: {
          created_at?: string
          created_by: string
          duration_ms?: number
          errors?: Json
          file_name: string
          id?: string
          package_key: string
          package_label: string
          rows_failed?: number
          rows_imported?: number
          sheets?: Json
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          duration_ms?: number
          errors?: Json
          file_name?: string
          id?: string
          package_key?: string
          package_label?: string
          rows_failed?: number
          rows_imported?: number
          sheets?: Json
          status?: string
        }
        Relationships: []
      }
      liq_cashflows: {
        Row: {
          amount: number
          bucket: Database["public"]["Enums"]["liq_bucket"]
          cashflow_date: string
          category: string
          counterparty: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string
          direction: Database["public"]["Enums"]["liq_direction"]
          id: string
          stress_factor: number
          updated_at: string
        }
        Insert: {
          amount?: number
          bucket: Database["public"]["Enums"]["liq_bucket"]
          cashflow_date?: string
          category?: string
          counterparty?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description: string
          direction: Database["public"]["Enums"]["liq_direction"]
          id?: string
          stress_factor?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          bucket?: Database["public"]["Enums"]["liq_bucket"]
          cashflow_date?: string
          category?: string
          counterparty?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string
          direction?: Database["public"]["Enums"]["liq_direction"]
          id?: string
          stress_factor?: number
          updated_at?: string
        }
        Relationships: []
      }
      liq_funding_sources: {
        Row: {
          amount: number
          asf_factor: number
          counterparty: string | null
          created_at: string
          created_by: string | null
          currency: string
          id: string
          name: string
          rsf_factor: number
          source_type: Database["public"]["Enums"]["funding_source_type"]
          stable: boolean
          tenor_days: number
          updated_at: string
        }
        Insert: {
          amount?: number
          asf_factor?: number
          counterparty?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          name: string
          rsf_factor?: number
          source_type: Database["public"]["Enums"]["funding_source_type"]
          stable?: boolean
          tenor_days?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          asf_factor?: number
          counterparty?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          name?: string
          rsf_factor?: number
          source_type?: Database["public"]["Enums"]["funding_source_type"]
          stable?: boolean
          tenor_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      liq_hqla: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          eligible_value: number
          encumbered: boolean
          haircut: number
          id: string
          market_value: number
          name: string
          notes: string | null
          tier: Database["public"]["Enums"]["hqla_tier"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          eligible_value?: number
          encumbered?: boolean
          haircut?: number
          id?: string
          market_value?: number
          name: string
          notes?: string | null
          tier: Database["public"]["Enums"]["hqla_tier"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          eligible_value?: number
          encumbered?: boolean
          haircut?: number
          id?: string
          market_value?: number
          name?: string
          notes?: string | null
          tier?: Database["public"]["Enums"]["hqla_tier"]
          updated_at?: string
        }
        Relationships: []
      }
      liq_stress_scenarios: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          extra_haircut: number
          id: string
          inflow_haircut: number
          name: string
          results: Json | null
          retail_runoff: number
          updated_at: string
          wholesale_runoff: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          extra_haircut?: number
          id?: string
          inflow_haircut?: number
          name: string
          results?: Json | null
          retail_runoff?: number
          updated_at?: string
          wholesale_runoff?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          extra_haircut?: number
          id?: string
          inflow_haircut?: number
          name?: string
          results?: Json | null
          retail_runoff?: number
          updated_at?: string
          wholesale_runoff?: number
        }
        Relationships: []
      }
      market_positions: {
        Row: {
          asset_class: Database["public"]["Enums"]["market_asset_class"]
          beta: number
          convexity: number
          coupon_rate: number
          created_at: string
          created_by: string
          currency: string
          delta_1pct: number
          duration: number
          dv01: number
          id: string
          market_value: number
          maturity_date: string | null
          name: string
          notes: string | null
          notional: number
          portfolio: string
          position_code: string
          price: number
          quantity: number
          sensitivity: number
          updated_at: string
          volatility: number
        }
        Insert: {
          asset_class: Database["public"]["Enums"]["market_asset_class"]
          beta?: number
          convexity?: number
          coupon_rate?: number
          created_at?: string
          created_by: string
          currency?: string
          delta_1pct?: number
          duration?: number
          dv01?: number
          id?: string
          market_value?: number
          maturity_date?: string | null
          name: string
          notes?: string | null
          notional?: number
          portfolio?: string
          position_code: string
          price?: number
          quantity?: number
          sensitivity?: number
          updated_at?: string
          volatility?: number
        }
        Update: {
          asset_class?: Database["public"]["Enums"]["market_asset_class"]
          beta?: number
          convexity?: number
          coupon_rate?: number
          created_at?: string
          created_by?: string
          currency?: string
          delta_1pct?: number
          duration?: number
          dv01?: number
          id?: string
          market_value?: number
          maturity_date?: string | null
          name?: string
          notes?: string | null
          notional?: number
          portfolio?: string
          position_code?: string
          price?: number
          quantity?: number
          sensitivity?: number
          updated_at?: string
          volatility?: number
        }
        Relationships: []
      }
      market_scenarios: {
        Row: {
          commodity_shock: number
          created_at: string
          created_by: string
          description: string | null
          equity_shock: number
          fx_shock: number
          id: string
          ir_shock_bp: number
          name: string
          pnl_impact: number
          updated_at: string
        }
        Insert: {
          commodity_shock?: number
          created_at?: string
          created_by: string
          description?: string | null
          equity_shock?: number
          fx_shock?: number
          id?: string
          ir_shock_bp?: number
          name: string
          pnl_impact?: number
          updated_at?: string
        }
        Update: {
          commodity_shock?: number
          created_at?: string
          created_by?: string
          description?: string | null
          equity_shock?: number
          fx_shock?: number
          id?: string
          ir_shock_bp?: number
          name?: string
          pnl_impact?: number
          updated_at?: string
        }
        Relationships: []
      }
      market_var_runs: {
        Row: {
          breakdown: Json
          confidence: number
          es_amount: number
          horizon_days: number
          id: string
          method: Database["public"]["Enums"]["var_method"]
          name: string
          notes: string | null
          portfolio_mv: number
          portfolio_volatility: number
          run_at: string
          run_by: string
          var_amount: number
        }
        Insert: {
          breakdown?: Json
          confidence?: number
          es_amount?: number
          horizon_days?: number
          id?: string
          method?: Database["public"]["Enums"]["var_method"]
          name: string
          notes?: string | null
          portfolio_mv?: number
          portfolio_volatility?: number
          run_at?: string
          run_by: string
          var_amount?: number
        }
        Update: {
          breakdown?: Json
          confidence?: number
          es_amount?: number
          horizon_days?: number
          id?: string
          method?: Database["public"]["Enums"]["var_method"]
          name?: string
          notes?: string | null
          portfolio_mv?: number
          portfolio_volatility?: number
          run_at?: string
          run_by?: string
          var_amount?: number
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          enabled: boolean
          id: string
          quiet_hours_end: number | null
          quiet_hours_start: number | null
          source_module: Database["public"]["Enums"]["workflow_source_module"]
          updated_at: string
          user_id: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          enabled?: boolean
          id?: string
          quiet_hours_end?: number | null
          quiet_hours_start?: number | null
          source_module?: Database["public"]["Enums"]["workflow_source_module"]
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          enabled?: boolean
          id?: string
          quiet_hours_end?: number | null
          quiet_hours_start?: number | null
          source_module?: Database["public"]["Enums"]["workflow_source_module"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          error: string | null
          id: string
          metadata: Json
          priority: Database["public"]["Enums"]["notification_priority"]
          read_at: string | null
          sent_at: string | null
          source_id: string | null
          source_module: Database["public"]["Enums"]["workflow_source_module"]
          status: Database["public"]["Enums"]["notification_status"]
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          body?: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          error?: string | null
          id?: string
          metadata?: Json
          priority?: Database["public"]["Enums"]["notification_priority"]
          read_at?: string | null
          sent_at?: string | null
          source_id?: string | null
          source_module?: Database["public"]["Enums"]["workflow_source_module"]
          status?: Database["public"]["Enums"]["notification_status"]
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          body?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          error?: string | null
          id?: string
          metadata?: Json
          priority?: Database["public"]["Enums"]["notification_priority"]
          read_at?: string | null
          sent_at?: string | null
          source_id?: string | null
          source_module?: Database["public"]["Enums"]["workflow_source_module"]
          status?: Database["public"]["Enums"]["notification_status"]
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      op_incidents: {
        Row: {
          business_line: string | null
          category: Database["public"]["Enums"]["op_category"]
          created_at: string
          currency: string
          description: string | null
          discovered_at: string
          event_type: string | null
          gross_loss: number
          id: string
          net_loss: number
          occurred_at: string
          owner_email: string | null
          recovery: number
          ref_code: string
          reported_by: string
          resolved_at: string | null
          root_cause: string | null
          severity: Database["public"]["Enums"]["op_severity"]
          status: Database["public"]["Enums"]["op_status"]
          title: string
          updated_at: string
        }
        Insert: {
          business_line?: string | null
          category?: Database["public"]["Enums"]["op_category"]
          created_at?: string
          currency?: string
          description?: string | null
          discovered_at?: string
          event_type?: string | null
          gross_loss?: number
          id?: string
          net_loss?: number
          occurred_at?: string
          owner_email?: string | null
          recovery?: number
          ref_code: string
          reported_by: string
          resolved_at?: string | null
          root_cause?: string | null
          severity?: Database["public"]["Enums"]["op_severity"]
          status?: Database["public"]["Enums"]["op_status"]
          title: string
          updated_at?: string
        }
        Update: {
          business_line?: string | null
          category?: Database["public"]["Enums"]["op_category"]
          created_at?: string
          currency?: string
          description?: string | null
          discovered_at?: string
          event_type?: string | null
          gross_loss?: number
          id?: string
          net_loss?: number
          occurred_at?: string
          owner_email?: string | null
          recovery?: number
          ref_code?: string
          reported_by?: string
          resolved_at?: string | null
          root_cause?: string | null
          severity?: Database["public"]["Enums"]["op_severity"]
          status?: Database["public"]["Enums"]["op_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      op_kris: {
        Row: {
          category: string
          code: string
          created_at: string
          created_by: string
          current_value: number
          frequency: string
          higher_is_worse: boolean
          id: string
          name: string
          notes: string | null
          owner: string | null
          status: Database["public"]["Enums"]["kri_status"]
          threshold_amber: number
          threshold_red: number
          unit: string
          updated_at: string
        }
        Insert: {
          category?: string
          code: string
          created_at?: string
          created_by: string
          current_value?: number
          frequency?: string
          higher_is_worse?: boolean
          id?: string
          name: string
          notes?: string | null
          owner?: string | null
          status?: Database["public"]["Enums"]["kri_status"]
          threshold_amber?: number
          threshold_red?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          created_by?: string
          current_value?: number
          frequency?: string
          higher_is_worse?: boolean
          id?: string
          name?: string
          notes?: string | null
          owner?: string | null
          status?: Database["public"]["Enums"]["kri_status"]
          threshold_amber?: number
          threshold_red?: number
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      op_rcsa: {
        Row: {
          control_description: string | null
          control_effectiveness: number
          created_at: string
          created_by: string
          id: string
          inherent_impact: number
          inherent_likelihood: number
          inherent_score: number
          last_reviewed: string | null
          owner: string | null
          process_name: string
          residual_impact: number
          residual_likelihood: number
          residual_score: number
          risk_description: string
          updated_at: string
        }
        Insert: {
          control_description?: string | null
          control_effectiveness?: number
          created_at?: string
          created_by: string
          id?: string
          inherent_impact?: number
          inherent_likelihood?: number
          inherent_score?: number
          last_reviewed?: string | null
          owner?: string | null
          process_name: string
          residual_impact?: number
          residual_likelihood?: number
          residual_score?: number
          risk_description: string
          updated_at?: string
        }
        Update: {
          control_description?: string | null
          control_effectiveness?: number
          created_at?: string
          created_by?: string
          id?: string
          inherent_impact?: number
          inherent_likelihood?: number
          inherent_score?: number
          last_reviewed?: string | null
          owner?: string | null
          process_name?: string
          residual_impact?: number
          residual_likelihood?: number
          residual_score?: number
          risk_description?: string
          updated_at?: string
        }
        Relationships: []
      }
      op_risk_register: {
        Row: {
          category: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          impact: number
          inherent_score: number
          likelihood: number
          mitigation: string | null
          owner: string | null
          residual_impact: number
          residual_likelihood: number
          residual_score: number
          review_date: string | null
          risk_code: string
          status: Database["public"]["Enums"]["risk_status"]
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          impact?: number
          inherent_score?: number
          likelihood?: number
          mitigation?: string | null
          owner?: string | null
          residual_impact?: number
          residual_likelihood?: number
          residual_score?: number
          review_date?: string | null
          risk_code: string
          status?: Database["public"]["Enums"]["risk_status"]
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          impact?: number
          inherent_score?: number
          likelihood?: number
          mitigation?: string | null
          owner?: string | null
          residual_impact?: number
          residual_likelihood?: number
          residual_score?: number
          review_date?: string | null
          risk_code?: string
          status?: Database["public"]["Enums"]["risk_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      report_runs: {
        Row: {
          audience: string
          distributed: boolean
          distribution_note: string | null
          error: string | null
          file_name: string | null
          format: Database["public"]["Enums"]["report_format"]
          id: string
          metrics: Json
          recipients: string[]
          report_key: string
          report_name: string
          run_at: string
          run_by: string | null
          schedule_id: string | null
          status: Database["public"]["Enums"]["report_run_status"]
        }
        Insert: {
          audience: string
          distributed?: boolean
          distribution_note?: string | null
          error?: string | null
          file_name?: string | null
          format: Database["public"]["Enums"]["report_format"]
          id?: string
          metrics?: Json
          recipients?: string[]
          report_key: string
          report_name: string
          run_at?: string
          run_by?: string | null
          schedule_id?: string | null
          status?: Database["public"]["Enums"]["report_run_status"]
        }
        Update: {
          audience?: string
          distributed?: boolean
          distribution_note?: string | null
          error?: string | null
          file_name?: string | null
          format?: Database["public"]["Enums"]["report_format"]
          id?: string
          metrics?: Json
          recipients?: string[]
          report_key?: string
          report_name?: string
          run_at?: string
          run_by?: string | null
          schedule_id?: string | null
          status?: Database["public"]["Enums"]["report_run_status"]
        }
        Relationships: [
          {
            foreignKeyName: "report_runs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "report_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      report_schedules: {
        Row: {
          active: boolean
          audience: string
          cadence: Database["public"]["Enums"]["report_cadence"]
          created_at: string
          created_by: string | null
          formats: Database["public"]["Enums"]["report_format"][]
          id: string
          last_run_at: string | null
          next_run_at: string | null
          notes: string | null
          recipients: string[]
          report_key: string
          report_name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          audience: string
          cadence?: Database["public"]["Enums"]["report_cadence"]
          created_at?: string
          created_by?: string | null
          formats?: Database["public"]["Enums"]["report_format"][]
          id?: string
          last_run_at?: string | null
          next_run_at?: string | null
          notes?: string | null
          recipients?: string[]
          report_key: string
          report_name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          audience?: string
          cadence?: Database["public"]["Enums"]["report_cadence"]
          created_at?: string
          created_by?: string | null
          formats?: Database["public"]["Enums"]["report_format"][]
          id?: string
          last_run_at?: string | null
          next_run_at?: string | null
          notes?: string | null
          recipients?: string[]
          report_key?: string
          report_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      risk_weight_rules: {
        Row: {
          active: boolean
          asset_class: string
          category: Database["public"]["Enums"]["rwa_category"]
          counterparty_type: string | null
          created_at: string
          description: string | null
          id: string
          rating: string | null
          risk_weight: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          asset_class: string
          category: Database["public"]["Enums"]["rwa_category"]
          counterparty_type?: string | null
          created_at?: string
          description?: string | null
          id?: string
          rating?: string | null
          risk_weight: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          asset_class?: string
          category?: Database["public"]["Enums"]["rwa_category"]
          counterparty_type?: string | null
          created_at?: string
          description?: string | null
          id?: string
          rating?: string | null
          risk_weight?: number
          updated_at?: string
        }
        Relationships: []
      }
      rwa_approvals: {
        Row: {
          action: Database["public"]["Enums"]["approval_status"]
          actor_id: string
          asset_id: string
          comment: string | null
          created_at: string
          id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["approval_status"]
          actor_id: string
          asset_id: string
          comment?: string | null
          created_at?: string
          id?: string
        }
        Update: {
          action?: Database["public"]["Enums"]["approval_status"]
          actor_id?: string
          asset_id?: string
          comment?: string | null
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rwa_approvals_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "rwa_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      rwa_assets: {
        Row: {
          asset_class: string
          category: Database["public"]["Enums"]["rwa_category"]
          counterparty_type: string | null
          created_at: string
          created_by: string
          currency: string
          exposure_amount: number
          id: string
          name: string
          notes: string | null
          rating: string | null
          reference_code: string
          risk_weight: number
          rwa_amount: number
          status: Database["public"]["Enums"]["approval_status"]
          updated_at: string
        }
        Insert: {
          asset_class: string
          category: Database["public"]["Enums"]["rwa_category"]
          counterparty_type?: string | null
          created_at?: string
          created_by: string
          currency?: string
          exposure_amount?: number
          id?: string
          name: string
          notes?: string | null
          rating?: string | null
          reference_code: string
          risk_weight?: number
          rwa_amount?: number
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
        }
        Update: {
          asset_class?: string
          category?: Database["public"]["Enums"]["rwa_category"]
          counterparty_type?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          exposure_amount?: number
          id?: string
          name?: string
          notes?: string | null
          rating?: string | null
          reference_code?: string
          risk_weight?: number
          rwa_amount?: number
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
        }
        Relationships: []
      }
      rwa_calculations: {
        Row: {
          asset_id: string | null
          calculated_at: string
          calculated_by: string | null
          category: Database["public"]["Enums"]["rwa_category"]
          exposure_amount: number
          id: string
          risk_weight: number
          rwa_amount: number
          snapshot: Json | null
        }
        Insert: {
          asset_id?: string | null
          calculated_at?: string
          calculated_by?: string | null
          category: Database["public"]["Enums"]["rwa_category"]
          exposure_amount: number
          id?: string
          risk_weight: number
          rwa_amount: number
          snapshot?: Json | null
        }
        Update: {
          asset_id?: string | null
          calculated_at?: string
          calculated_by?: string | null
          category?: Database["public"]["Enums"]["rwa_category"]
          exposure_amount?: number
          id?: string
          risk_weight?: number
          rwa_amount?: number
          snapshot?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "rwa_calculations_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "rwa_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      stress_runs: {
        Row: {
          ai_analysis: string | null
          id: string
          parameters: Json
          results: Json
          run_at: string
          run_by: string | null
          scenario_id: string | null
          scenario_name: string
          severity: Database["public"]["Enums"]["stress_severity"]
          stress_type: Database["public"]["Enums"]["stress_type"]
        }
        Insert: {
          ai_analysis?: string | null
          id?: string
          parameters?: Json
          results?: Json
          run_at?: string
          run_by?: string | null
          scenario_id?: string | null
          scenario_name: string
          severity: Database["public"]["Enums"]["stress_severity"]
          stress_type: Database["public"]["Enums"]["stress_type"]
        }
        Update: {
          ai_analysis?: string | null
          id?: string
          parameters?: Json
          results?: Json
          run_at?: string
          run_by?: string | null
          scenario_id?: string | null
          scenario_name?: string
          severity?: Database["public"]["Enums"]["stress_severity"]
          stress_type?: Database["public"]["Enums"]["stress_type"]
        }
        Relationships: [
          {
            foreignKeyName: "stress_runs_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "stress_scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      stress_scenarios: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_preset: boolean
          name: string
          parameters: Json
          severity: Database["public"]["Enums"]["stress_severity"]
          stress_type: Database["public"]["Enums"]["stress_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_preset?: boolean
          name: string
          parameters?: Json
          severity?: Database["public"]["Enums"]["stress_severity"]
          stress_type?: Database["public"]["Enums"]["stress_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_preset?: boolean
          name?: string
          parameters?: Json
          severity?: Database["public"]["Enums"]["stress_severity"]
          stress_type?: Database["public"]["Enums"]["stress_type"]
          updated_at?: string
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
          role: Database["public"]["Enums"]["app_role"]
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
      workflow_events: {
        Row: {
          actor: string | null
          created_at: string
          event_type: string
          id: string
          message: string | null
          metadata: Json
          source_id: string | null
          source_module: Database["public"]["Enums"]["workflow_source_module"]
          target_user: string | null
        }
        Insert: {
          actor?: string | null
          created_at?: string
          event_type: string
          id?: string
          message?: string | null
          metadata?: Json
          source_id?: string | null
          source_module: Database["public"]["Enums"]["workflow_source_module"]
          target_user?: string | null
        }
        Update: {
          actor?: string | null
          created_at?: string
          event_type?: string
          id?: string
          message?: string | null
          metadata?: Json
          source_id?: string | null
          source_module?: Database["public"]["Enums"]["workflow_source_module"]
          target_user?: string | null
        }
        Relationships: []
      }
      workflow_rules: {
        Row: {
          action: Database["public"]["Enums"]["workflow_action"]
          active: boolean
          channel: Database["public"]["Enums"]["notification_channel"]
          condition: Json
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          offset_days: number
          source_module: Database["public"]["Enums"]["workflow_source_module"]
          target_role: string | null
          trigger: Database["public"]["Enums"]["workflow_rule_trigger"]
          updated_at: string
        }
        Insert: {
          action?: Database["public"]["Enums"]["workflow_action"]
          active?: boolean
          channel?: Database["public"]["Enums"]["notification_channel"]
          condition?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          offset_days?: number
          source_module: Database["public"]["Enums"]["workflow_source_module"]
          target_role?: string | null
          trigger: Database["public"]["Enums"]["workflow_rule_trigger"]
          updated_at?: string
        }
        Update: {
          action?: Database["public"]["Enums"]["workflow_action"]
          active?: boolean
          channel?: Database["public"]["Enums"]["notification_channel"]
          condition?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          offset_days?: number
          source_module?: Database["public"]["Enums"]["workflow_source_module"]
          target_role?: string | null
          trigger?: Database["public"]["Enums"]["workflow_rule_trigger"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      credit_portfolio_summary: {
        Row: {
          borrower_id: string | null
          borrower_type: Database["public"]["Enums"]["borrower_type"] | null
          code: string | null
          country: string | null
          credit_rating: string | null
          has_default: boolean | null
          industry: string | null
          loan_count: number | null
          max_dpd: number | null
          name: string | null
          pd: number | null
          total_ead: number | null
          total_el: number | null
          total_outstanding: number | null
        }
        Relationships: []
      }
      market_risk_summary: {
        Row: {
          asset_class: Database["public"]["Enums"]["market_asset_class"] | null
          avg_volatility: number | null
          position_count: number | null
          total_dv01: number | null
          total_mv: number | null
          total_notional: number | null
          total_sensitivity: number | null
        }
        Relationships: []
      }
      op_loss_summary: {
        Row: {
          category: Database["public"]["Enums"]["op_category"] | null
          incident_count: number | null
          open_count: number | null
          total_gross: number | null
          total_net: number | null
          total_recovery: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "approver" | "analyst" | "viewer"
      approval_status: "draft" | "pending" | "approved" | "rejected"
      borrower_type: "individual" | "sme" | "corporate" | "sovereign" | "bank"
      collateral_type:
        | "real_estate"
        | "cash"
        | "securities"
        | "equipment"
        | "inventory"
        | "guarantee"
        | "other"
      compliance_framework: "basel_iii" | "basel_iv" | "local" | "other"
      compliance_metric:
        | "lcr"
        | "nsfr"
        | "cet1_ratio"
        | "tier1_ratio"
        | "total_capital_ratio"
        | "leverage_ratio"
        | "npl_ratio"
        | "concentration"
        | "kri_breach"
        | "custom"
      compliance_operator: "gte" | "lte" | "gt" | "lt" | "eq"
      compliance_severity: "low" | "medium" | "high" | "critical"
      compliance_status: "pass" | "warn" | "fail"
      compliance_task_status:
        | "open"
        | "in_progress"
        | "pending_approval"
        | "approved"
        | "rejected"
        | "closed"
      funding_source_type:
        | "retail_deposits"
        | "wholesale_deposits"
        | "repo"
        | "interbank"
        | "bond"
        | "equity"
        | "other"
      hqla_tier: "level1" | "level2a" | "level2b"
      kri_status: "green" | "amber" | "red"
      liq_bucket: "overnight" | "1w" | "1m" | "3m" | "6m" | "1y" | "gt1y"
      liq_direction: "inflow" | "outflow"
      loan_status:
        | "active"
        | "closed"
        | "default"
        | "written_off"
        | "restructured"
      market_asset_class: "fx" | "ir" | "commodity" | "equity"
      notification_channel: "email" | "sms" | "push" | "in_app"
      notification_priority: "low" | "normal" | "high" | "urgent"
      notification_status: "pending" | "sent" | "failed" | "skipped" | "read"
      op_category: "incident" | "loss" | "fraud" | "cyber" | "bcp"
      op_severity: "low" | "medium" | "high" | "critical"
      op_status: "open" | "investigating" | "contained" | "resolved" | "closed"
      report_cadence: "once" | "daily" | "weekly" | "monthly" | "quarterly"
      report_format: "pdf" | "excel" | "csv" | "word"
      report_run_status: "pending" | "success" | "failed"
      risk_status: "open" | "mitigated" | "accepted" | "transferred" | "closed"
      rwa_category: "credit" | "market" | "operational"
      stress_severity: "mild" | "moderate" | "severe" | "extreme"
      stress_type:
        | "economic_crisis"
        | "inflation"
        | "interest_shock"
        | "currency_collapse"
        | "mass_withdrawal"
        | "pandemic"
        | "oil_price_crash"
        | "political_crisis"
        | "custom"
      var_method: "parametric" | "historical" | "monte_carlo"
      warning_status: "open" | "acknowledged" | "resolved" | "false_positive"
      watch_severity: "low" | "medium" | "high" | "critical"
      workflow_action:
        | "notify_assignee"
        | "notify_role"
        | "reassign"
        | "change_priority"
        | "change_status"
      workflow_rule_trigger:
        | "reminder_before_due"
        | "escalate_overdue"
        | "on_status_change"
        | "on_severity"
      workflow_source_module:
        | "compliance"
        | "credit"
        | "market"
        | "operational"
        | "liquidity"
        | "stress"
        | "rwa"
        | "reporting"
        | "system"
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
      app_role: ["admin", "approver", "analyst", "viewer"],
      approval_status: ["draft", "pending", "approved", "rejected"],
      borrower_type: ["individual", "sme", "corporate", "sovereign", "bank"],
      collateral_type: [
        "real_estate",
        "cash",
        "securities",
        "equipment",
        "inventory",
        "guarantee",
        "other",
      ],
      compliance_framework: ["basel_iii", "basel_iv", "local", "other"],
      compliance_metric: [
        "lcr",
        "nsfr",
        "cet1_ratio",
        "tier1_ratio",
        "total_capital_ratio",
        "leverage_ratio",
        "npl_ratio",
        "concentration",
        "kri_breach",
        "custom",
      ],
      compliance_operator: ["gte", "lte", "gt", "lt", "eq"],
      compliance_severity: ["low", "medium", "high", "critical"],
      compliance_status: ["pass", "warn", "fail"],
      compliance_task_status: [
        "open",
        "in_progress",
        "pending_approval",
        "approved",
        "rejected",
        "closed",
      ],
      funding_source_type: [
        "retail_deposits",
        "wholesale_deposits",
        "repo",
        "interbank",
        "bond",
        "equity",
        "other",
      ],
      hqla_tier: ["level1", "level2a", "level2b"],
      kri_status: ["green", "amber", "red"],
      liq_bucket: ["overnight", "1w", "1m", "3m", "6m", "1y", "gt1y"],
      liq_direction: ["inflow", "outflow"],
      loan_status: [
        "active",
        "closed",
        "default",
        "written_off",
        "restructured",
      ],
      market_asset_class: ["fx", "ir", "commodity", "equity"],
      notification_channel: ["email", "sms", "push", "in_app"],
      notification_priority: ["low", "normal", "high", "urgent"],
      notification_status: ["pending", "sent", "failed", "skipped", "read"],
      op_category: ["incident", "loss", "fraud", "cyber", "bcp"],
      op_severity: ["low", "medium", "high", "critical"],
      op_status: ["open", "investigating", "contained", "resolved", "closed"],
      report_cadence: ["once", "daily", "weekly", "monthly", "quarterly"],
      report_format: ["pdf", "excel", "csv", "word"],
      report_run_status: ["pending", "success", "failed"],
      risk_status: ["open", "mitigated", "accepted", "transferred", "closed"],
      rwa_category: ["credit", "market", "operational"],
      stress_severity: ["mild", "moderate", "severe", "extreme"],
      stress_type: [
        "economic_crisis",
        "inflation",
        "interest_shock",
        "currency_collapse",
        "mass_withdrawal",
        "pandemic",
        "oil_price_crash",
        "political_crisis",
        "custom",
      ],
      var_method: ["parametric", "historical", "monte_carlo"],
      warning_status: ["open", "acknowledged", "resolved", "false_positive"],
      watch_severity: ["low", "medium", "high", "critical"],
      workflow_action: [
        "notify_assignee",
        "notify_role",
        "reassign",
        "change_priority",
        "change_status",
      ],
      workflow_rule_trigger: [
        "reminder_before_due",
        "escalate_overdue",
        "on_status_change",
        "on_severity",
      ],
      workflow_source_module: [
        "compliance",
        "credit",
        "market",
        "operational",
        "liquidity",
        "stress",
        "rwa",
        "reporting",
        "system",
      ],
    },
  },
} as const
