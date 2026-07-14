/**
 * Central Arabic (MSA) translation dictionary for user-visible UI strings.
 *
 * NOTE: This file only holds display strings. No business logic, no API
 * changes, no identifier renames — components read from this map when
 * they need Arabic labels. English keys are kept as canonical IDs so
 * grep/refactor stay stable.
 */
export const AR = {
  // App
  app_name: "كابيتال كومباس",
  loading: "جاري التحميل…",
  loading_ellipsis: "جاري التحميل…",
  go_home: "الصفحة الرئيسية",
  try_again: "إعادة المحاولة",
  not_found_title: "الصفحة غير موجودة",
  not_found_desc: "الصفحة التي تبحث عنها غير موجودة أو تم نقلها.",
  error_title: "تعذّر تحميل هذه الصفحة",
  error_desc: "حدث خطأ ما. يمكنك إعادة تحميل الصفحة أو العودة إلى الرئيسية.",

  // Auth
  auth_welcome: "مرحبًا بك",
  auth_desc: "سجّل الدخول أو أنشئ حسابًا لإدارة الأصول المرجّحة بالمخاطر.",
  sign_in: "تسجيل الدخول",
  sign_up: "إنشاء حساب",
  signing_in: "جاري تسجيل الدخول…",
  creating: "جاري الإنشاء…",
  create_account: "إنشاء حساب",
  signed_in: "تم تسجيل الدخول",
  signed_out: "تم تسجيل الخروج",
  account_created: "تم إنشاء الحساب. يمكنك تسجيل الدخول الآن.",
  first_admin_note: "الحساب الأول يصبح مسؤولًا.",
  email: "البريد الإلكتروني",
  password: "كلمة المرور",
  display_name: "الاسم الظاهر",
  sign_out: "تسجيل الخروج",

  // Meta
  meta_title: "كابيتال كومباس — إدارة الأصول المرجّحة بالمخاطر",
  meta_description:
    "منصّة متكاملة لإدارة مخاطر الائتمان والسوق والتشغيل والسيولة، مع محرّك أوزان مخاطر آلي وسير عمل للاعتماد والتقارير ولوحات المتابعة.",

  // Sidebar / navigation
  nav_dashboard: "لوحة التحكم",
  nav_credit: "مخاطر الائتمان",
  nav_market: "مخاطر السوق",
  nav_operational: "المخاطر التشغيلية",
  nav_liquidity: "السيولة",
  nav_stress: "اختبارات الضغط",
  nav_compliance: "الامتثال",
  nav_reporting: "مركز التقارير",
  nav_ai: "المستشارون بالذكاء الاصطناعي",
  nav_workflow: "سير العمل",
  nav_rwa_credit: "أصول ائتمان مرجّحة",
  nav_rwa_market: "أصول سوق مرجّحة",
  nav_rwa_operational: "أصول تشغيلية مرجّحة",
  nav_rules: "محرّك أوزان المخاطر",
  nav_approvals: "الاعتمادات",
  nav_history: "السجل",
  nav_reports: "التقارير",
  nav_imports: "استيراد البيانات",
} as const;

export type ArKey = keyof typeof AR;
export const t = (k: ArKey): string => AR[k];
