import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { loadAssets } from "@/lib/rwa";
import { listLoans, listWarnings, loadPortfolio } from "@/lib/credit";
import { listPositions } from "@/lib/market";
import { listIncidents, listKris } from "@/lib/operational";
import { computeLCR, computeNSFR, listCashFlows, listFundingSources, listHqla } from "@/lib/liquidity";
import { latestChecks, listAudit, listTasks } from "@/lib/compliance";
import { listRuns as listStressRuns } from "@/lib/stress";

// ---------- Types ----------
export type Cadence = Database["public"]["Enums"]["report_cadence"];
export type Format = Database["public"]["Enums"]["report_format"];
export type RunStatus = Database["public"]["Enums"]["report_run_status"];
export type Schedule = Database["public"]["Tables"]["report_schedules"]["Row"];
export type ReportRun = Database["public"]["Tables"]["report_runs"]["Row"];

export type Audience = "capital" | "liquidity" | "risk" | "compliance" | "audit" | "management" | "board" | "central_bank";

export const AUDIENCE_LABEL: Record<Audience, string> = {
  capital: "رأس المال",
  liquidity: "السيولة",
  risk: "المخاطر",
  compliance: "الامتثال",
  audit: "المراجعة",
  management: "الإدارة",
  board: "مجلس الإدارة",
  central_bank: "البنك المركزي",
};

export const CADENCE_LABEL: Record<Cadence, string> = {
  once: "لمرة واحدة", daily: "يومي", weekly: "أسبوعي", monthly: "شهري", quarterly: "ربع سنوي",
};

export const FORMAT_LABEL: Record<Format, string> = {
  pdf: "PDF", excel: "Excel", csv: "CSV", word: "Word",
};

export type ReportSection = {
  title: string;
  summary?: string;
  columns: string[];
  rows: (string | number)[][];
};

export type ReportPayload = {
  key: string;
  name: string;
  audience: Audience;
  generatedAt: string;
  headline: { label: string; value: string }[];
  sections: ReportSection[];
};

export type ReportDefinition = {
  key: string;
  name: string;
  description: string;
  audience: Audience;
  build: () => Promise<ReportPayload>;
};

// ---------- Formatting ----------
const money = (n: number, currency = "USD") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
const pct = (n: number, d = 1) => (isFinite(n) ? (n * 100).toFixed(d) + "%" : "—");
const num = (n: number, d = 0) => n.toLocaleString(undefined, { maximumFractionDigits: d });

// ---------- Report builders (reuse module libs; no duplicate queries) ----------
async function buildCapitalAdequacy(): Promise<ReportPayload> {
  const assets = await loadAssets();
  const approved = assets.filter((a) => a.status === "approved");
  const totalRwa = approved.reduce((s, a) => s + Number(a.rwa_amount), 0);
  const totalExposure = approved.reduce((s, a) => s + Number(a.exposure_amount), 0);
  const byCategory = new Map<string, { exposure: number; rwa: number; count: number }>();
  for (const a of approved) {
    const cur = byCategory.get(a.category) ?? { exposure: 0, rwa: 0, count: 0 };
    cur.exposure += Number(a.exposure_amount);
    cur.rwa += Number(a.rwa_amount);
    cur.count += 1;
    byCategory.set(a.category, cur);
  }
  return {
    key: "capital-adequacy",
    name: "Capital Adequacy Report",
    audience: "capital",
    generatedAt: new Date().toISOString(),
    headline: [
      { label: "Total RWA", value: money(totalRwa) },
      { label: "Total Exposure", value: money(totalExposure) },
      { label: "Approved assets", value: num(approved.length) },
      { label: "Density", value: pct(totalExposure ? totalRwa / totalExposure : 0) },
    ],
    sections: [
      {
        title: "RWA by category",
        columns: ["Category", "Assets", "Exposure", "RWA", "Density"],
        rows: Array.from(byCategory.entries()).map(([k, v]) => [
          k, v.count, money(v.exposure), money(v.rwa), pct(v.exposure ? v.rwa / v.exposure : 0),
        ]),
      },
      {
        title: "Top 15 approved exposures by RWA",
        columns: ["Reference", "Name", "Category", "Asset class", "Exposure", "Weight", "RWA"],
        rows: [...approved].sort((a, b) => Number(b.rwa_amount) - Number(a.rwa_amount)).slice(0, 15).map((a) => [
          a.reference_code, a.name, a.category, a.asset_class,
          money(Number(a.exposure_amount), a.currency),
          pct(Number(a.risk_weight)),
          money(Number(a.rwa_amount), a.currency),
        ]),
      },
    ],
  };
}

async function buildLiquidityReport(): Promise<ReportPayload> {
  const [hqla, cashflows, funding] = await Promise.all([listHqla(), listCashFlows(), listFundingSources()]);
  const lcr = computeLCR(hqla, cashflows);
  const nsfr = computeNSFR(funding);
  return {
    key: "liquidity-position",
    name: "Liquidity Position Report",
    audience: "liquidity",
    generatedAt: new Date().toISOString(),
    headline: [
      { label: "LCR", value: pct(lcr.lcr) },
      { label: "NSFR", value: pct(nsfr.nsfr) },
      { label: "HQLA total", value: money(lcr.hqla.total) },
      { label: "Net 30-day outflow", value: money(lcr.cashflows.net) },
    ],
    sections: [
      {
        title: "HQLA composition",
        columns: ["Tier", "Value"],
        rows: [
          ["Level 1", money(lcr.hqla.level1)],
          ["Level 2A", money(lcr.hqla.level2a)],
          ["Level 2B (capped)", money(lcr.hqla.l2b_capped)],
          ["Total (post caps)", money(lcr.hqla.total)],
        ],
      },
      {
        title: "NSFR components",
        columns: ["Metric", "Value"],
        rows: [
          ["Available stable funding (ASF)", money(nsfr.asf)],
          ["Required stable funding (RSF)", money(nsfr.rsf)],
          ["NSFR", pct(nsfr.nsfr)],
        ],
      },
      {
        title: "Funding sources",
        columns: ["Type", "Institution", "Amount", "ASF factor", "RSF factor"],
        rows: funding.map((f) => [f.source_type, f.name ?? "—", money(Number(f.amount), f.currency), pct(Number(f.asf_factor)), pct(Number(f.rsf_factor))]),
      },
    ],
  };
}

async function buildRiskDashboard(): Promise<ReportPayload> {
  const [loans, positions, incidents, kris, warnings, portfolio] = await Promise.all([
    listLoans(), listPositions(), listIncidents(), listKris(), listWarnings(), loadPortfolio(),
  ]);
  const npl = loans.filter((l) => l.status === "default" || (l.days_past_due ?? 0) >= 90);
  const totalOut = loans.reduce((s, l) => s + Number(l.outstanding), 0);
  const nplRatio = totalOut > 0 ? npl.reduce((s, l) => s + Number(l.outstanding), 0) / totalOut : 0;
  const mv = positions.reduce((s, p) => s + Number(p.market_value), 0);
  const opLoss = incidents.reduce((s, i) => s + Number(i.net_loss ?? 0), 0);
  const redKri = kris.filter((k) => k.status === "red").length;
  return {
    key: "risk-dashboard",
    name: "Enterprise Risk Dashboard",
    audience: "risk",
    generatedAt: new Date().toISOString(),
    headline: [
      { label: "Loans outstanding", value: money(totalOut) },
      { label: "NPL ratio", value: pct(nplRatio) },
      { label: "Trading book MV", value: money(mv) },
      { label: "Op loss YTD", value: money(opLoss) },
    ],
    sections: [
      {
        title: "Portfolio expected loss by borrower",
        columns: ["Borrower", "Industry", "Outstanding", "Expected loss", "EL / Outstanding"],
        rows: portfolio.map((p) => [p.name ?? "—", p.industry ?? "—", money(Number(p.total_outstanding ?? 0)), money(Number(p.total_el ?? 0)), pct(Number(p.total_outstanding ?? 0) ? Number(p.total_el ?? 0) / Number(p.total_outstanding) : 0)]),
      },
      {
        title: "Non-performing loans",
        columns: ["Loan", "Status", "DPD", "Outstanding", "Expected loss"],
        rows: npl.slice(0, 20).map((l) => [l.loan_number, l.status, l.days_past_due ?? 0, money(Number(l.outstanding)), money(Number(l.expected_loss ?? 0))]),
      },
      {
        title: "Operational incidents (recent)",
        columns: ["Reference", "Category", "Severity", "Status", "Net loss"],
        rows: incidents.slice(0, 15).map((i) => [i.ref_code, i.category, i.severity, i.status, money(Number(i.net_loss ?? 0))]),
      },
      {
        title: "KRIs in red",
        columns: ["Code", "Name", "Value", "Amber", "Red"],
        rows: kris.filter((k) => k.status === "red").map((k) => [k.code, k.name, num(Number(k.current_value), 2), num(Number(k.threshold_amber), 2), num(Number(k.threshold_red), 2)]),
      },
      {
        title: "Early warning signals",
        columns: ["Type", "Severity", "Status", "Message"],
        rows: warnings.slice(0, 15).map((w) => [w.signal_type, w.severity, w.status, w.message ?? "—"]),
      },
      {
        title: "Summary",
        columns: ["Metric", "Value"],
        rows: [["Red KRIs", redKri], ["Open warnings", warnings.filter((w) => w.status === "open").length]],
      },
    ],
  };
}

async function buildComplianceStatus(): Promise<ReportPayload> {
  const [checks, tasks] = await Promise.all([latestChecks(), listTasks()]);
  const fail = checks.filter((c) => c.status === "fail").length;
  const warn = checks.filter((c) => c.status === "warn").length;
  const pass = checks.filter((c) => c.status === "pass").length;
  return {
    key: "compliance-status",
    name: "Compliance Status Report",
    audience: "compliance",
    generatedAt: new Date().toISOString(),
    headline: [
      { label: "Rules passing", value: String(pass) },
      { label: "Warnings", value: String(warn) },
      { label: "Violations", value: String(fail) },
      { label: "Open tasks", value: String(tasks.filter((t) => t.status !== "closed" && t.status !== "approved").length) },
    ],
    sections: [
      {
        title: "Latest check per rule",
        columns: ["Code", "Rule", "Framework", "Metric", "Value", "Status", "Severity"],
        rows: checks.map((c) => [c.rule_code, c.rule_name, c.framework, c.metric, num(Number(c.metric_value ?? 0), 4), c.status, c.severity]),
      },
      {
        title: "Open remediation tasks",
        columns: ["Title", "Framework", "Severity", "Priority", "Status", "Due"],
        rows: tasks.filter((t) => t.status !== "closed").map((t) => [t.title, t.framework, t.severity, `P${t.priority}`, t.status, t.due_date ?? "—"]),
      },
    ],
  };
}

async function buildAuditTrail(): Promise<ReportPayload> {
  const entries = await listAudit(undefined, 500);
  return {
    key: "audit-trail",
    name: "Audit Trail Report",
    audience: "audit",
    generatedAt: new Date().toISOString(),
    headline: [{ label: "Entries", value: String(entries.length) }],
    sections: [
      {
        title: "Compliance workflow activity",
        columns: ["When", "Entity", "Action", "Actor", "Details"],
        rows: entries.map((e) => [new Date(e.created_at).toLocaleString(), e.entity_type, e.action, e.actor?.slice(0, 8) ?? "—", JSON.stringify(e.details ?? {}).slice(0, 200)]),
      },
    ],
  };
}

async function buildManagementSummary(): Promise<ReportPayload> {
  const [assets, hqla, flows, funding, loans, incidents, checks, stressRuns] = await Promise.all([
    loadAssets(), listHqla(), listCashFlows(), listFundingSources(), listLoans(), listIncidents(), latestChecks(), listStressRuns(5),
  ]);
  const totalRwa = assets.filter((a) => a.status === "approved").reduce((s, a) => s + Number(a.rwa_amount), 0);
  const lcr = computeLCR(hqla, flows).lcr;
  const nsfr = computeNSFR(funding).nsfr;
  const totalOut = loans.reduce((s, l) => s + Number(l.outstanding), 0);
  const npl = loans.filter((l) => l.status === "default" || (l.days_past_due ?? 0) >= 90).reduce((s, l) => s + Number(l.outstanding), 0);
  const opLoss = incidents.reduce((s, i) => s + Number(i.net_loss ?? 0), 0);
  const violations = checks.filter((c) => c.status === "fail").length;
  return {
    key: "management-summary",
    name: "Management Summary",
    audience: "management",
    generatedAt: new Date().toISOString(),
    headline: [
      { label: "RWA", value: money(totalRwa) },
      { label: "LCR", value: pct(lcr) },
      { label: "NSFR", value: pct(nsfr) },
      { label: "NPL ratio", value: pct(totalOut ? npl / totalOut : 0) },
    ],
    sections: [
      {
        title: "Key indicators",
        columns: ["Metric", "Value"],
        rows: [
          ["Total RWA (approved)", money(totalRwa)],
          ["Loans outstanding", money(totalOut)],
          ["Non-performing loans", money(npl)],
          ["Operational net loss YTD", money(opLoss)],
          ["LCR", pct(lcr)],
          ["NSFR", pct(nsfr)],
          ["Compliance violations", String(violations)],
        ],
      },
      {
        title: "Recent stress test outcomes",
        columns: ["Scenario", "Type", "Severity", "Run at"],
        rows: stressRuns.map((r) => [r.scenario_name, r.stress_type, r.severity, new Date(r.run_at).toLocaleString()]),
      },
    ],
  };
}

async function buildBoardPack(): Promise<ReportPayload> {
  const mgmt = await buildManagementSummary();
  const risk = await buildRiskDashboard();
  const compliance = await buildComplianceStatus();
  return {
    ...mgmt,
    key: "board-pack",
    name: "Board Risk & Capital Pack",
    audience: "board",
    sections: [
      ...mgmt.sections,
      { title: "Risk — expected loss by segment", columns: risk.sections[0].columns, rows: risk.sections[0].rows },
      { title: "Compliance — latest checks", columns: compliance.sections[0].columns, rows: compliance.sections[0].rows },
    ],
  };
}

async function buildCentralBankReturn(): Promise<ReportPayload> {
  const [assets, hqla, flows, funding, loans] = await Promise.all([
    loadAssets(), listHqla(), listCashFlows(), listFundingSources(), listLoans(),
  ]);
  const lcr = computeLCR(hqla, flows);
  const nsfr = computeNSFR(funding);
  const rwa = assets.filter((a) => a.status === "approved").reduce((s, a) => s + Number(a.rwa_amount), 0);
  const npl = loans.filter((l) => l.status === "default" || (l.days_past_due ?? 0) >= 90).reduce((s, l) => s + Number(l.outstanding), 0);
  const totalOut = loans.reduce((s, l) => s + Number(l.outstanding), 0);
  return {
    key: "central-bank-return",
    name: "Central Bank Prudential Return",
    audience: "central_bank",
    generatedAt: new Date().toISOString(),
    headline: [
      { label: "RWA", value: money(rwa) },
      { label: "LCR", value: pct(lcr.lcr) },
      { label: "NSFR", value: pct(nsfr.nsfr) },
      { label: "NPL ratio", value: pct(totalOut ? npl / totalOut : 0) },
    ],
    sections: [
      {
        title: "Return schedule",
        columns: ["Line", "Value"],
        rows: [
          ["Risk Weighted Assets (approved)", money(rwa)],
          ["HQLA post caps", money(lcr.hqla.total)],
          ["Net 30-day outflows", money(lcr.cashflows.net)],
          ["Liquidity Coverage Ratio", pct(lcr.lcr)],
          ["Net Stable Funding Ratio", pct(nsfr.nsfr)],
          ["Gross loans outstanding", money(totalOut)],
          ["Non-performing loans", money(npl)],
        ],
      },
    ],
  };
}

// ---------- Catalog ----------
export const REPORTS: ReportDefinition[] = [
  { key: "capital-adequacy", name: "Capital Adequacy", description: "RWA, exposure and density across categories.", audience: "capital", build: buildCapitalAdequacy },
  { key: "liquidity-position", name: "Liquidity Position", description: "LCR, NSFR and funding composition.", audience: "liquidity", build: buildLiquidityReport },
  { key: "risk-dashboard", name: "Enterprise Risk Dashboard", description: "Credit, market, operational and early-warning view.", audience: "risk", build: buildRiskDashboard },
  { key: "compliance-status", name: "Compliance Status", description: "Latest Basel III checks and open remediation.", audience: "compliance", build: buildComplianceStatus },
  { key: "audit-trail", name: "Audit Trail", description: "Compliance workflow activity for internal audit.", audience: "audit", build: buildAuditTrail },
  { key: "management-summary", name: "Management Summary", description: "Executive KPIs across all risk domains.", audience: "management", build: buildManagementSummary },
  { key: "board-pack", name: "Board Risk & Capital Pack", description: "Board-level pack combining KPIs, risk and compliance.", audience: "board", build: buildBoardPack },
  { key: "central-bank-return", name: "Central Bank Return", description: "Prudential return with regulatory ratios.", audience: "central_bank", build: buildCentralBankReturn },
];

export function getReport(key: string): ReportDefinition | undefined {
  return REPORTS.find((r) => r.key === key);
}

// ---------- Exports ----------
function fileBase(payload: ReportPayload) {
  return payload.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + payload.generatedAt.slice(0, 10);
}
function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export function exportCSV(payload: ReportPayload): string {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines: string[] = [`# ${payload.name}`, `# Generated ${payload.generatedAt}`, ""];
  lines.push("Metric,Value");
  for (const h of payload.headline) lines.push(`${esc(h.label)},${esc(h.value)}`);
  for (const s of payload.sections) {
    lines.push("", `# ${s.title}`);
    lines.push(s.columns.map(esc).join(","));
    for (const r of s.rows) lines.push(r.map(esc).join(","));
  }
  const name = fileBase(payload) + ".csv";
  download(name, new Blob([lines.join("\n")], { type: "text/csv" }));
  return name;
}

export function exportExcel(payload: ReportPayload): string {
  const wb = XLSX.utils.book_new();
  const summary = XLSX.utils.aoa_to_sheet([
    [payload.name],
    [`Generated ${payload.generatedAt}`],
    [],
    ["Metric", "Value"],
    ...payload.headline.map((h) => [h.label, h.value]),
  ]);
  XLSX.utils.book_append_sheet(wb, summary, "Summary");
  for (const s of payload.sections) {
    const ws = XLSX.utils.aoa_to_sheet([s.columns, ...s.rows]);
    XLSX.utils.book_append_sheet(wb, ws, s.title.slice(0, 28));
  }
  const name = fileBase(payload) + ".xlsx";
  XLSX.writeFile(wb, name);
  return name;
}

export function exportPDF(payload: ReportPayload): string {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  doc.setFontSize(18); doc.text(payload.name, 40, 50);
  doc.setFontSize(10); doc.setTextColor(120); doc.text(`Audience: ${AUDIENCE_LABEL[payload.audience]}    Generated: ${new Date(payload.generatedAt).toLocaleString()}`, 40, 68);
  doc.setTextColor(0);
  autoTable(doc, {
    startY: 90,
    head: [["Metric", "Value"]],
    body: payload.headline.map((h) => [h.label, h.value]),
    theme: "grid", headStyles: { fillColor: [30, 41, 59] },
  });
  for (const s of payload.sections) {
    autoTable(doc, {
      head: [s.columns],
      body: s.rows.map((r) => r.map((c) => String(c))),
      startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20,
      theme: "striped", headStyles: { fillColor: [30, 41, 59] },
      styles: { fontSize: 8, cellPadding: 4 },
      didDrawPage: () => {
        doc.setFontSize(11); doc.setTextColor(30, 41, 59);
        doc.text(s.title, 40, (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ? 40 : 40);
      },
    });
  }
  const name = fileBase(payload) + ".pdf";
  doc.save(name);
  return name;
}

/** Word export: emit an HTML .doc file which Word opens natively. */
export function exportWord(payload: ReportPayload): string {
  const esc = (v: unknown) => String(v ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
  const htmlHeadline = payload.headline.map((h) => `<tr><td><b>${esc(h.label)}</b></td><td>${esc(h.value)}</td></tr>`).join("");
  const htmlSections = payload.sections.map((s) => `
    <h2>${esc(s.title)}</h2>
    <table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;width:100%;font-family:Arial;font-size:11px;">
      <thead><tr>${s.columns.map((c) => `<th style="background:#1e293b;color:#fff;text-align:left">${esc(c)}</th>`).join("")}</tr></thead>
      <tbody>${s.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>`).join("");
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
    <head><meta charset="utf-8"><title>${esc(payload.name)}</title></head>
    <body style="font-family:Arial;">
      <h1>${esc(payload.name)}</h1>
      <p><em>Audience: ${AUDIENCE_LABEL[payload.audience]} · Generated ${new Date(payload.generatedAt).toLocaleString()}</em></p>
      <h2>Key indicators</h2>
      <table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;">${htmlHeadline}</table>
      ${htmlSections}
    </body></html>`;
  const name = fileBase(payload) + ".doc";
  download(name, new Blob([html], { type: "application/msword" }));
  return name;
}

export function exportReport(payload: ReportPayload, format: Format): string {
  switch (format) {
    case "csv": return exportCSV(payload);
    case "excel": return exportExcel(payload);
    case "pdf": return exportPDF(payload);
    case "word": return exportWord(payload);
  }
}

// ---------- Scheduling / distribution / history ----------
export async function listSchedules(): Promise<Schedule[]> {
  const { data, error } = await supabase.from("report_schedules").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as Schedule[];
}
export async function upsertSchedule(row: Partial<Schedule>) {
  const { data, error } = await supabase.from("report_schedules").upsert(row as never).select().single();
  if (error) throw error;
  return data as Schedule;
}
export async function deleteSchedule(id: string) {
  const { error } = await supabase.from("report_schedules").delete().eq("id", id);
  if (error) throw error;
}

export async function listRuns(limit = 100): Promise<ReportRun[]> {
  const { data, error } = await supabase.from("report_runs").select("*").order("run_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return data as ReportRun[];
}
export async function logRun(row: Partial<ReportRun>) {
  const { data, error } = await supabase.from("report_runs").insert(row as never).select().single();
  if (error) throw error;
  return data as ReportRun;
}

export function nextRunFromCadence(cadence: Cadence, from = new Date()): Date | null {
  const d = new Date(from);
  switch (cadence) {
    case "once": return null;
    case "daily": d.setDate(d.getDate() + 1); return d;
    case "weekly": d.setDate(d.getDate() + 7); return d;
    case "monthly": d.setMonth(d.getMonth() + 1); return d;
    case "quarterly": d.setMonth(d.getMonth() + 3); return d;
  }
}
