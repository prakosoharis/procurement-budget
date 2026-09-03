import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { MONTHS, type Row } from "../lib/dashboard";
import type { budgetRows } from "./schema";

type DbBudgetRow = InferSelectModel<typeof budgetRows>;
export type DbBudgetRowInsert = InferInsertModel<typeof budgetRows>;

/** DB row (snake_case/camelCase columns) -> frontend Row (exact original Excel-style keys).
 *  Accepts either a selected row or the pre-insert shape (both share every
 *  field this function reads; only `id`, which we never touch, differs). */
export function dbToRow(db: DbBudgetRow | DbBudgetRowInsert): Row {
  const out: Record<string, unknown> = {
    Year: db.year,
    "Act/Budget": db.actBudget,
    Entity: db.entity,
    "Entity Group": db.entityGroup,
    "Capex / Opex": db.capexOpex,
    "Fund Center Group": db.fundCenterGroup,
    "Fund Center Name": db.fundCenterName,
    Currency: db.currency,
    "Simplified Text": db.simplifiedText,
  };
  for (const m of MONTHS) {
    const lower = m.toLowerCase() as keyof DbBudgetRow;
    out[m] = db[lower];
    out[`YTD ${m}`] = db[`ytd${m}` as keyof DbBudgetRow];
  }
  return out as unknown as Row;
}

/** Frontend Row -> DB insert shape. */
export function rowToDbInsert(r: Row): DbBudgetRowInsert {
  const out: Record<string, unknown> = {
    year: Number(r.Year) || 0,
    actBudget: r["Act/Budget"],
    entity: r.Entity,
    entityGroup: r["Entity Group"],
    capexOpex: r["Capex / Opex"],
    fundCenterGroup: r["Fund Center Group"],
    fundCenterName: r["Fund Center Name"],
    currency: r.Currency,
    simplifiedText: r["Simplified Text"] ?? "",
  };
  for (const m of MONTHS) {
    const lower = m.toLowerCase();
    out[lower] = Number((r as unknown as Record<string, unknown>)[m]) || 0;
    out[`ytd${m}`] = Number((r as unknown as Record<string, unknown>)[`YTD ${m}`]) || 0;
  }
  return out as DbBudgetRowInsert;
}
