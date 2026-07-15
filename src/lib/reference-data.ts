/**
 * Reference Data (Master Data) configuration.
 *
 * Central registry of all lookup/reference tables managed through the
 * in-app Reference Data module. Each entry describes the table's columns
 * (for the CRUD form + table), its natural key (for duplicate detection),
 * and usage-check rules (which business tables/columns reference this data,
 * so deletion can be blocked when the record is still in use).
 *
 * This replaces the old "Master Data Import" Excel workflow — reference data
 * is now maintained manually via the Reference Data UI.
 */
import type { Database } from "@/integrations/supabase/types";

export type RefTableKey =
  | "currencies"
  | "countries"
  | "regions"
  | "cities"
  | "branches"
  | "departments"
  | "customer_categories"
  | "product_types"
  | "loan_types"
  | "account_types"
  | "asset_classes"
  | "risk_categories"
  | "basel_risk_weights"
  | "rating_grades"
  | "collateral_types"
  | "employment_types"
  | "job_titles";

export type ColumnType = "text" | "number" | "boolean" | "select";

export interface RefColumn {
  key: string;
  label: string;
  type: ColumnType;
  required?: boolean;
  placeholder?: string;
  /** For select columns: list of allowed values. */
  options?: readonly string[];
  /** Min/max for number columns. */
  min?: number;
  max?: number;
  step?: number;
  /** Hide from the table grid (still shown in form). */
  hideInTable?: boolean;
  /** Width hint for the table column (px). */
  width?: number;
}

export interface UsageCheck {
  /** Business table that may reference this reference record. */
  table: keyof Database["public"]["Tables"];
  /** Column on that business table holding the natural key (e.g. "currency"). */
  column: string;
  /** Human-readable label for the referencing entity, shown in the block message. */
  label: string;
}

export interface RefTableSpec {
  key: RefTableKey;
  /** Actual Supabase table name (prefixed with ref_). */
  table: string;
  label: string;
  labelAr: string;
  description: string;
  /** Column serving as the natural key for duplicate detection. */
  naturalKey: string;
  /** Which column holds the display name (for usage messages + search). */
  displayColumn: string;
  columns: RefColumn[];
  /** Usage checks: if any returns rows, deletion is blocked. */
  usageChecks?: UsageCheck[];
}

const RWA_CATEGORIES = ["credit", "market", "operational"] as const;
const OUTLOOKS = ["stable", "positive", "negative", "watch"] as const;

export const REF_TABLES: RefTableSpec[] = [
  {
    key: "currencies",
    table: "ref_currencies",
    label: "Currencies",
    labelAr: "العملات",
    description: "ISO 4217 currency codes used across loans, collateral, and market positions.",
    naturalKey: "code",
    displayColumn: "name",
    columns: [
      { key: "code", label: "Code", type: "text", required: true, placeholder: "USD", width: 100 },
      { key: "name", label: "Name", type: "text", required: true, placeholder: "US Dollar", width: 200 },
      { key: "symbol", label: "Symbol", type: "text", placeholder: "$", width: 90 },
      { key: "decimals", label: "Decimals", type: "number", required: true, min: 0, max: 4, width: 90 },
      { key: "active", label: "Active", type: "boolean", width: 80 },
      { key: "notes", label: "Notes", type: "text", hideInTable: true },
    ],
    usageChecks: [
      { table: "credit_loans", column: "currency", label: "Loans" },
      { table: "credit_collateral", column: "currency", label: "Collateral" },
      { table: "rwa_assets", column: "currency", label: "RWA Assets" },
      { table: "market_positions", column: "currency", label: "Market Positions" },
      { table: "liq_hqla", column: "currency", label: "HQLA" },
      { table: "liq_cashflows", column: "currency", label: "Cash Flows" },
      { table: "liq_funding_sources", column: "currency", label: "Funding Sources" },
      { table: "op_incidents", column: "currency", label: "Operational Incidents" },
    ],
  },
  {
    key: "countries",
    table: "ref_countries",
    label: "Countries",
    labelAr: "الدول",
    description: "ISO 3166-1 country codes used for borrowers, branches, and counterparties.",
    naturalKey: "code",
    displayColumn: "name",
    columns: [
      { key: "code", label: "ISO Code", type: "text", required: true, placeholder: "US", width: 100 },
      { key: "code3", label: "ISO-3 Code", type: "text", placeholder: "USA", width: 100 },
      { key: "name", label: "Name", type: "text", required: true, placeholder: "United States", width: 200 },
      { key: "dial_code", label: "Dial Code", type: "text", placeholder: "+1", width: 90 },
      { key: "region", label: "Region", type: "text", placeholder: "North America", width: 140 },
      { key: "active", label: "Active", type: "boolean", width: 80 },
      { key: "notes", label: "Notes", type: "text", hideInTable: true },
    ],
    usageChecks: [
      { table: "credit_borrowers", column: "country", label: "Borrowers" },
      { table: "ref_branches", column: "country", label: "Branches" },
    ],
  },
  {
    key: "regions",
    table: "ref_regions",
    label: "Regions",
    labelAr: "المناطق",
    description: "Sub-country regions, states, or governorates.",
    naturalKey: "code",
    displayColumn: "name",
    columns: [
      { key: "code", label: "Code", type: "text", required: true, placeholder: "RYD", width: 120 },
      { key: "name", label: "Name", type: "text", required: true, placeholder: "Riyadh Province", width: 220 },
      { key: "active", label: "Active", type: "boolean", width: 80 },
      { key: "notes", label: "Notes", type: "text", hideInTable: true },
    ],
    usageChecks: [
      { table: "ref_branches", column: "region", label: "Branches" },
      { table: "ref_cities", column: "region", label: "Cities" },
    ],
  },
  {
    key: "cities",
    table: "ref_cities",
    label: "Cities",
    labelAr: "المدن",
    description: "Cities linked to countries and regions.",
    naturalKey: "code",
    displayColumn: "name",
    columns: [
      { key: "code", label: "Code", type: "text", required: true, placeholder: "RUH", width: 120 },
      { key: "name", label: "Name", type: "text", required: true, placeholder: "Riyadh", width: 200 },
      { key: "country_code", label: "Country Code", type: "text", required: true, placeholder: "SA", width: 120 },
      { key: "region", label: "Region", type: "text", placeholder: "RYD", width: 120 },
      { key: "active", label: "Active", type: "boolean", width: 80 },
      { key: "notes", label: "Notes", type: "text", hideInTable: true },
    ],
    usageChecks: [{ table: "ref_branches", column: "city", label: "Branches" }],
  },
  {
    key: "branches",
    table: "ref_branches",
    label: "Branches",
    labelAr: "الفروع",
    description: "Bank branches and office locations.",
    naturalKey: "code",
    displayColumn: "name",
    columns: [
      { key: "code", label: "Code", type: "text", required: true, placeholder: "BR001", width: 120 },
      { key: "name", label: "Name", type: "text", required: true, placeholder: "Riyadh Main", width: 200 },
      { key: "country", label: "Country", type: "text", placeholder: "SA", width: 100 },
      { key: "city", label: "City", type: "text", placeholder: "Riyadh", width: 140 },
      { key: "address", label: "Address", type: "text", width: 240 },
      { key: "active", label: "Active", type: "boolean", width: 80 },
      { key: "notes", label: "Notes", type: "text", hideInTable: true },
    ],
  },
  {
    key: "departments",
    table: "ref_departments",
    label: "Departments",
    labelAr: "الإدارات",
    description: "Internal departments and organizational units.",
    naturalKey: "code",
    displayColumn: "name",
    columns: [
      { key: "code", label: "Code", type: "text", required: true, placeholder: "RISK", width: 120 },
      { key: "name", label: "Name", type: "text", required: true, placeholder: "Risk Management", width: 220 },
      { key: "parent_code", label: "Parent Code", type: "text", placeholder: "FIN", width: 120 },
      { key: "active", label: "Active", type: "boolean", width: 80 },
      { key: "notes", label: "Notes", type: "text", hideInTable: true },
    ],
    usageChecks: [{ table: "ref_job_titles", column: "department", label: "Job Titles" }],
  },
  {
    key: "customer_categories",
    table: "ref_customer_categories",
    label: "Customer Categories",
    labelAr: "فئات العملاء",
    description: "Borrower/customer classification categories.",
    naturalKey: "code",
    displayColumn: "label",
    columns: [
      { key: "code", label: "Code", type: "text", required: true, placeholder: "corporate", width: 130 },
      { key: "label", label: "Label", type: "text", required: true, placeholder: "Corporate", width: 200 },
      { key: "description", label: "Description", type: "text", width: 260 },
      { key: "active", label: "Active", type: "boolean", width: 80 },
      { key: "notes", label: "Notes", type: "text", hideInTable: true },
    ],
  },
  {
    key: "product_types",
    table: "ref_product_types",
    label: "Product Types",
    labelAr: "أنواع المنتجات",
    description: "Credit and loan product type taxonomy.",
    naturalKey: "code",
    displayColumn: "label",
    columns: [
      { key: "code", label: "Code", type: "text", required: true, placeholder: "term_loan", width: 140 },
      { key: "label", label: "Label", type: "text", required: true, placeholder: "Term Loan", width: 200 },
      { key: "category", label: "Category", type: "text", placeholder: "credit", width: 120 },
      { key: "description", label: "Description", type: "text", width: 260 },
      { key: "active", label: "Active", type: "boolean", width: 80 },
      { key: "notes", label: "Notes", type: "text", hideInTable: true },
    ],
    usageChecks: [{ table: "credit_loans", column: "product_type", label: "Loans" }],
  },
  {
    key: "loan_types",
    table: "ref_loan_types",
    label: "Loan Types",
    labelAr: "أنواع القروض",
    description: "Loan type taxonomy for classification and reporting.",
    naturalKey: "code",
    displayColumn: "label",
    columns: [
      { key: "code", label: "Code", type: "text", required: true, placeholder: "mortgage", width: 140 },
      { key: "label", label: "Label", type: "text", required: true, placeholder: "Mortgage Loan", width: 200 },
      { key: "category", label: "Category", type: "text", placeholder: "retail", width: 120 },
      { key: "description", label: "Description", type: "text", width: 260 },
      { key: "active", label: "Active", type: "boolean", width: 80 },
      { key: "notes", label: "Notes", type: "text", hideInTable: true },
    ],
  },
  {
    key: "account_types",
    table: "ref_account_types",
    label: "Account Types",
    labelAr: "أنواع الحسابات",
    description: "Depository and account type taxonomy.",
    naturalKey: "code",
    displayColumn: "label",
    columns: [
      { key: "code", label: "Code", type: "text", required: true, placeholder: "checking", width: 130 },
      { key: "label", label: "Label", type: "text", required: true, placeholder: "Checking Account", width: 200 },
      { key: "description", label: "Description", type: "text", width: 260 },
      { key: "active", label: "Active", type: "boolean", width: 80 },
      { key: "notes", label: "Notes", type: "text", hideInTable: true },
    ],
  },
  {
    key: "asset_classes",
    table: "ref_asset_classes",
    label: "Asset Classes",
    labelAr: "فئات الأصول",
    description: "RWA asset class taxonomy across credit, market, and operational risk.",
    naturalKey: "code",
    displayColumn: "label",
    columns: [
      { key: "code", label: "Code", type: "text", required: true, placeholder: "corporate", width: 140 },
      { key: "label", label: "Label", type: "text", required: true, placeholder: "Corporate", width: 180 },
      { key: "category", label: "Category", type: "select", options: RWA_CATEGORIES, required: true, width: 130 },
      { key: "risk_weight", label: "Default Risk Weight", type: "number", min: 0, max: 12.5, step: 0.01, width: 150 },
      { key: "description", label: "Description", type: "text", width: 240 },
      { key: "active", label: "Active", type: "boolean", width: 80 },
      { key: "notes", label: "Notes", type: "text", hideInTable: true },
    ],
    usageChecks: [{ table: "rwa_assets", column: "asset_class", label: "RWA Assets" }],
  },
  {
    key: "risk_categories",
    table: "ref_risk_categories",
    label: "Risk Categories",
    labelAr: "فئات المخاطر",
    description: "High-level risk category taxonomy.",
    naturalKey: "code",
    displayColumn: "label",
    columns: [
      { key: "code", label: "Code", type: "text", required: true, placeholder: "credit_risk", width: 140 },
      { key: "label", label: "Label", type: "text", required: true, placeholder: "Credit Risk", width: 200 },
      { key: "description", label: "Description", type: "text", width: 260 },
      { key: "active", label: "Active", type: "boolean", width: 80 },
      { key: "notes", label: "Notes", type: "text", hideInTable: true },
    ],
  },
  {
    key: "basel_risk_weights",
    table: "ref_basel_risk_weights",
    label: "Basel Risk Weights",
    labelAr: "أوزان المخاطر بازل",
    description: "Basel risk weight lookup table mapped by category, asset class, and rating.",
    naturalKey: "code",
    displayColumn: "code",
    columns: [
      { key: "code", label: "Code", type: "text", required: true, placeholder: "BRW_001", width: 130 },
      { key: "category", label: "Category", type: "select", options: RWA_CATEGORIES, required: true, width: 120 },
      { key: "asset_class", label: "Asset Class", type: "text", required: true, placeholder: "Corporate", width: 150 },
      { key: "counterparty_type", label: "Counterparty Type", type: "text", placeholder: "Corporate", width: 160 },
      { key: "rating", label: "Rating", type: "text", placeholder: "AAA to AA-", width: 120 },
      { key: "risk_weight", label: "Risk Weight", type: "number", required: true, min: 0, max: 12.5, step: 0.01, width: 120 },
      { key: "description", label: "Description", type: "text", width: 220 },
      { key: "active", label: "Active", type: "boolean", width: 80 },
      { key: "notes", label: "Notes", type: "text", hideInTable: true },
    ],
  },
  {
    key: "rating_grades",
    table: "ref_rating_grades",
    label: "Rating Grades",
    labelAr: "درجات التصنيف",
    description: "Internal and external rating grades with PD floors and caps.",
    naturalKey: "code",
    displayColumn: "label",
    columns: [
      { key: "code", label: "Code", type: "text", required: true, placeholder: "AAA", width: 100 },
      { key: "label", label: "Label", type: "text", required: true, placeholder: "AAA - Highest quality", width: 220 },
      { key: "pd_floor", label: "PD Floor", type: "number", min: 0, max: 1, step: 0.0001, width: 110 },
      { key: "pd_cap", label: "PD Cap", type: "number", min: 0, max: 1, step: 0.0001, width: 110 },
      { key: "sort_order", label: "Sort Order", type: "number", min: 0, width: 100 },
      { key: "investment_grade", label: "Investment Grade", type: "boolean", width: 140 },
      { key: "active", label: "Active", type: "boolean", width: 80 },
      { key: "notes", label: "Notes", type: "text", hideInTable: true },
    ],
    usageChecks: [{ table: "credit_borrowers", column: "credit_rating", label: "Borrowers" }],
  },
  {
    key: "collateral_types",
    table: "ref_collateral_types",
    label: "Collateral Types",
    labelAr: "أنواع الضمانات",
    description: "Collateral type taxonomy with standard haircut guidance.",
    naturalKey: "code",
    displayColumn: "label",
    columns: [
      { key: "code", label: "Code", type: "text", required: true, placeholder: "real_estate", width: 140 },
      { key: "label", label: "Label", type: "text", required: true, placeholder: "Real Estate", width: 180 },
      { key: "standard_haircut", label: "Standard Haircut", type: "number", min: 0, max: 1, step: 0.01, width: 150 },
      { key: "description", label: "Description", type: "text", width: 240 },
      { key: "active", label: "Active", type: "boolean", width: 80 },
      { key: "notes", label: "Notes", type: "text", hideInTable: true },
    ],
  },
  {
    key: "employment_types",
    table: "ref_employment_types",
    label: "Employment Types",
    labelAr: "أنواع التوظيف",
    description: "Employment type taxonomy for individual borrowers.",
    naturalKey: "code",
    displayColumn: "label",
    columns: [
      { key: "code", label: "Code", type: "text", required: true, placeholder: "full_time", width: 130 },
      { key: "label", label: "Label", type: "text", required: true, placeholder: "Full-Time", width: 180 },
      { key: "description", label: "Description", type: "text", width: 260 },
      { key: "active", label: "Active", type: "boolean", width: 80 },
      { key: "notes", label: "Notes", type: "text", hideInTable: true },
    ],
  },
  {
    key: "job_titles",
    table: "ref_job_titles",
    label: "Job Titles",
    labelAr: "المسميات الوظيفية",
    description: "Job title taxonomy linked to departments.",
    naturalKey: "code",
    displayColumn: "label",
    columns: [
      { key: "code", label: "Code", type: "text", required: true, placeholder: "RISK_MGR", width: 130 },
      { key: "label", label: "Label", type: "text", required: true, placeholder: "Risk Manager", width: 200 },
      { key: "department", label: "Department", type: "text", placeholder: "RISK", width: 130 },
      { key: "level", label: "Level", type: "text", placeholder: "Manager", width: 120 },
      { key: "active", label: "Active", type: "boolean", width: 80 },
      { key: "notes", label: "Notes", type: "text", hideInTable: true },
    ],
  },
];

export function getRefTable(key: string): RefTableSpec | undefined {
  return REF_TABLES.find((t) => t.key === key);
}
