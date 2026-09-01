import { NextRequest, NextResponse } from "next/server";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function lastDayOfMonth(y: number, mIdx: number): Date {
  return new Date(Date.UTC(y, mIdx + 1, 0));
}

async function fetchJisdor(year: number, monthIdx: number): Promise<{ rate: number; date: string } | null> {
  const last = lastDayOfMonth(year, monthIdx);
  const today = new Date();
  const target = last > today ? today : last;
  const start = new Date(Date.UTC(year, monthIdx, 1));
  const fmt = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

  const wsUrl = `https://www.bi.go.id/biwebservice/wskursbi.asmx/getSubKursLokal3?mts=USD&startdate=${fmt(start)}&enddate=${fmt(target)}`;
  try {
    const r = await fetch(wsUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!r.ok) return null;
    const xml = await r.text();
    const rowRe = /<tgl_subkurslokal>([^<]+)<\/tgl_subkurslokal>[\s\S]*?<jual_subkurslokal>([\d.]+)<\/jual_subkurslokal>[\s\S]*?<beli_subkurslokal>([\d.]+)<\/beli_subkurslokal>/g;
    let latest: { date: string; rate: number } | null = null;
    let m: RegExpExecArray | null;
    while ((m = rowRe.exec(xml)) !== null) {
      const jual = Number(m[2]);
      const beli = Number(m[3]);
      const mid = (jual + beli) / 2;
      if (isFinite(mid) && mid > 1000) latest = { date: m[1].slice(0, 10), rate: Math.round(mid) };
    }
    return latest;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const year = Number(url.searchParams.get("year")) || new Date().getUTCFullYear();
  const monthLabel = url.searchParams.get("month") || MONTHS[new Date().getUTCMonth()];
  const monthIdx = MONTHS.indexOf(monthLabel);
  if (monthIdx < 0) {
    return NextResponse.json({ error: "bad month" }, { status: 400 });
  }
  const got = await fetchJisdor(year, monthIdx);
  if (!got) {
    return NextResponse.json({ rate: null, source: "bi.go.id JISDOR", error: "unavailable" });
  }
  return NextResponse.json({ ...got, source: "bi.go.id JISDOR" });
}
