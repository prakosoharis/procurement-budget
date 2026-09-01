import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromRequest } from "@/lib/auth";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});
const BodySchema = z.object({
  messages: z.array(MessageSchema).min(1).max(12),
  summary: z.record(z.unknown()),
});
const GROQ_MODEL = "openai/gpt-oss-120b";

const SYSTEM_PROMPT =
  "You are an elite IT-finance Copilot for a CAPEX/OPEX budget dashboard. " +
  "Amounts are in the unit provided in the summary (usually 'bn IDR'). LVA is grouped under CAPEX. " +
  "You will receive a compact JSON `summary` comparing the user's metrics to an industry benchmark " +
  "(fields: user.actual, user.budget, user.util, user.capexShare, user.opexShare; benchmark.utilTarget, benchmark.capexShare, benchmark.opexShare, benchmark.itPctRevenue; delta.*). " +
  "Answer the user's question using ONLY those numbers — never invent figures. " +
  "Respond in concise, well-structured markdown with short bullet points, bold key numbers, and a final one-line actionable recommendation. " +
  "Highlight the largest gap vs. benchmark and, when relevant, cite the benchmark source by name (Gartner, Deloitte, Flexera, McKinsey, IDC, World Bank).";

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid chat request" }, { status: 400 });
  }
  const { messages, summary } = parsed.data;
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    return NextResponse.json({ error: "GROQ_API_KEY not configured" }, { status: 500 });
  }

  const history = messages.slice(-8);
  const chat = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: `Benchmark summary JSON:\n${JSON.stringify(summary ?? {})}` },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];

  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.3,
      max_tokens: 700,
      messages: chat,
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
