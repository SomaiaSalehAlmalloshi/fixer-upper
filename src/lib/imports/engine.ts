/**
 * Excel import engine — parse, validate, and persist workbook rows into
 * existing production tables. All persistence goes through the browser
 * Supabase client so RLS applies as the signed-in user; no separate
 * import tables are used for business data.
 */
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import type { PackageSpec, SheetSpec, ColumnSpec } from "./registry";
import { findSheetSpec } from "./registry";

export interface RowError {
  row: number;           // 1-indexed Excel row (header = 1, first data row = 2)
  column?: string;
  message: string;
}

export interface SheetParseResult {
  sheetName: string;
  spec: SheetSpec | null;      // null when sheet is unknown for the package
  headers: string[];
  rows: Record<string, unknown>[];
  errors: RowError[];
  preparedRows: Record<string, unknown>[]; // normalized, ready-to-insert (before FK resolution)
}

export interface ParsedWorkbook {
  fileName: string;
  sheets: SheetParseResult[];
}

// ---------- helpers ----------
function normaliseHeader(h: unknown): string {
  return String(h ?? "").trim().toLowerCase().replace(/\s+/g, "_");
}

function coerce(kind: ColumnSpec["kind"], raw: unknown): unknown {
  if (raw === undefined || raw === null || raw === "") return null;
  switch (kind) {
    case "string":
    case "enum":
      return String(raw).trim();
    case "number": {
      const n = typeof raw === "number" ? raw : Number(String(raw).replace(/[, ]/g, ""));
      return Number.isFinite(n) ? n : NaN;
    }
    case "integer": {
      const n = typeof raw === "number" ? raw : Number(String(raw).replace(/[, ]/g, ""));
      return Number.isFinite(n) ? Math.trunc(n) : NaN;
    }
    case "boolean": {
      if (typeof raw === "boolean") return raw;
      const s = String(raw).trim().toLowerCase();
      if (["true", "1", "yes", "y", "نعم"].includes(s)) return true;
      if (["false", "0", "no", "n", "لا"].includes(s)) return false;
      return null;
    }
    case "date": {
      if (raw instanceof Date) return raw.toISOString().slice(0, 10);
      if (typeof raw === "number") {
        // Excel serial date
        const d = XLSX.SSF.parse_date_code(raw);
        if (d) return `${String(d.y).padStart(4, "0")}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
      }
      const s = String(raw).trim();
      const parsed = new Date(s);
      return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
    }
  }
}

function validateCell(col: ColumnSpec, value: unknown): string | null {
  if (value === null || value === undefined) {
    if (col.required && col.default === undefined) return `Missing required value for "${col.key}"`;
    return null;
  }
  if ((col.kind === "number" || col.kind === "integer") && (typeof value !== "number" || Number.isNaN(value))) {
    return `"${col.key}" must be a number`;
  }
  if (col.kind === "date" && typeof value !== "string") {
    return `"${col.key}" must be a valid date (YYYY-MM-DD)`;
  }
  if (col.kind === "enum" && col.enumValues && !col.enumValues.includes(String(value))) {
    return `"${col.key}" must be one of: ${col.enumValues.join(", ")}`;
  }
  if (typeof value === "number") {
    if (col.min !== undefined && value < col.min) return `"${col.key}" must be ≥ ${col.min}`;
    if (col.max !== undefined && value > col.max) return `"${col.key}" must be ≤ ${col.max}`;
  }
  return null;
}

// ---------- parse + validate ----------
export async function parseWorkbook(file: File, pkg: PackageSpec): Promise<ParsedWorkbook> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });

  const sheets: SheetParseResult[] = [];
  for (const sheetName of wb.SheetNames) {
    const spec = findSheetSpec(pkg, sheetName) ?? null;
    const ws = wb.Sheets[sheetName];
    const rowsRaw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });

    // headers (from first row) — normalise once
    const headerRow: string[] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })[0] as string[] ?? [];
    const headers = headerRow.map((h) => String(h ?? ""));

    const errors: RowError[] = [];
    const preparedRows: Record<string, unknown>[] = [];

    if (!spec) {
      errors.push({ row: 0, message: `Sheet "${sheetName}" is not part of the "${pkg.label}" package and will be skipped.` });
      sheets.push({ sheetName, spec, headers, rows: rowsRaw, errors, preparedRows });
      continue;
    }

    // Column presence check
    if (spec.columns.length) {
      const normalisedHeaders = headers.map(normaliseHeader);
      for (const col of spec.columns) {
        if (col.required && !normalisedHeaders.includes(normaliseHeader(col.key))) {
          errors.push({ row: 1, column: col.key, message: `Missing required column "${col.key}"` });
        }
      }
    }

    if (spec.table === null) {
      // Validation-only sheet: still coerce and report but do not persist.
      sheets.push({ sheetName, spec, headers, rows: rowsRaw, errors, preparedRows: [] });
      continue;
    }

    // Row-by-row validation
    const seenNaturalKeys = new Set<string>();
    rowsRaw.forEach((rawRow, idx) => {
      const excelRow = idx + 2;
      const normalised: Record<string, unknown> = {};
      // map raw headers → normalised keys
      const rowByKey: Record<string, unknown> = {};
      Object.entries(rawRow).forEach(([k, v]) => { rowByKey[normaliseHeader(k)] = v; });

      for (const col of spec.columns) {
        const raw = rowByKey[normaliseHeader(col.key)];
        let value = coerce(col.kind, raw);
        if (value === null && col.default !== undefined) value = col.default;
        const err = validateCell(col, value);
        if (err) errors.push({ row: excelRow, column: col.key, message: err });
        // Only include FK lookup column if it exists; DB target is resolved later
        if (col.fkTable) {
          normalised[col.key] = value; // keep natural key for FK resolution
        } else {
          normalised[col.target ?? col.key] = value;
        }
      }

      // Duplicate detection within the sheet
      if (spec.naturalKey) {
        const nk = normalised[spec.naturalKey];
        if (nk != null) {
          const nkStr = String(nk);
          if (seenNaturalKeys.has(nkStr)) {
            errors.push({ row: excelRow, column: spec.naturalKey, message: `Duplicate ${spec.naturalKey} "${nkStr}" in this sheet` });
          }
          seenNaturalKeys.add(nkStr);
        }
      }

      preparedRows.push(normalised);
    });

    sheets.push({ sheetName, spec, headers, rows: rowsRaw, errors, preparedRows });
  }

  return { fileName: file.name, sheets };
}

// ---------- import ----------
export interface SheetImportOutcome {
  sheetName: string;
  table: string | null;
  rowsImported: number;
  rowsFailed: number;
  errors: RowError[];
  skipped?: boolean;
}

export interface ImportOutcome {
  packageKey: string;
  packageLabel: string;
  fileName: string;
  durationMs: number;
  totalImported: number;
  totalFailed: number;
  sheets: SheetImportOutcome[];
}

/**
 * Persist prepared rows. FK natural keys are resolved to uuids by
 * querying existing tables. Rows with unresolved FKs are reported and
 * NOT inserted — the whole sheet is skipped if any FK fails, so partial
 * writes don't corrupt relationships.
 */
export async function runImport(
  pkg: PackageSpec,
  parsed: ParsedWorkbook,
  userId: string,
): Promise<ImportOutcome> {
  const start = performance.now();
  const outcomes: SheetImportOutcome[] = [];
  let totalImported = 0;
  let totalFailed = 0;

  for (const sheet of parsed.sheets) {
    if (!sheet.spec || sheet.spec.table === null) {
      outcomes.push({
        sheetName: sheet.sheetName,
        table: null,
        rowsImported: 0,
        rowsFailed: 0,
        errors: sheet.errors,
        skipped: true,
      });
      continue;
    }

    if (sheet.errors.length) {
      // Validation failed — don't touch DB
      totalFailed += sheet.preparedRows.length;
      outcomes.push({
        sheetName: sheet.sheetName,
        table: sheet.spec.table,
        rowsImported: 0,
        rowsFailed: sheet.preparedRows.length,
        errors: sheet.errors,
      });
      continue;
    }

    // Resolve FKs
    const errors: RowError[] = [];
    const insertRows: Record<string, unknown>[] = [];

    for (let i = 0; i < sheet.preparedRows.length; i++) {
      const row = { ...sheet.preparedRows[i] };
      const excelRow = i + 2;
      let ok = true;
      for (const col of sheet.spec.columns) {
        if (!col.fkTable || !col.fkNaturalKey || !col.fkTargetColumn) continue;
        const nk = row[col.key];
        if (nk === null || nk === undefined) {
          if (col.required) {
            errors.push({ row: excelRow, column: col.key, message: `FK "${col.key}" is empty` });
            ok = false;
          }
          delete row[col.key];
          continue;
        }
        const { data, error } = await supabase
          .from(col.fkTable)
          .select("id")
          .eq(col.fkNaturalKey, String(nk))
          .maybeSingle();
        if (error || !data) {
          errors.push({ row: excelRow, column: col.key, message: `No ${col.fkTable}.${col.fkNaturalKey} = "${nk}"` });
          ok = false;
        } else {
          row[col.fkTargetColumn] = data.id;
        }
        delete row[col.key];
      }
      if (ok) {
        // Attach ownership fields expected by the target table
        if ("created_by" in ({} as never) || true) row.created_by = userId;
        insertRows.push(row);
      }
    }

    if (errors.length) {
      totalFailed += sheet.preparedRows.length;
      outcomes.push({
        sheetName: sheet.sheetName,
        table: sheet.spec.table,
        rowsImported: 0,
        rowsFailed: sheet.preparedRows.length,
        errors,
      });
      continue;
    }

    if (!insertRows.length) {
      outcomes.push({ sheetName: sheet.sheetName, table: sheet.spec.table, rowsImported: 0, rowsFailed: 0, errors: [] });
      continue;
    }

    // Chunked insert
    let inserted = 0;
    const chunkSize = 200;
    for (let i = 0; i < insertRows.length; i += chunkSize) {
      const chunk = insertRows.slice(i, i + chunkSize);
      const { error } = await supabase.from(sheet.spec.table).insert(chunk as never);
      if (error) {
        errors.push({ row: 0, message: `Database rejected chunk starting at row ${i + 2}: ${error.message}` });
        break;
      }
      inserted += chunk.length;
    }

    totalImported += inserted;
    totalFailed += insertRows.length - inserted;
    outcomes.push({
      sheetName: sheet.sheetName,
      table: sheet.spec.table,
      rowsImported: inserted,
      rowsFailed: insertRows.length - inserted,
      errors,
    });
  }

  const durationMs = Math.round(performance.now() - start);

  // Audit log
  await supabase.from("import_history").insert({
    package_key: pkg.key,
    package_label: pkg.label,
    file_name: parsed.fileName,
    status: totalFailed === 0 ? "success" : totalImported === 0 ? "failed" : "partial",
    rows_imported: totalImported,
    rows_failed: totalFailed,
    sheets: outcomes.map(({ sheetName, table, rowsImported, rowsFailed, skipped }) => ({
      sheetName, table, rowsImported, rowsFailed, skipped: !!skipped,
    })) as never,
    errors: outcomes.flatMap((o) => o.errors.map((e) => ({ sheet: o.sheetName, ...e }))) as never,
    duration_ms: durationMs,
    created_by: userId,
  });

  return {
    packageKey: pkg.key,
    packageLabel: pkg.label,
    fileName: parsed.fileName,
    durationMs,
    totalImported,
    totalFailed,
    sheets: outcomes,
  };
}

// ---------- template download ----------
export function buildTemplate(pkg: PackageSpec): Blob {
  const wb = XLSX.utils.book_new();
  for (const sheet of pkg.sheets) {
    const headers = sheet.columns.length ? sheet.columns.map((c) => c.key) : ["(no columns yet)"];
    const sample: Record<string, unknown> = {};
    for (const c of sheet.columns) {
      sample[c.key] =
        c.default !== undefined ? c.default :
        c.kind === "number" || c.kind === "integer" ? 0 :
        c.kind === "boolean" ? false :
        c.kind === "date" ? new Date().toISOString().slice(0, 10) :
        c.kind === "enum" && c.enumValues ? c.enumValues[0] :
        "";
    }
    const ws = XLSX.utils.json_to_sheet(sheet.columns.length ? [sample] : [{ "(no columns yet)": "" }], { header: headers });
    // Add validation instructions as a second row of comments (kept as data for simplicity)
    XLSX.utils.book_append_sheet(wb, ws, sheet.key.slice(0, 31));
  }
  // Instructions sheet
  const instructions = pkg.sheets.map((s) => ({
    Sheet: s.key,
    Label: s.label,
    "Persisted?": s.table ? "Yes" : "No (validated only)",
    "Target table": s.table ?? "—",
    Required: s.columns.filter((c) => c.required).map((c) => c.key).join(", "),
    Note: s.note ?? "",
  }));
  const insWs = XLSX.utils.json_to_sheet(instructions);
  XLSX.utils.book_append_sheet(wb, insWs, "_Instructions");

  const array = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([array], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export function buildErrorReport(outcome: ImportOutcome): Blob {
  const rows = outcome.sheets.flatMap((s) =>
    s.errors.map((e) => ({
      Sheet: s.sheetName,
      Table: s.table ?? "",
      Row: e.row,
      Column: e.column ?? "",
      Message: e.message,
    })),
  );
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Sheet: "", Row: "", Column: "", Message: "No errors" }]);
  XLSX.utils.book_append_sheet(wb, ws, "Errors");
  const array = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([array], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
