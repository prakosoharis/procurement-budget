import raw from "../data/database.json";
import { db } from "./index";
import { budgetRows } from "./schema";
import { rowToDbInsert } from "./mappers";
import type { Row } from "../lib/dashboard";

const SEED_ROWS = raw as unknown as Row[];
const BATCH_SIZE = 500;

/** Wipe budget_rows and reload from the bundled seed dataset (database.json). */
export async function seedBudgetRows(): Promise<number> {
  await db.delete(budgetRows);
  const inserts = SEED_ROWS.map(rowToDbInsert);
  for (let i = 0; i < inserts.length; i += BATCH_SIZE) {
    const batch = inserts.slice(i, i + BATCH_SIZE);
    if (batch.length) await db.insert(budgetRows).values(batch);
  }
  return inserts.length;
}
