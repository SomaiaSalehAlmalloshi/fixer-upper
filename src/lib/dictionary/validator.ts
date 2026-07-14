/**
 * Dictionary-driven Excel validator.
 *
 * Wraps the EXISTING `@/lib/imports/engine.parseWorkbook` so validation
 * logic is not duplicated. Adds a top-level structural report:
 *   - Missing worksheets       (declared in the dictionary but absent)
 *   - Unknown worksheets       (present in file but not in dictionary)
 *   - Missing required columns (per sheet)
 *   - Duplicate primary keys   (based on sheet.naturalKey)
 *   - Aggregated cell errors   (from the underlying engine)
 */
import { parseWorkbook, type ParsedWorkbook, type SheetParseResult } from "@/lib/imports/engine";
import type { DictionaryPackage } from "./index";
import { findPackage } from "@/lib/imports/registry";

export interface StructuralIssue {
  level: "error" | "warning";
  scope: "workbook" | "worksheet" | "row";
  sheet?: string;
  row?: number;
  column?: string;
  message: string;
}

export interface DictionaryValidationReport {
  packageKey: string;
  fileName: string;
  totalRows: number;
  totalErrors: number;
  ok: boolean;
  parsed: ParsedWorkbook;
  issues: StructuralIssue[];
  perSheet: Array<{
    sheet: string;
    persisted: boolean;
    rowCount: number;
    errorCount: number;
    duplicateKeys: string[];
  }>;
}

function findDuplicateKeys(
  spec: SheetParseResult,
  naturalKey?: string,
): string[] {
  if (!naturalKey) return [];
  const seen = new Map<string, number>();
  const dupes: string[] = [];
  for (const row of spec.rows) {
    const v = row[naturalKey];
    if (v === undefined || v === null || v === "") continue;
    const k = String(v);
    seen.set(k, (seen.get(k) ?? 0) + 1);
    if (seen.get(k) === 2) dupes.push(k);
  }
  return dupes;
}

export async function validateWorkbookAgainstDictionary(
  file: File,
  pkg: DictionaryPackage,
): Promise<DictionaryValidationReport> {
  const rawPkg = findPackage(pkg.key);
  if (!rawPkg) {
    throw new Error(`Unknown package: ${pkg.key}`);
  }
  const parsed = await parseWorkbook(file, rawPkg);
  const issues: StructuralIssue[] = [];

  const parsedSheetNames = new Set(parsed.sheets.map((s) => s.sheetName.toLowerCase()));
  const dictSheetKeys = new Set(pkg.sheets.map((s) => s.key.toLowerCase()));

  // Missing worksheets that are required (persisted OR have required cols)
  for (const s of pkg.sheets) {
    const key = s.key.toLowerCase();
    if (!parsedSheetNames.has(key)) {
      const hasRequired = s.columns.some((c) => c.required);
      if (s.persisted || hasRequired) {
        issues.push({
          level: s.persisted ? "error" : "warning",
          scope: "workbook",
          sheet: s.key,
          message: `Missing worksheet "${s.key}"`,
        });
      }
    }
  }

  // Unknown worksheets present in the file
  for (const s of parsed.sheets) {
    if (!dictSheetKeys.has(s.sheetName.toLowerCase())) {
      issues.push({
        level: "warning",
        scope: "workbook",
        sheet: s.sheetName,
        message: `Worksheet "${s.sheetName}" is not defined in the Data Dictionary — ignored.`,
      });
    }
  }

  const perSheet: DictionaryValidationReport["perSheet"] = [];
  let totalRows = 0;
  let totalErrors = 0;

  for (const s of parsed.sheets) {
    const dictSheet = pkg.sheets.find(
      (d) => d.key.toLowerCase() === s.sheetName.toLowerCase(),
    );

    // Missing required columns
    if (dictSheet) {
      const presentCols = new Set(s.headers.map((h) => h.toLowerCase()));
      for (const c of dictSheet.columns) {
        if (c.required && !presentCols.has(c.key.toLowerCase())) {
          issues.push({
            level: "error",
            scope: "worksheet",
            sheet: s.sheetName,
            column: c.key,
            message: `Missing required column "${c.key}"`,
          });
        }
      }
    }

    // Duplicate primary keys
    const dupes = findDuplicateKeys(s, dictSheet?.naturalKey);
    for (const d of dupes) {
      issues.push({
        level: "error",
        scope: "worksheet",
        sheet: s.sheetName,
        column: dictSheet?.naturalKey,
        message: `Duplicate primary key "${d}" in "${dictSheet?.naturalKey}"`,
      });
    }

    // Aggregate cell errors from the existing engine (no duplicated logic)
    for (const e of s.errors) {
      issues.push({
        level: "error",
        scope: "row",
        sheet: s.sheetName,
        row: e.row,
        column: e.column,
        message: e.message,
      });
    }

    totalRows += s.preparedRows.length;
    totalErrors += s.errors.length;
    perSheet.push({
      sheet: s.sheetName,
      persisted: !!s.spec?.table,
      rowCount: s.preparedRows.length,
      errorCount: s.errors.length,
      duplicateKeys: dupes,
    });
  }

  const structuralErrors = issues.filter((i) => i.level === "error").length;

  return {
    packageKey: pkg.key,
    fileName: parsed.fileName,
    totalRows,
    totalErrors: totalErrors + Math.max(0, structuralErrors - totalErrors),
    ok: structuralErrors === 0,
    parsed,
    issues,
    perSheet,
  };
}
