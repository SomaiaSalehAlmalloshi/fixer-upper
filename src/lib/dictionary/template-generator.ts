/**
 * Rich Excel template generator.
 *
 * Uses ExcelJS so every data sheet is emitted as a real Excel **Table**
 * (ListObject) — not a plain range — with:
 *   - Named table with styled header (blue theme)
 *   - Filter buttons on every column
 *   - Column drop-down data validation for enum columns
 *   - Numeric range validation for number/integer columns
 *   - Date validation for date columns
 *   - Cell comments on headers containing the description + rules
 *   - Frozen header row, autosized columns, tab colours
 *   - Sheet protection (headers locked, data area editable)
 *
 * A separate `_Instructions` sheet lists every worksheet with version,
 * status, target DB table, natural key and required columns. A separate
 * `_Enums` sheet lists every allowed enum value.
 *
 * The generated file is fully compatible with the existing import
 * engine in `@/lib/imports/engine` (which reads by header name).
 */
import ExcelJS from "exceljs";
import type {
  DictionaryPackage,
  DictionarySheet,
  DictionaryColumn,
} from "./index";
import { DICTIONARY_VERSION } from "./version";

const TABLE_STYLE = "TableStyleMedium2";
const HEADER_FILL = "FF1F4E78";
const HEADER_FONT_COLOR = "FFFFFFFF";
const TAB_COLOR_PERSISTED = "FF1F6FEB";
const TAB_COLOR_VALIDATED = "FF888888";

function renderRules(c: DictionaryColumn): string {
  return c.validationRules.join(" · ");
}

function safeName(raw: string): string {
  // Excel table/sheet names: alphanumeric + underscore, must start with letter
  const cleaned = raw.replace(/[^A-Za-z0-9]/g, "_").replace(/^(\d)/, "_$1");
  return cleaned.slice(0, 40) || "Table";
}

function coerceExample(c: DictionaryColumn): unknown {
  const v = c.exampleValue;
  if (v === undefined || v === null || v === "") {
    switch (c.dataType) {
      case "number":
      case "integer":
        return 0;
      case "boolean":
        return false;
      case "date":
        return new Date().toISOString().slice(0, 10);
      default:
        return "";
    }
  }
  return v;
}

function addDataSheet(
  wb: ExcelJS.Workbook,
  pkg: DictionaryPackage,
  sheet: DictionarySheet,
): void {
  const sheetName = sheet.key.slice(0, 31);
  const ws = wb.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
    properties: { tabColor: { argb: sheet.persisted ? TAB_COLOR_PERSISTED : TAB_COLOR_VALIDATED } },
  });

  // Sheets with no defined columns get a stub message
  if (sheet.columns.length === 0) {
    ws.addRow(["Not yet mapped"]);
    ws.getCell("A1").font = { bold: true };
    ws.addRow([sheet.note ?? "This worksheet is validated for structure only."]);
    ws.getColumn(1).width = 80;
    return;
  }

  const columns = sheet.columns;
  const headers = columns.map((c) => c.key); // canonical keys — engine matches on these

  // Build the table
  const tableName = safeName(`tbl_${pkg.key}_${sheet.key}`);
  ws.addTable({
    name: tableName,
    ref: "A1",
    headerRow: true,
    totalsRow: false,
    style: {
      theme: TABLE_STYLE,
      showRowStripes: true,
      showFirstColumn: false,
    },
    columns: columns.map((c) => ({
      name: c.key,
      filterButton: true,
    })),
    rows: [columns.map(coerceExample) as unknown[]],
  });

  // Style header row explicitly (overrides table style for consistency)
  const headerRow = ws.getRow(1);
  headerRow.height = 22;
  columns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.key;
    cell.font = { bold: true, color: { argb: HEADER_FONT_COLOR }, size: 11 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: HEADER_FILL },
    };
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    cell.border = {
      bottom: { style: "medium", color: { argb: "FF0F3B66" } },
    };
    // Comment: display name + description + rules
    const commentText = [
      c.displayName,
      c.description ? `\n${c.description}` : "",
      `\n\n${renderRules(c)}`,
    ].join("");
    cell.note = {
      texts: [{ text: commentText }],
      margins: { insetmode: "auto" },
    };
    // Lock header cell (with sheet protection enabled below)
    cell.protection = { locked: true };
  });

  // Column widths, per-column data validation, unlock data cells
  columns.forEach((c, i) => {
    const excelCol = ws.getColumn(i + 1);
    excelCol.width = Math.min(
      Math.max(
        c.displayName.length + 2,
        c.key.length + 2,
        14,
      ),
      42,
    );
    // Data validation for rows 2..1048576
    const range = `${excelCol.letter}2:${excelCol.letter}1048576`;
    if (c.allowedValues && c.allowedValues.length) {
      const formula = `"${c.allowedValues.join(",")}"`;
      const dv: ExcelJS.DataValidation = {
        type: "list",
        allowBlank: !c.required,
        formulae: [formula],
        showErrorMessage: true,
        errorTitle: "Invalid value",
        error: `Allowed: ${c.allowedValues.join(", ")}`,
      };
      // Apply per-cell (ExcelJS applies via dataValidations map)
      for (let r = 2; r <= 1000; r++) {
        ws.getCell(`${excelCol.letter}${r}`).dataValidation = dv;
      }
    } else if (c.dataType === "number" || c.dataType === "integer") {
      const min = typeof c.minValue === "number" ? c.minValue : -1e15;
      const max = typeof c.maxValue === "number" ? c.maxValue : 1e15;
      const dv: ExcelJS.DataValidation = {
        type: c.dataType === "integer" ? "whole" : "decimal",
        operator: "between",
        allowBlank: !c.required,
        formulae: [String(min), String(max)],
        showErrorMessage: true,
        errorTitle: "Invalid number",
        error: `Must be a ${c.dataType} between ${min} and ${max}`,
      };
      for (let r = 2; r <= 1000; r++) {
        ws.getCell(`${excelCol.letter}${r}`).dataValidation = dv;
      }
    } else if (c.dataType === "date") {
      const dv: ExcelJS.DataValidation = {
        type: "date",
        operator: "greaterThan",
        allowBlank: !c.required,
        formulae: [new Date(1900, 0, 1)],
        showErrorMessage: true,
        errorTitle: "Invalid date",
        error: "Use YYYY-MM-DD",
      };
      for (let r = 2; r <= 1000; r++) {
        ws.getCell(`${excelCol.letter}${r}`).dataValidation = dv;
      }
    }
    // Unlock data cells (headers stay locked via protection above)
    for (let r = 2; r <= 1000; r++) {
      ws.getCell(`${excelCol.letter}${r}`).protection = { locked: false };
    }
  });

  // Enable sheet protection — headers locked, table area editable
  void ws.protect("", {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: true,
    formatColumns: true,
    formatRows: true,
    insertRows: true,
    insertColumns: false,
    deleteRows: true,
    deleteColumns: false,
    sort: true,
    autoFilter: true,
    pivotTables: false,
  });
}

function addInstructionsSheet(wb: ExcelJS.Workbook, pkg: DictionaryPackage): void {
  const ws = wb.addWorksheet("_Instructions", {
    properties: { tabColor: { argb: "FFCCCCCC" } },
    views: [{ state: "frozen", ySplit: 8 }],
  });

  ws.mergeCells("A1:G1");
  const title = ws.getCell("A1");
  title.value = `Basel III Compliance — ${pkg.label}`;
  title.font = { bold: true, size: 14 };

  ws.getCell("A2").value = "Package";
  ws.getCell("B2").value = `${pkg.label} (${pkg.key})`;
  ws.getCell("A3").value = "Description";
  ws.getCell("B3").value = pkg.description;
  ws.getCell("A4").value = "Package version";
  ws.getCell("B4").value = pkg.version.version;
  ws.getCell("C4").value = `Status: ${pkg.version.status}`;
  ws.getCell("A5").value = "Dictionary version";
  ws.getCell("B5").value = DICTIONARY_VERSION;
  ws.getCell("A6").value = "Created / Modified";
  ws.getCell("B6").value = `${pkg.version.createdAt} · ${pkg.version.modifiedAt}`;
  ws.getCell("A7").value = "Compatibility";
  ws.getCell("B7").value = pkg.version.compatibility;

  for (let r = 2; r <= 7; r++) {
    ws.getCell(`A${r}`).font = { bold: true };
  }

  // Sheet list as a real table
  const tableStart = 9;
  ws.getRow(tableStart - 1).getCell(1).value = "";
  ws.addTable({
    name: safeName(`tbl_${pkg.key}_instructions`),
    ref: `A${tableStart}`,
    headerRow: true,
    style: { theme: TABLE_STYLE, showRowStripes: true },
    columns: [
      { name: "Sheet", filterButton: true },
      { name: "Label", filterButton: true },
      { name: "Persisted?", filterButton: true },
      { name: "Target table", filterButton: true },
      { name: "Natural key", filterButton: true },
      { name: "Required columns", filterButton: true },
      { name: "Notes", filterButton: true },
    ],
    rows: pkg.sheets.map((s) => [
      s.key,
      s.label,
      s.persisted ? "Yes" : "No (validated only)",
      s.table ?? "—",
      s.naturalKey ?? "",
      s.columns.filter((c) => c.required).map((c) => c.key).join(", "),
      s.note ?? "",
    ]),
  });

  [22, 28, 18, 22, 18, 40, 40].forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  // How-to block
  const howtoStart = tableStart + pkg.sheets.length + 3;
  ws.getCell(`A${howtoStart}`).value = "How to use";
  ws.getCell(`A${howtoStart}`).font = { bold: true };
  const notes = [
    "1. Each worksheet is a real Excel Table — click any cell to see the Table Design tab.",
    "2. Row 1 is the locked header (canonical column keys the import engine matches on).",
    "3. Enter your data starting at row 2. Drop-downs and validation rules are pre-applied.",
    "4. Hover over any header cell to see the display name, description and rules.",
    "5. Upload the file in Data Import Center to validate and import.",
  ];
  notes.forEach((n, i) => {
    ws.getCell(`A${howtoStart + 1 + i}`).value = n;
  });
}

function addEnumsSheet(wb: ExcelJS.Workbook, pkg: DictionaryPackage): void {
  const rows: Array<[string, string, string]> = [];
  for (const s of pkg.sheets) {
    for (const c of s.columns) {
      if (c.allowedValues) {
        for (const v of c.allowedValues) rows.push([s.key, c.key, v]);
      }
    }
  }
  if (rows.length === 0) return;
  const ws = wb.addWorksheet("_Enums", {
    properties: { tabColor: { argb: "FFCCCCCC" } },
    views: [{ state: "frozen", ySplit: 1 }],
  });
  ws.addTable({
    name: safeName(`tbl_${pkg.key}_enums`),
    ref: "A1",
    headerRow: true,
    style: { theme: TABLE_STYLE, showRowStripes: true },
    columns: [
      { name: "Sheet", filterButton: true },
      { name: "Column", filterButton: true },
      { name: "Allowed value", filterButton: true },
    ],
    rows,
  });
  ws.getColumn(1).width = 22;
  ws.getColumn(2).width = 22;
  ws.getColumn(3).width = 30;
}

async function buildWorkbookBlob(wb: ExcelJS.Workbook): Promise<Blob> {
  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/**
 * Build a rich Excel template for one package. Every data worksheet is
 * a real Excel Table (ListObject).
 *
 * Returns a Promise<Blob> — callers must `await` before triggering the
 * download.
 */
export async function buildRichTemplate(pkg: DictionaryPackage): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Basel III Compliance — Data Dictionary";
  wb.created = new Date();
  wb.modified = new Date();

  addInstructionsSheet(wb, pkg);
  for (const sheet of pkg.sheets) addDataSheet(wb, pkg, sheet);
  addEnumsSheet(wb, pkg);

  return buildWorkbookBlob(wb);
}

/**
 * Export the entire dictionary (all columns of every sheet of every
 * package) as a single reference workbook — one row per column, emitted
 * as a real Excel Table.
 */
export async function buildDictionaryReference(
  packages: DictionaryPackage[],
): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Basel III Compliance — Data Dictionary";
  wb.created = new Date();

  const ws = wb.addWorksheet("Data Dictionary", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  const rows: unknown[][] = [];
  for (const pkg of packages) {
    for (const s of pkg.sheets) {
      for (const c of s.columns) {
        rows.push([
          pkg.label,
          pkg.key,
          s.key,
          c.key,
          c.displayName,
          c.description,
          s.table ?? "",
          c.databaseField,
          c.dataType,
          c.required ? "Yes" : "No",
          c.maxLength ?? "",
          c.minValue ?? "",
          c.maxValue ?? "",
          c.allowedValues?.join(" | ") ?? "",
          c.foreignKey ? `${c.foreignKey.table}.${c.foreignKey.column}` : "",
          c.defaultValue ?? "",
          c.exampleValue ?? "",
          c.validationRules.join(" · "),
          pkg.version.version,
          pkg.version.status,
        ]);
      }
    }
  }

  ws.addTable({
    name: "tbl_data_dictionary",
    ref: "A1",
    headerRow: true,
    style: { theme: TABLE_STYLE, showRowStripes: true },
    columns: [
      "Package",
      "Package Key",
      "Worksheet",
      "Column Key",
      "Display Name",
      "Description",
      "Database Table",
      "Database Field",
      "Data Type",
      "Required",
      "Max Length",
      "Min Value",
      "Max Value",
      "Allowed Values",
      "Foreign Key",
      "Default Value",
      "Example Value",
      "Validation Rules",
      "Package Version",
      "Status",
    ].map((name) => ({ name, filterButton: true })),
    rows,
  });

  const widths = [22, 12, 20, 22, 22, 40, 20, 20, 12, 10, 12, 12, 12, 30, 22, 16, 20, 40, 14, 12];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));

  return buildWorkbookBlob(wb);
}
