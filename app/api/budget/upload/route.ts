import { NextRequest, NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { db, budgetRows } from "@/db";
import { dbToRow, rowToDbInsert } from "@/db/mappers";
import { getSessionFromRequest } from "@/lib/auth";
import type { Row } from "@/lib/dashboard";

// Give this route headroom on Vercel — a full upload does a scoped delete +
// several batched inserts + a re-select, which can run past the platform's
// default 10s limit under a cold Neon connection.
export const maxDuration = 60;

const BATCH_SIZE = 500;

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const rows: Row[] = Array.isArray(body?.rows) ? body.rows : [];
  if (!rows.length) {
    return NextResponse.json({ error: "No valid rows found in the request." }, { status: 400 });
  }

  const inserts = rows.map(rowToDbInsert);

  // Replace by year: an uploaded file doesn't always carry every year, and
  // when it does re-include older years it's meant as a fresh full snapshot
  // for those years too. So for each year present in the file, wipe the
  // existing rows for that year and insert the new ones — years absent from
  // the file are left untouched. This avoids both silently losing years
  // that weren't re-uploaded and accumulating duplicate line items for years
  // that were.
  const years = Array.from(new Set(inserts.map((r) => r.year)));

  await db.transaction(async (tx) => {
    if (years.length) await tx.delete(budgetRows).where(inArray(budgetRows.year, years));
    for (let i = 0; i < inserts.length; i += BATCH_SIZE) {
      const batch = inserts.slice(i, i + BATCH_SIZE);
      if (batch.length) await tx.insert(budgetRows).values(batch);
    }
  });

  // Return the full current dataset (untouched years + the years just
  // replaced) so the client's state always reflects what's actually in the
  // database, not just the slice that was just uploaded.
  const all = await db.select().from(budgetRows);
  return NextResponse.json({ rows: all.map(dbToRow), count: all.length });
}
