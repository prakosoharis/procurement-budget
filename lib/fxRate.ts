/**
 * Fetch USD->IDR reference rate (BI JISDOR proxy).
 *
 * Live rate: open.er-api.com (no key required).
 * Historical rate per Year+Month: @fawazahmed0/currency-api on jsDelivr,
 * which serves daily ECB/IMF-aligned rates back to 2020 with no API key.
 * We pick the last business day of the requested month (or today if it's
 * the current month) so the figure resembles the BI JISDOR end-of-month rate.
 */

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export async function fetchBiUsdIdr(fallback: number): Promise<{ rate: number; source: string; date: string }> {
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store" });
    if (r.ok) {
      const j = await r.json();
      const rate = Number(j?.rates?.IDR);
      if (rate && isFinite(rate) && rate > 1000) {
        return { rate: Math.round(rate), source: "open.er-api.com (live)", date: (j.time_last_update_utc || "").slice(0, 16) };
      }
    }
  } catch { /* ignore */ }
  return { rate: fallback, source: "fallback", date: "" };
}

/**
 * Historical USD/IDR for a given Year + Month label (e.g. "Mar").
 * Tries Bank Indonesia JISDOR (via our edge function) first, then falls back
 * to a free historical FX API (currency-api), then to the supplied fallback.
 */
export async function fetchHistoricalUsdIdr(
  year: number,
  monthLabel: string,
  fallback: number,
): Promise<{ rate: number; source: string; date: string }> {
  const monthIdx = MONTHS.indexOf(monthLabel);
  if (monthIdx < 0) return fetchBiUsdIdr(fallback);

  // 1. Try BI JISDOR via our own API route
  try {
    const r = await fetch(`/api/fx/jisdor?year=${year}&month=${monthLabel}`);
    if (r.ok) {
      const j = await r.json();
      const rate = Number(j?.rate);
      if (rate && isFinite(rate) && rate > 1000) {
        return { rate: Math.round(rate), source: "bi.go.id JISDOR", date: String(j?.date || "") };
      }
    }
  } catch { /* fall through */ }

  // 2. Fallback: currency-api last business day of month (or today if future)
  const lastDay = new Date(Date.UTC(year, monthIdx + 1, 0));
  const today = new Date();
  const target = lastDay > today ? today : lastDay;
  const dateStr = target.toISOString().slice(0, 10);
  const isToday = dateStr === today.toISOString().slice(0, 10);
  if (isToday) {
    const live = await fetchBiUsdIdr(fallback);
    return { ...live, date: dateStr };
  }
  const urls = [
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${dateStr}/v1/currencies/usd.json`,
    `https://${dateStr}.currency-api.pages.dev/v1/currencies/usd.json`,
  ];
  for (const url of urls) {
    try {
      const r = await fetch(url, { cache: "force-cache" });
      if (r.ok) {
        const j = await r.json();
        const rate = Number(j?.usd?.idr);
        if (rate && isFinite(rate) && rate > 1000) {
          return { rate: Math.round(rate), source: "currency-api (fallback)", date: dateStr };
        }
      }
    } catch { /* try next */ }
  }
  return { rate: fallback, source: "fallback", date: dateStr };
}
