/**
 * Import Center registry.
 *
 * Defines the four business packages, the sheets each package supports,
 * and the column schema per sheet. Sheets map directly to existing
 * production tables — no parallel schema is created. Sheets requested
 * by the spec that don't yet have a matching table are declared with
 * `table: null` so their structure is still validated and the user gets
 * a template, but rows are reported as "not persisted (module not
 * available yet)" instead of silently dropped.
 */
import type { Database } from "@/integrations/supabase/types";

type PublicTables = keyof Database["public"]["Tables"];

export type ColKind = "string" | "number" | "integer" | "boolean" | "date" | "enum";

export interface ColumnSpec {
  key: string;              // canonical column key (Excel header, case-insensitive)
  target?: string;          // DB column (defaults to key)
  kind: ColKind;
  required?: boolean;
  enumValues?: readonly string[];
  min?: number;
  max?: number;
  default?: unknown;
  /** For foreign key lookup: name of another sheet key providing candidates. */
  fkSheet?: string;
  /** Column in this row used to look up FK by natural key. */
  fkLookupColumn?: string;  // e.g. "borrower_code" -> resolve to borrower_id via credit_borrowers.code
  /** DB column receiving the resolved FK uuid. */
  fkTargetColumn?: string;  // e.g. "borrower_id"
  /** Table + natural-key column to resolve FK against. */
  fkTable?: PublicTables;
  fkNaturalKey?: string;    // e.g. "code"
  /** Reference-data validation: verify the value exists in a ref_* table
   *  before allowing the row to import. The value is stored as-is (free text)
   *  but the import fails with a clear message if the reference record is
   *  missing, telling the user which reference data to create first. */
  refTable?: string;         // e.g. "ref_currencies"
  refColumn?: string;        // e.g. "code"
  refLabel?: string;          // human label, e.g. "Currency"
}

export interface SheetSpec {
  key: string;                    // sheet name in workbook (case-insensitive match)
  label: string;
  /** Existing DB table for INSERT; null = spec-only, no persistence yet. */
  table: PublicTables | null;
  /** Column that serves as the natural key for duplicate detection. */
  naturalKey?: string;
  columns: ColumnSpec[];
  /** Extra note shown in UI. */
  note?: string;
}

export interface PackageSpec {
  key: string;
  label: string;
  description: string;
  sheets: SheetSpec[];
}

// ---------- shared enum values (mirror DB enums) ----------
const BORROWER_TYPES = ["individual", "sme", "corporate", "sovereign", "bank"] as const;
const LOAN_STATUSES = ["active", "closed", "default", "written_off", "restructured"] as const;
const COLLATERAL_TYPES = ["real_estate", "cash", "securities", "equipment", "inventory", "guarantee", "other"] as const;
const HQLA_TIERS = ["level1", "level2a", "level2b"] as const;
const LIQ_BUCKETS = ["overnight", "1w", "1m", "3m", "6m", "1y", "gt1y"] as const;
const LIQ_DIRECTIONS = ["inflow", "outflow"] as const;
const FUNDING_TYPES = ["retail_deposits", "wholesale_deposits", "repo", "interbank", "bond", "equity", "other"] as const;
const KRI_STATUS = ["green", "amber", "red"] as const;
const OP_CATEGORY = ["incident", "loss", "fraud", "cyber", "bcp"] as const;
const OP_SEVERITY = ["low", "medium", "high", "critical"] as const;
const OP_STATUS = ["open", "investigating", "contained", "resolved", "closed"] as const;
const RISK_STATUS = ["open", "mitigated", "accepted", "transferred", "closed"] as const;
const RWA_CATEGORY = ["credit", "market", "operational"] as const;
const MARKET_ASSET_CLASS = ["fx", "ir", "commodity", "equity"] as const;
const APPROVAL_STATUS = ["draft", "pending", "approved", "rejected"] as const;

// ---------- Package 1: Master Data ----------
// REMOVED: Master Data is now managed in-app via the Reference Data module
// (see src/lib/reference-data.ts and routes under /reference-data).
// The old Excel-based Master Data import workflow has been retired.

// ---------- Package 2: Credit Data ----------
const creditData: PackageSpec = {
  key: "credit",
  label: "بيانات الائتمان",
  description: "Borrowers, loans, and collateral — imported into the existing credit tables.",
  sheets: [
    {
      key: "Customers",
      label: "العملاء",
      table: "credit_borrowers",
      naturalKey: "code",
      columns: [
        { key: "code", kind: "string", required: true },
        { key: "name", kind: "string", required: true },
        { key: "borrower_type", kind: "enum", required: true, enumValues: BORROWER_TYPES, default: "corporate" },
        { key: "industry", kind: "string" },
        { key: "country", kind: "string", refTable: "ref_countries", refColumn: "code", refLabel: "Country" },
        { key: "credit_rating", kind: "string", refTable: "ref_rating_grades", refColumn: "code", refLabel: "Rating Grade" },
        { key: "pd", kind: "number", min: 0, max: 1, default: 0.02 },
        { key: "annual_revenue", kind: "number" },
        { key: "notes", kind: "string" },
      ],
    },
    {
      key: "Loans",
      label: "القروض",
      table: "credit_loans",
      naturalKey: "loan_number",
      columns: [
        { key: "loan_number", kind: "string", required: true },
        {
          key: "borrower_code",
          kind: "string",
          required: true,
          fkTable: "credit_borrowers",
          fkNaturalKey: "code",
          fkTargetColumn: "borrower_id",
        },
        { key: "product_type", kind: "string", default: "Term Loan", refTable: "ref_product_types", refColumn: "code", refLabel: "Product Type" },
        { key: "currency", kind: "string", default: "USD", refTable: "ref_currencies", refColumn: "code", refLabel: "Currency" },
        { key: "principal", kind: "number", required: true, min: 0 },
        { key: "outstanding", kind: "number", required: true, min: 0 },
        { key: "undrawn", kind: "number", min: 0, default: 0 },
        { key: "ccf", kind: "number", min: 0, max: 1, default: 0.75 },
        { key: "interest_rate", kind: "number", min: 0, default: 0 },
        { key: "disbursement_date", kind: "date" },
        { key: "maturity_date", kind: "date" },
        { key: "lgd", kind: "number", min: 0, max: 1, default: 0.45 },
        { key: "days_past_due", kind: "integer", min: 0, default: 0 },
        { key: "status", kind: "enum", enumValues: LOAN_STATUSES, default: "active" },
        { key: "notes", kind: "string" },
      ],
    },
    {
      key: "Collateral",
      label: "الضمانات",
      table: "credit_collateral",
      columns: [
        {
          key: "loan_number",
          kind: "string",
          required: true,
          fkTable: "credit_loans",
          fkNaturalKey: "loan_number",
          fkTargetColumn: "loan_id",
        },
        { key: "collateral_type", kind: "enum", required: true, enumValues: COLLATERAL_TYPES, default: "other", refTable: "ref_collateral_types", refColumn: "code", refLabel: "Collateral Type" },
        { key: "description", kind: "string" },
        { key: "market_value", kind: "number", required: true, min: 0 },
        { key: "haircut", kind: "number", min: 0, max: 1, default: 0.2 },
        { key: "currency", kind: "string", default: "USD", refTable: "ref_currencies", refColumn: "code", refLabel: "Currency" },
        { key: "valuation_date", kind: "date" },
      ],
    },
    { key: "Corporate Customers", label: "عملاء الشركات", table: null, note: "Import via Customers with borrower_type=corporate.", columns: [] },
    { key: "Retail Customers", label: "عملاء الأفراد", table: null, note: "Import via Customers with borrower_type=individual.", columns: [] },
    { key: "Facilities", label: "التسهيلات", table: null, note: "Not yet mapped — validated only.", columns: [
      { key: "facility_code", kind: "string", required: true },
      { key: "borrower_code", kind: "string", required: true },
      { key: "limit_amount", kind: "number", required: true },
    ] },
    { key: "Guarantees", label: "الكفالات", table: null, note: "Not yet mapped — validated only.", columns: [
      { key: "loan_number", kind: "string", required: true },
      { key: "guarantor_name", kind: "string", required: true },
      { key: "amount", kind: "number", required: true },
    ] },
    { key: "Exposure", label: "التعرضات", table: null, note: "Derived automatically from Loans (EAD).", columns: [] },
    { key: "Repayment Schedule", label: "جدول السداد", table: null, note: "Not yet mapped — validated only.", columns: [
      { key: "loan_number", kind: "string", required: true },
      { key: "due_date", kind: "date", required: true },
      { key: "principal_due", kind: "number", required: true },
      { key: "interest_due", kind: "number", required: true },
    ] },
    { key: "Default History", label: "سجل التعثر", table: null, note: "Not yet mapped — validated only.", columns: [
      { key: "loan_number", kind: "string", required: true },
      { key: "default_date", kind: "date", required: true },
      { key: "resolution", kind: "string" },
    ] },
  ],
};

// ---------- Package 3: Capital & Liquidity ----------
const capitalLiquidity: PackageSpec = {
  key: "capital",
  label: "رأس المال والسيولة",
  description: "HQLA, cash flows, and funding sources for LCR/NSFR — imported into existing liquidity tables.",
  sheets: [
    {
      key: "HQLA",
      label: "الأصول عالية الجودة",
      table: "liq_hqla",
      columns: [
        { key: "name", kind: "string", required: true },
        { key: "tier", kind: "enum", required: true, enumValues: HQLA_TIERS },
        { key: "currency", kind: "string", default: "USD", refTable: "ref_currencies", refColumn: "code", refLabel: "Currency" },
        { key: "market_value", kind: "number", required: true, min: 0 },
        { key: "haircut", kind: "number", min: 0, max: 1, default: 0 },
        { key: "encumbered", kind: "boolean", default: false },
        { key: "notes", kind: "string" },
      ],
    },
    {
      key: "Cash Flow",
      label: "التدفقات النقدية",
      table: "liq_cashflows",
      columns: [
        { key: "description", kind: "string", required: true },
        { key: "direction", kind: "enum", required: true, enumValues: LIQ_DIRECTIONS },
        { key: "bucket", kind: "enum", required: true, enumValues: LIQ_BUCKETS },
        { key: "category", kind: "string", default: "other" },
        { key: "amount", kind: "number", required: true, min: 0 },
        { key: "currency", kind: "string", default: "USD", refTable: "ref_currencies", refColumn: "code", refLabel: "Currency" },
        { key: "cashflow_date", kind: "date", required: true },
        { key: "stress_factor", kind: "number", min: 0, max: 1, default: 1 },
        { key: "counterparty", kind: "string" },
      ],
    },
    {
      key: "Funding Sources",
      label: "مصادر التمويل",
      table: "liq_funding_sources",
      columns: [
        { key: "name", kind: "string", required: true },
        { key: "source_type", kind: "enum", required: true, enumValues: FUNDING_TYPES },
        { key: "amount", kind: "number", required: true, min: 0 },
        { key: "currency", kind: "string", default: "USD", refTable: "ref_currencies", refColumn: "code", refLabel: "Currency" },
        { key: "tenor_days", kind: "integer", min: 0, default: 30 },
        { key: "stable", kind: "boolean", default: false },
        { key: "asf_factor", kind: "number", min: 0, max: 1, default: 0.5 },
        { key: "rsf_factor", kind: "number", min: 0, max: 1, default: 0.5 },
        { key: "counterparty", kind: "string" },
      ],
    },
    { key: "CET1", label: "CET1", table: null, note: "Derived from RWA calculations — no direct import.", columns: [] },
    { key: "AT1", label: "AT1", table: null, note: "Not yet mapped — validated only.", columns: [] },
    { key: "Tier2", label: "Tier 2", table: null, note: "Not yet mapped — validated only.", columns: [] },
    { key: "Capital Buffer", label: "الاحتياطي الرأسمالي", table: null, note: "Not yet mapped — validated only.", columns: [] },
    { key: "Capital Planning", label: "التخطيط الرأسمالي", table: null, note: "Not yet mapped — validated only.", columns: [] },
    { key: "LCR", label: "LCR", table: null, note: "Derived from HQLA + Cash Flow.", columns: [] },
    { key: "NSFR", label: "NSFR", table: null, note: "Derived from Funding Sources.", columns: [] },
    { key: "Leverage Ratio", label: "نسبة الرافعة", table: null, note: "Derived automatically.", columns: [] },
  ],
};

// ---------- Package 4: Risk Data ----------
const riskData: PackageSpec = {
  key: "risk",
  label: "بيانات المخاطر",
  description: "RWA assets, market positions, KRIs, RCSA, loss events — imported into existing risk tables.",
  sheets: [
    {
      key: "RWA",
      label: "الأصول المرجّحة",
      table: "rwa_assets",
      naturalKey: "reference_code",
      columns: [
        { key: "reference_code", kind: "string", required: true },
        { key: "name", kind: "string", required: true },
        { key: "category", kind: "enum", required: true, enumValues: RWA_CATEGORY },
        { key: "asset_class", kind: "string", required: true },
        { key: "counterparty_type", kind: "string" },
        { key: "rating", kind: "string" },
        { key: "exposure_amount", kind: "number", required: true, min: 0 },
        { key: "risk_weight", kind: "number", required: true, min: 0, max: 12.5 },
        { key: "currency", kind: "string", default: "USD", refTable: "ref_currencies", refColumn: "code", refLabel: "Currency" },
        { key: "status", kind: "enum", enumValues: APPROVAL_STATUS, default: "draft" },
        { key: "notes", kind: "string" },
      ],
    },
    {
      key: "Market Risk",
      label: "مخاطر السوق",
      table: "market_positions",
      naturalKey: "position_code",
      columns: [
        { key: "position_code", kind: "string", required: true },
        { key: "name", kind: "string", required: true },
        { key: "asset_class", kind: "enum", required: true, enumValues: MARKET_ASSET_CLASS },
        { key: "portfolio", kind: "string", default: "trading" },
        { key: "currency", kind: "string", default: "USD", refTable: "ref_currencies", refColumn: "code", refLabel: "Currency" },
        { key: "quantity", kind: "number", required: true },
        { key: "price", kind: "number", required: true, min: 0 },
        { key: "duration", kind: "number", default: 0 },
        { key: "convexity", kind: "number", default: 0 },
        { key: "coupon_rate", kind: "number", min: 0, max: 1, default: 0 },
        { key: "maturity_date", kind: "date" },
        { key: "beta", kind: "number", default: 1 },
        { key: "volatility", kind: "number", min: 0, default: 0.1 },
        { key: "notes", kind: "string" },
      ],
    },
    {
      key: "Operational Risk",
      label: "المخاطر التشغيلية",
      table: "op_risk_register",
      naturalKey: "risk_code",
      columns: [
        { key: "risk_code", kind: "string", required: true },
        { key: "title", kind: "string", required: true },
        { key: "description", kind: "string" },
        { key: "category", kind: "string", default: "Operational" },
        { key: "likelihood", kind: "integer", min: 1, max: 5, default: 3 },
        { key: "impact", kind: "integer", min: 1, max: 5, default: 3 },
        { key: "mitigation", kind: "string" },
        { key: "residual_likelihood", kind: "integer", min: 1, max: 5, default: 2 },
        { key: "residual_impact", kind: "integer", min: 1, max: 5, default: 2 },
        { key: "status", kind: "enum", enumValues: RISK_STATUS, default: "open" },
        { key: "owner", kind: "string" },
        { key: "review_date", kind: "date" },
      ],
    },
    {
      key: "Loss Events",
      label: "أحداث الخسارة",
      table: "op_incidents",
      naturalKey: "ref_code",
      columns: [
        { key: "ref_code", kind: "string", required: true },
        { key: "title", kind: "string", required: true },
        { key: "category", kind: "enum", enumValues: OP_CATEGORY, default: "incident" },
        { key: "severity", kind: "enum", enumValues: OP_SEVERITY, default: "medium" },
        { key: "status", kind: "enum", enumValues: OP_STATUS, default: "open" },
        { key: "business_line", kind: "string" },
        { key: "event_type", kind: "string" },
        { key: "root_cause", kind: "string" },
        { key: "description", kind: "string" },
        { key: "gross_loss", kind: "number", min: 0, default: 0 },
        { key: "recovery", kind: "number", min: 0, default: 0 },
        { key: "currency", kind: "string", default: "USD", refTable: "ref_currencies", refColumn: "code", refLabel: "Currency" },
        { key: "occurred_at", kind: "date" },
        { key: "discovered_at", kind: "date" },
        { key: "owner_email", kind: "string" },
      ],
    },
    {
      key: "KRIs",
      label: "مؤشرات المخاطر الرئيسية",
      table: "op_kris",
      naturalKey: "code",
      columns: [
        { key: "code", kind: "string", required: true },
        { key: "name", kind: "string", required: true },
        { key: "category", kind: "string", default: "operational" },
        { key: "unit", kind: "string", default: "count" },
        { key: "frequency", kind: "string", default: "monthly" },
        { key: "owner", kind: "string" },
        { key: "current_value", kind: "number", default: 0 },
        { key: "threshold_amber", kind: "number", required: true },
        { key: "threshold_red", kind: "number", required: true },
        { key: "higher_is_worse", kind: "boolean", default: true },
        { key: "status", kind: "enum", enumValues: KRI_STATUS, default: "green" },
        { key: "notes", kind: "string" },
      ],
    },
    {
      key: "RCSA",
      label: "التقييم الذاتي للمخاطر",
      table: "op_rcsa",
      columns: [
        { key: "process_name", kind: "string", required: true },
        { key: "risk_description", kind: "string", required: true },
        { key: "inherent_likelihood", kind: "integer", min: 1, max: 5, default: 3 },
        { key: "inherent_impact", kind: "integer", min: 1, max: 5, default: 3 },
        { key: "control_description", kind: "string" },
        { key: "control_effectiveness", kind: "integer", min: 1, max: 5, default: 3 },
        { key: "residual_likelihood", kind: "integer", min: 1, max: 5, default: 3 },
        { key: "residual_impact", kind: "integer", min: 1, max: 5, default: 3 },
        { key: "owner", kind: "string" },
        { key: "last_reviewed", kind: "date" },
      ],
    },
    { key: "Credit Risk", label: "مخاطر الائتمان", table: null, note: "Import via Package 2 → Loans.", columns: [] },
    { key: "Stress Testing", label: "اختبارات الضغط", table: null, note: "Configured in Stress Testing module.", columns: [] },
    { key: "Scenario Analysis", label: "تحليل السيناريوهات", table: null, note: "Configured in Stress Testing module.", columns: [] },
  ],
};

export const PACKAGES: PackageSpec[] = [creditData, capitalLiquidity, riskData];

export function findPackage(key: string): PackageSpec | undefined {
  return PACKAGES.find((p) => p.key === key);
}

export function findSheetSpec(pkg: PackageSpec, sheetName: string): SheetSpec | undefined {
  const target = sheetName.trim().toLowerCase();
  return pkg.sheets.find((s) => s.key.toLowerCase() === target);
}
