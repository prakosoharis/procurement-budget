import { NextRequest, NextResponse } from "next/server";
import { db, budgetRows } from "@/db";
import { dbToRow, rowToDbInsert } from "@/db/mappers";
import { getSessionFromRequest } from "@/lib/auth";
import type { Row } from "@/lib/dashboard";

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

  await db.transaction(async (tx) => {
    await tx.delete(budgetRows);
    for (let i = 0; i < inserts.length; i += BATCH_SIZE) {
      const batch = inserts.slice(i, i + BATCH_SIZE);
      if (batch.length) await tx.insert(budgetRows).values(batch);
    }
  });

  const saved = await db.select().from(budgetRows);
  return NextResponse.json({ rows: saved.map(dbToRow), count: saved.length });
}
