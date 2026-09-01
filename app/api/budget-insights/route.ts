import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromRequest } from "@/lib/auth";

const BodySchema = z.object({ payload: z.record(z.unknown()) });
const GROQ_MODEL = "openai/gpt-oss-120b";

const SYSTEM_PROMPT =
  "You are an elite corporate financial controller and expert AI Financial Analyst. " +
  "Analyze the compact JSON budget dataset. Field legend: g=category, a=YTD actual, b=annual budget, r=remaining budget, u=utilization percent, pc=product count, p=[product, actual, budget, utilization percent], o=[other product count, other actual, other budget]. " +
  "Contrast the filtered YTD actuals against annual budgets. Pinpoint the categories and products driving overages or over-consuming resources relative to remaining period headroom. " +
  "Provide exactly 3 specific, actionable cost-saving or reallocation recommendations based directly on these numbers. " +
  "Keep your response concise, structured, and easy to scan.";

const round = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};
const pct = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0;
};
const text = (value: unknown, max = 80) => String(value ?? "").slice(0, max);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function compactBudgetPayload(payload: any) {
  const groups = Array.isArray(payload?.groups) ? payload.groups : [];
  const normalized = groups
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((group: any) => {
      const products = Array.isArray(group?.p)
        ? group.p.map((p: any) =>
            Array.isArray(p)
              ? [text(p[0], 70), round(p[1]), round(p[2]), pct(p[3])]
              : [text(p?.product, 70), round(p?.ytdActual ?? p?.actual), round(p?.annualBudget ?? p?.budget), pct(p?.utilizationPct)],
          )
        : Array.isArray(group?.topProducts)
          ? group.topProducts.map((p: any) => [text(p?.product, 70), round(p?.ytdActual ?? p?.actual), round(p?.annualBudget ?? p?.budget), pct(p?.utilizationPct)])
          : Array.isArray(group?.products)
            ? group.products
                .sort((a: any, b: any) => Number(b?.actual ?? b?.ytdActual ?? 0) - Number(a?.actual ?? a?.ytdActual ?? 0))
                .slice(0, 3)
                .map((p: any) => [text(p?.product, 70), round(p?.actual ?? p?.ytdActual), round(p?.budget ?? p?.annualBudget), pct((p?.pctOfBudget ?? 0) * 100 || p?.utilizationPct)])
            : [];

      const actual = round(group?.a ?? group?.ytdActual ?? group?.actual);
      const budget = round(group?.b ?? group?.annualBudget ?? group?.budget);
      const remaining = round(group?.r ?? group?.remainingHeadroom ?? group?.variance ?? budget - actual);
      const utilization = pct(group?.u ?? group?.utilizationPct ?? (budget ? (actual / budget) * 100 : 0));
      return {
        g: text(group?.g ?? group?.group, 80),
        a: actual,
        b: budget,
        r: remaining,
        u: utilization,
        pc: Number(group?.pc ?? group?.productCount ?? products.length) || products.length,
        p: products.slice(0, 3),
        ...(Array.isArray(group?.o)
          ? { o: group.o.slice(0, 3).map(round) }
          : group?.othersAggregated
            ? { o: [round(group.othersAggregated.count), round(group.othersAggregated.ytdActual), round(group.othersAggregated.annualBudget)] }
            : {}),
      };
    })
    .sort((a: any, b: any) => {
      const riskA = (a.r < 0 ? Math.abs(a.r) * 4 : 0) + a.a + (a.u > 100 ? a.a * 2 : 0);
      const riskB = (b.r < 0 ? Math.abs(b.r) * 4 : 0) + b.a + (b.u > 100 ? b.a * 2 : 0);
      return riskB - riskA;
    })
    .slice(0, 12);

  return {
    period: text(payload?.period ?? payload?.periodFilter, 40),
    unit: text(payload?.unit, 20),
    totals: {
      a: round(payload?.totals?.actual ?? payload?.totals?.a),
      b: round(payload?.totals?.budget ?? payload?.totals?.b),
      r: round(payload?.totals?.remaining ?? payload?.totals?.r),
    },
    groupCount: Number(payload?.groupCount ?? groups.length) || groups.length,
    groups: normalized,
  };
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid budget insight request" }, { status: 400 });
  }
  const { payload } = parsed.data;
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    return NextResponse.json({ error: "GROQ_API_KEY not configured" }, { status: 500 });
  }

  const compactPayload = compactBudgetPayload(payload);

  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.2,
      max_tokens: 700,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(compactPayload) },
      ],
    }),
  });

  if (!r.ok) {
    const t = await r.text();
    console.error("Groq error", r.status, t);
    return NextResponse.json({ error: `Groq AI is unavailable (${r.status})`, detail: t }, { status: r.status });
  }

  const data = await r.json();
  const content = data?.choices?.[0]?.message?.content ?? "";
  return NextResponse.json({ content });
}
