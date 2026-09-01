import { NextRequest, NextResponse } from "next/server";
import { db, budgetRows } from "@/db";
import { dbToRow } from "@/db/mappers";
import { seedBudgetRows } from "@/db/seed";
import { getSessionFromRequest } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await seedBudgetRows();
  const rows = await db.select().from(budgetRows);
  return NextResponse.json({ rows: rows.map(dbToRow), count: rows.length });
}
