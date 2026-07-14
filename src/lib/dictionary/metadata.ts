/**
 * Display-metadata overlay for the Data Dictionary.
 *
 * The authoritative structural definition (column key, kind, required,
 * enum values, FK resolution, defaults) lives in `@/lib/imports/registry`.
 * This file adds ONLY human-facing metadata (Arabic display name,
 * description, example, maxLength) that is not needed by the runtime
 * validator but IS needed by the Excel template generator.
 *
 * Overlay entries are optional. Any column without an overlay entry
 * receives sensible defaults derived from its ColumnSpec so this file
 * never has to duplicate the structural registry.
 */

export interface ColumnMeta {
  displayName?: string;
  description?: string;
  example?: string | number | boolean;
  maxLength?: number;
}

/** key format: `${packageKey}.${sheetKey}.${columnKey}` (all lower-case). */
type OverlayKey = string;

const overlay: Record<OverlayKey, ColumnMeta> = {
  // ---- Master · Currencies ----
  "master.currencies.code":       { displayName: "رمز العملة",    description: "ISO-4217 currency code (e.g. USD, EUR, SAR).", maxLength: 3, example: "USD" },
  "master.currencies.name":       { displayName: "اسم العملة",    description: "Full currency name.", maxLength: 60, example: "US Dollar" },
  "master.currencies.symbol":     { displayName: "الرمز",          description: "Display symbol.", maxLength: 4, example: "$" },

  // ---- Master · Branches ----
  "master.branches.code":         { displayName: "رمز الفرع",      description: "Unique branch code.", maxLength: 16, example: "BR001" },
  "master.branches.name":         { displayName: "اسم الفرع",      description: "Branch display name.", maxLength: 120, example: "Main Branch" },
  "master.branches.country":      { displayName: "الدولة",         description: "ISO country code.", maxLength: 3, example: "SA" },

  // ---- Credit · Customers ----
  "credit.customers.code":            { displayName: "رمز العميل",       description: "Unique borrower code (natural key).", maxLength: 32, example: "C-1001" },
  "credit.customers.name":            { displayName: "اسم العميل",       description: "Borrower legal name.", maxLength: 200, example: "Acme Trading Ltd." },
  "credit.customers.borrower_type":   { displayName: "نوع العميل",       description: "Borrower category. Must match allowed enum values.", example: "corporate" },
  "credit.customers.industry":        { displayName: "القطاع",           description: "Industry / NACE-like sector.", maxLength: 80, example: "Manufacturing" },
  "credit.customers.country":         { displayName: "الدولة",           description: "ISO country code of primary jurisdiction.", maxLength: 3, example: "SA" },
  "credit.customers.credit_rating":   { displayName: "التصنيف الائتماني", description: "External / internal rating grade.", maxLength: 16, example: "BBB" },
  "credit.customers.pd":              { displayName: "احتمال التعثر",     description: "Probability of default (0–1).", example: 0.02 },
  "credit.customers.annual_revenue":  { displayName: "الإيرادات السنوية", description: "Latest annual revenue in reporting currency.", example: 50000000 },

  // ---- Credit · Loans ----
  "credit.loans.loan_number":     { displayName: "رقم القرض",   description: "Unique loan identifier (natural key).", maxLength: 40, example: "LN-2025-0001" },
  "credit.loans.borrower_code":   { displayName: "رمز العميل",  description: "Lookup key into Customers.code — resolved to borrower_id.", maxLength: 32, example: "C-1001" },
  "credit.loans.product_type":    { displayName: "نوع المنتج",  description: "Product family (Term Loan, Overdraft, …).", maxLength: 60, example: "Term Loan" },
  "credit.loans.currency":        { displayName: "العملة",       description: "ISO-4217 currency code.", maxLength: 3, example: "USD" },
  "credit.loans.principal":       { displayName: "الأصل",        description: "Original loan principal amount.", example: 1000000 },
  "credit.loans.outstanding":     { displayName: "الرصيد القائم", description: "Current outstanding principal.", example: 750000 },
  "credit.loans.interest_rate":   { displayName: "معدل الفائدة", description: "Annualized interest rate (0–1 as decimal, e.g. 0.075).", example: 0.075 },
  "credit.loans.disbursement_date": { displayName: "تاريخ الصرف", description: "Loan disbursement date (YYYY-MM-DD).", example: "2025-01-15" },
  "credit.loans.maturity_date":   { displayName: "تاريخ الاستحقاق", description: "Loan maturity date (YYYY-MM-DD).", example: "2030-01-15" },
  "credit.loans.days_past_due":   { displayName: "أيام التأخر",   description: "Days past due at reporting date.", example: 0 },
  "credit.loans.status":          { displayName: "الحالة",       description: "Loan lifecycle status.", example: "active" },

  // ---- Credit · Collateral ----
  "credit.collateral.loan_number":     { displayName: "رقم القرض",     description: "FK to Loans.loan_number.", maxLength: 40, example: "LN-2025-0001" },
  "credit.collateral.collateral_type": { displayName: "نوع الضمان",   description: "Collateral category.", example: "real_estate" },
  "credit.collateral.market_value":    { displayName: "القيمة السوقية", description: "Current fair value in reporting currency.", example: 500000 },
  "credit.collateral.haircut":         { displayName: "الخصم",         description: "Regulatory haircut as decimal (0–1).", example: 0.2 },
  "credit.collateral.valuation_date":  { displayName: "تاريخ التقييم", description: "Most recent valuation date.", example: "2025-06-30" },

  // ---- Capital · HQLA ----
  "capital.hqla.name":         { displayName: "الاسم",           description: "HQLA instrument name.", maxLength: 120, example: "Government Bond 10Y" },
  "capital.hqla.tier":         { displayName: "المستوى",         description: "HQLA tier per Basel III.", example: "level1" },
  "capital.hqla.market_value": { displayName: "القيمة السوقية",  description: "Market value in reporting currency.", example: 10000000 },
  "capital.hqla.haircut":      { displayName: "الخصم",           description: "Regulatory haircut (0–1).", example: 0 },
  "capital.hqla.encumbered":   { displayName: "مرهون؟",          description: "TRUE/FALSE — excluded from HQLA if TRUE.", example: false },

  // ---- Capital · Cash Flow ----
  "capital.cash flow.direction":     { displayName: "الاتجاه",   description: "inflow | outflow.", example: "inflow" },
  "capital.cash flow.bucket":        { displayName: "الفترة",    description: "Time bucket bucket.", example: "1m" },
  "capital.cash flow.amount":        { displayName: "المبلغ",    description: "Cash flow amount.", example: 250000 },
  "capital.cash flow.cashflow_date": { displayName: "التاريخ",   description: "Contractual cash-flow date (YYYY-MM-DD).", example: "2025-08-01" },
  "capital.cash flow.stress_factor": { displayName: "معامل الضغط", description: "Stress run-off / roll-off factor (0–1).", example: 1 },

  // ---- Risk · RWA ----
  "risk.rwa.reference_code":   { displayName: "الرمز المرجعي",  description: "Unique asset code (natural key).", maxLength: 40, example: "RWA-0001" },
  "risk.rwa.name":             { displayName: "الاسم",           description: "Asset display name.", maxLength: 200, example: "Corporate Loan A" },
  "risk.rwa.category":         { displayName: "الفئة",           description: "credit | market | operational.", example: "credit" },
  "risk.rwa.asset_class":      { displayName: "فئة الأصل",       description: "Asset class per Basel III.", maxLength: 60, example: "Corporate" },
  "risk.rwa.exposure_amount":  { displayName: "قيمة التعرض",     description: "Exposure at default.", example: 1000000 },
  "risk.rwa.risk_weight":      { displayName: "وزن المخاطر",     description: "Risk weight (0–12.5).", example: 1 },

  // ---- Risk · Market Risk ----
  "risk.market risk.position_code": { displayName: "رمز المركز",  description: "Unique position code (natural key).", maxLength: 40, example: "POS-0001" },
  "risk.market risk.asset_class":   { displayName: "فئة الأصل",   description: "fx | ir | commodity | equity.", example: "fx" },
  "risk.market risk.quantity":      { displayName: "الكمية",       description: "Position size (units).", example: 1000 },
  "risk.market risk.price":         { displayName: "السعر",        description: "Unit market price.", example: 100 },
  "risk.market risk.volatility":    { displayName: "التذبذب",     description: "Annualized volatility (0–1).", example: 0.15 },

  // ---- Risk · KRIs ----
  "risk.kris.code":            { displayName: "رمز المؤشر",       description: "Unique KRI code.", maxLength: 32, example: "KRI-001" },
  "risk.kris.name":            { displayName: "الاسم",             description: "KRI display name.", maxLength: 200, example: "System Downtime (hours)" },
  "risk.kris.threshold_amber": { displayName: "عتبة تحذير",        description: "Amber threshold.", example: 4 },
  "risk.kris.threshold_red":   { displayName: "عتبة حرجة",         description: "Red threshold.", example: 8 },
  "risk.kris.higher_is_worse": { displayName: "الارتفاع سيء؟",     description: "TRUE if higher values indicate worse performance.", example: true },
};

export function getColumnMeta(
  packageKey: string,
  sheetKey: string,
  columnKey: string,
): ColumnMeta {
  const k = `${packageKey}.${sheetKey}.${columnKey}`.toLowerCase();
  return overlay[k] ?? {};
}
