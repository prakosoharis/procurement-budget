import * as XLSX from "xlsx";
import type { Row } from "@/lib/dashboard";
import { MONTHS } from "@/lib/dashboard";

const NUM_COLS = [...MONTHS, ...MONTHS.map(m => `YTD ${m}`)];

const REQUIRED_TEXT = ["Year", "Act/Budget", "Entity", "Entity Group", "Capex / Opex", "Fund Center Group", "Fund Center Name", "Currency"] as const;

function normalizeCurrency(v: unknown): "IDR" | "USD" {
  const s = String(v ?? "").toUpperCase().trim();
  return s === "USD" ? "USD" : "IDR";
}

function normalizeActBudget(v: unknown): "Actual" | "Budget" | "Budget After Allocation" {
  const s = String(v ?? "").toLowerCase().trim();
  if (s.startsWith("budget after") || s.includes("allocation")) return "Budget After Allocation";
  return s.startsWith("b") ? "Budget" : "Actual";
}

/** Parse rows from a workbook. Auto-picks "Database" sheet if present, else first sheet.
 *  Auto-detects the header row (handles files where row 1 is a numeric index row
 *  like "1, 2, 3, ..." and the real headers are on row 2 or later). */
export function parseWorkbook(wb: XLSX.WorkBook): Row[] {
  const sheetName = wb.SheetNames.find(n => /database/i.test(n)) || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];

  // Read as array-of-arrays first so we can find the header row dynamically.
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, blankrows: false });
  const REQ = ["Act/Budget", "Entity", "Entity Group", "Capex / Opex", "Year", "Currency"];
  let headerIdx = -1;
  for (let i = 0; i < Math.min(aoa.length, 10); i++) {
    const row = (aoa[i] || []).map(v => String(v ?? "").trim());
    const hits = REQ.filter(r => row.includes(r)).length;
    if (hits >= 4) { headerIdx = i; break; }
  }
  if (headerIdx < 0) headerIdx = 0;

  const headers = (aoa[headerIdx] || []).map(v => (v == null ? "" : String(v).trim()));
  const json = aoa.slice(headerIdx + 1).map((row) => {
    const o: Record<string, unknown> = {};
    headers.forEach((h, i) => { if (h) o[h] = (row as unknown[])[i] ?? 0; });
    return o;
  });

  return json.map((r) => {
    const out: Record<string, unknown> = {};
    for (const k of REQUIRED_TEXT) out[k] = r[k] ?? "";
    out.Year = Number(r.Year) || 0;
    out["Act/Budget"] = normalizeActBudget(r["Act/Budget"]);
    out.Currency = normalizeCurrency(r.Currency);
    // Preserve "Simplified Text" (column G) used for Spending by Category.
    // Accept common header variants too.
    const simplified =
      r["Simplified Text"] ?? r["Simplified text"] ?? r["simplified text"] ??
      r["Item"] ?? r["ITEM"] ?? r["Simplified"] ?? "";
    out["Simplified Text"] = String(simplified ?? "").trim();
    for (const c of NUM_COLS) {
      const v = r[c];
      out[c] = typeof v === "number" ? v : Number(v) || 0;
    }
    return out as unknown as Row;
  }).filter(r => r.Year > 0 && r.Entity);
}

export async function readExcelFile(file: File): Promise<Row[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  return parseWorkbook(wb);
}

export function downloadRowsAsXlsx(rows: Row[], filename = "dashboard-data.xlsx") {
  const ordered = rows.map(r => {
    const o: Record<string, unknown> = {};
    for (const k of REQUIRED_TEXT) o[k] = (r as unknown as Record<string, unknown>)[k];
    o["Simplified Text"] = (r as unknown as Record<string, unknown>)["Simplified Text"] ?? "";
    for (const c of NUM_COLS) o[c] = (r as unknown as Record<string, unknown>)[c];
    return o;
  });
  const ws = XLSX.utils.json_to_sheet(ordered);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Database");
  XLSX.writeFile(wb, filename);
}
