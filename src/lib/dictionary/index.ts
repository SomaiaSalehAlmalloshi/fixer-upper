/**
 * Centralized Data Dictionary — single source of truth for all Excel
 * import packages.
 *
 * The Data Dictionary is a THIN aggregation layer on top of two existing
 * pieces of the system:
 *   1. `@/lib/imports/registry`  — structural column definitions that
 *      already drive the Excel Import Center. This is the authoritative
 *      link to the DB schema (`table`, `fkTable`, etc.).
 *   2. `./metadata`              — optional display metadata overlay
 *      (Arabic display name, description, example, maxLength) used by
 *      the Excel template generator.
 *
 * We deliberately do NOT duplicate column definitions here. Any change
 * to the Prisma / Supabase schema flows through `registry.ts` and this
 * module picks it up automatically.
 */
import { PACKAGES, findPackage, findSheetSpec } from "@/lib/imports/registry";
import type { PackageSpec, SheetSpec, ColumnSpec, ColKind } from "@/lib/imports/registry";
import { getColumnMeta, type ColumnMeta } from "./metadata";
import { DICTIONARY_VERSION, getPackageVersion, type PackageVersionInfo, type TemplateStatus } from "./version";

export type { PackageSpec, SheetSpec, ColumnSpec, ColKind, PackageVersionInfo, TemplateStatus };
export { DICTIONARY_VERSION, PACKAGES, findPackage, findSheetSpec, getPackageVersion };

/**
 * Fully-resolved dictionary entry for a single column. Combines the
 * structural ColumnSpec with the display metadata overlay and derived
 * defaults so consumers (template generator, docs UI, exporters) can
 * treat every field as always present.
 */
export interface DictionaryColumn {
  key: string;
  displayName: string;
  description: string;
  databaseField: string;
  dataType: ColKind;
  required: boolean;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  allowedValues?: readonly string[];
  foreignKey?: { table: string; column: string };
  validationRules: string[];
  defaultValue?: unknown;
  exampleValue: unknown;
}

export interface DictionarySheet {
  key: string;
  label: string;
  table: string | null;
  persisted: boolean;
  naturalKey?: string;
  note?: string;
  columns: DictionaryColumn[];
}

export interface DictionaryPackage {
  key: string;
  label: string;
  description: string;
  version: PackageVersionInfo;
  sheets: DictionarySheet[];
}

// ---------- resolution helpers ----------

function humaniseKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function defaultExample(col: ColumnSpec): unknown {
  if (col.default !== undefined) return col.default;
  switch (col.kind) {
    case "number":
    case "integer":
      return typeof col.min === "number" ? col.min : 0;
    case "boolean":
      return false;
    case "date":
      return new Date().toISOString().slice(0, 10);
    case "enum":
      return col.enumValues?.[0] ?? "";
    default:
      return "";
  }
}

function buildValidationRules(col: ColumnSpec, meta: ColumnMeta): string[] {
  const out: string[] = [];
  if (col.required) out.push("Required");
  out.push(`Type: ${col.kind}`);
  if (meta.maxLength) out.push(`Max length: ${meta.maxLength}`);
  if (typeof col.min === "number") out.push(`Min: ${col.min}`);
  if (typeof col.max === "number") out.push(`Max: ${col.max}`);
  if (col.enumValues?.length) out.push(`Allowed: ${col.enumValues.join(" | ")}`);
  if (col.fkTable) out.push(`FK → ${col.fkTable}.${col.fkNaturalKey ?? "id"}`);
  if (col.default !== undefined) out.push(`Default: ${String(col.default)}`);
  return out;
}

export function resolveColumn(
  packageKey: string,
  sheetKey: string,
  col: ColumnSpec,
): DictionaryColumn {
  const meta = getColumnMeta(packageKey, sheetKey, col.key);
  return {
    key: col.key,
    displayName: meta.displayName ?? humaniseKey(col.key),
    description: meta.description ?? "",
    databaseField: col.target ?? col.fkTargetColumn ?? col.key,
    dataType: col.kind,
    required: !!col.required,
    maxLength: meta.maxLength,
    minValue: col.min,
    maxValue: col.max,
    allowedValues: col.enumValues,
    foreignKey: col.fkTable
      ? { table: col.fkTable, column: col.fkNaturalKey ?? "id" }
      : undefined,
    validationRules: buildValidationRules(col, meta),
    defaultValue: col.default,
    exampleValue: meta.example ?? defaultExample(col),
  };
}

export function resolveSheet(pkg: PackageSpec, sheet: SheetSpec): DictionarySheet {
  return {
    key: sheet.key,
    label: sheet.label,
    table: sheet.table,
    persisted: !!sheet.table,
    naturalKey: sheet.naturalKey,
    note: sheet.note,
    columns: sheet.columns.map((c) => resolveColumn(pkg.key, sheet.key.toLowerCase(), c)),
  };
}

export function resolvePackage(pkg: PackageSpec): DictionaryPackage {
  return {
    key: pkg.key,
    label: pkg.label,
    description: pkg.description,
    version: getPackageVersion(pkg.key),
    sheets: pkg.sheets.map((s) => resolveSheet(pkg, s)),
  };
}

/** Full resolved Data Dictionary for every package. */
export function getDictionary(): DictionaryPackage[] {
  return PACKAGES.map(resolvePackage);
}

export function getDictionaryPackage(key: string): DictionaryPackage | undefined {
  const p = findPackage(key);
  return p ? resolvePackage(p) : undefined;
}
