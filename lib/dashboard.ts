import raw from "@/data/database.json";

export const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"] as const;
export type Month = typeof MONTHS[number];
export const YTD_MONTHS = MONTHS.map(m => `YTD ${m}` as const);

export type Currency = "IDR" | "USD";

/** Currency mode chosen by the user in the UI. */
export type CurrencyMode = "IDR" | "USD" | "ALL";
/** When mode === "ALL", this picks which unit to convert everything into. */
export type DisplayCurrency = "IDR" | "USD";

export const DEFAULT_FX_USD_TO_IDR = 16000;

export type ActBudgetKind = "Actual" | "Budget" | "Budget After Allocation";
export type Row = {
  Year: number;
  "Act/Budget": ActBudgetKind;
  Entity: string;
  "Entity Group": string;
  "Capex / Opex": string;
  "Fund Center Group": string;
  "Fund Center Name": string;
  Currency: Currency;
  "Simplified Text"?: string;
} & Record<Month, number> & Record<`YTD ${Month}`, number>;

export const data = raw as unknown as Row[];

/** Classify a row into Actual (A), Budget (B), or Budget After Allocation (BA). */
export const classify = (r: Row): "A" | "B" | "BA" =>
  r["Act/Budget"] === "Actual" ? "A"
  : r["Act/Budget"] === "Budget After Allocation" ? "BA"
  : "B";

export const unique = <T,>(arr: T[]) => Array.from(new Set(arr));

/**
 * Convert a raw cell value (in row's native currency) into the chosen display currency,
 * scaled to display units:
 *   - Display IDR -> billion IDR (raw IDR / 1e9, raw USD * FX / 1e9)
 *   - Display USD -> thousand USD (raw USD / 1e3, raw IDR / FX / 1e3)
 */
export function toDisplay(rawValue: number, native: Currency, display: DisplayCurrency, fx: number): number {
  if (display === "IDR") {
    const idr = native === "IDR" ? rawValue : rawValue * fx;
    return idr / 1e9;
  } else {
    const usd = native === "USD" ? rawValue : rawValue / fx;
    return usd; // raw USD, no scaling
  }
}

export const unitLabel = (d: DisplayCurrency) => d === "IDR" ? "bn IDR" : "USD";

export const fmtAmt = (n: number) => {
  const abs = Math.abs(n);
  const digits = abs >= 1 ? 2 : 3;
  const v = abs.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return n < 0 ? `(${v})` : v;
};

export const fmtPct = (n: number) =>
  isFinite(n) ? `${(n * 100).toFixed(1)}%` : "—";

export type Filters = {
  year: number;
  entityGroup: string;
  entity: string;
  period: Month;
  view: "MTD" | "YTD";
  /** Currency mode: convert every native row into IDR or USD, or ALL with selectable display unit. */
  currencyMode: CurrencyMode;
  /** When mode === "ALL", which unit to display in. Ignored otherwise. */
  displayCurrency: DisplayCurrency;
  /** USD->IDR rate used for conversion. */
  fx: number;
};

/** Resolve the effective display currency for the active mode. */
export const effectiveDisplay = (f: Filters): DisplayCurrency =>
  f.currencyMode === "USD" ? "USD" : f.currencyMode === "IDR" ? "IDR" : f.displayCurrency;

export function applyFilters(rows: Row[], f: Filters) {
  return rows.filter(r => {
    if (r.Year !== f.year) return false;
    if (f.entityGroup !== "ALL" && r["Entity Group"] !== f.entityGroup) return false;
    if (f.entity !== "ALL" && r.Entity !== f.entity) return false;
    return true;
  });
}

/** Same as applyFilters but with an explicit year override (used for prior-year comparisons). */
export function applyFiltersForYear(rows: Row[], f: Filters, year: number) {
  return rows.filter(r => {
    if (r.Year !== year) return false;
    if (f.entityGroup !== "ALL" && r["Entity Group"] !== f.entityGroup) return false;
    if (f.entity !== "ALL" && r.Entity !== f.entity) return false;
    return true;
  });
}

export const valueKey = (f: Filters): Month | `YTD ${Month}` =>
  f.view === "MTD" ? f.period : (`YTD ${f.period}` as const);

const normCat = (c: string) => {
  const u = (c || "").toUpperCase().trim();
  if (u === "OPEX") return "OPEX" as const;
  if (u === "CAPEX" || u === "LVA") return "CAPEX" as const;
  return null;
};

export function totals(rows: Row[], key: Month | `YTD ${Month}`, display: DisplayCurrency, fx: number) {
  let cA=0,cB=0,cBA=0,oA=0,oB=0,oBA=0;
  for (const r of rows) {
    const cat = normCat(r["Capex / Opex"]);
    if (!cat) continue;
    const v = toDisplay(Number(r[key]) || 0, r.Currency, display, fx);
    const k = classify(r);
    if (cat === "CAPEX") { if (k==="A") cA+=v; else if (k==="B") cB+=v; else cBA+=v; }
    else { if (k==="A") oA+=v; else if (k==="B") oB+=v; else oBA+=v; }
  }
  const mk = (a:number,b:number,ba:number) => ({
    actual:a, budget:b, budgetAlloc:ba,
    remaining:b-a, remainingAlloc:ba-a,
  });
  return {
    capex: mk(cA,cB,cBA),
    opex:  mk(oA,oB,oBA),
    total: mk(cA+oA, cB+oB, cBA+oBA),
  };
}

export type CumulativePoint = { month: string; ytdActual: number; ytdBudgetAlloc: number };
export type CumulativeSeries = {
  capex: { points: CumulativePoint[]; budgetCeiling: number; budgetAllocCeiling: number };
  opex:  { points: CumulativePoint[]; budgetCeiling: number; budgetAllocCeiling: number };
  total: { points: CumulativePoint[]; budgetCeiling: number; budgetAllocCeiling: number };
};

export function cumulativeBudgetVsActual(rows: Row[], display: DisplayCurrency, fx: number): CumulativeSeries {
  const cA = new Array(12).fill(0), oA = new Array(12).fill(0);
  const cBA_ytd = new Array(12).fill(0), oBA_ytd = new Array(12).fill(0);
  let cBudget = 0, oBudget = 0, cBAceil = 0, oBAceil = 0;
  for (const r of rows) {
    const cat = normCat(r["Capex / Opex"]);
    if (!cat) continue;
    const k = classify(r);
    if (k === "A") {
      for (let i = 0; i < 12; i++) {
        const v = toDisplay(Number(r[`YTD ${MONTHS[i]}` as const]) || 0, r.Currency, display, fx);
        if (cat === "CAPEX") cA[i] += v; else oA[i] += v;
      }
    } else if (k === "B") {
      const v = toDisplay(Number(r["YTD Dec"]) || 0, r.Currency, display, fx);
      if (cat === "CAPEX") cBudget += v; else oBudget += v;
    } else {
      const v = toDisplay(Number(r["YTD Dec"]) || 0, r.Currency, display, fx);
      if (cat === "CAPEX") cBAceil += v; else oBAceil += v;
      for (let i = 0; i < 12; i++) {
        const vv = toDisplay(Number(r[`YTD ${MONTHS[i]}` as const]) || 0, r.Currency, display, fx);
        if (cat === "CAPEX") cBA_ytd[i] += vv; else oBA_ytd[i] += vv;
      }
    }
  }
  const mk = (aArr:number[], baArr:number[], ceiling:number, baCeil:number) => ({
    points: MONTHS.map((m,i)=>({ month:`YTD ${m}`, ytdActual:aArr[i], ytdBudgetAlloc:baArr[i] })),
    budgetCeiling: ceiling,
    budgetAllocCeiling: baCeil,
  });
  return {
    capex: mk(cA, cBA_ytd, cBudget, cBAceil),
    opex:  mk(oA, oBA_ytd, oBudget, oBAceil),
    total: mk(cA.map((v,i)=>v+oA[i]), cBA_ytd.map((v,i)=>v+oBA_ytd[i]), cBudget+oBudget, cBAceil+oBAceil),
  };
}

export function monthlyTrend(rows: Row[], display: DisplayCurrency, fx: number) {
  return MONTHS.map(m => {
    let cA=0,cB=0,cBA=0,oA=0,oB=0,oBA=0;
    for (const r of rows) {
      const cat = normCat(r["Capex / Opex"]);
      if (!cat) continue;
      const v = toDisplay(Number(r[m]) || 0, r.Currency, display, fx);
      const k = classify(r);
      if (cat === "CAPEX") { if (k==="A") cA+=v; else if (k==="B") cB+=v; else cBA+=v; }
      else { if (k==="A") oA+=v; else if (k==="B") oB+=v; else oBA+=v; }
    }
    return { month: m,
      capexActual: cA, capexBudget: cB, capexBudgetAlloc: cBA,
      opexActual: oA, opexBudget: oB, opexBudgetAlloc: oBA };
  });
}

export function byFundCenter(rows: Row[], key: Month | `YTD ${Month}`, capexOpex: "CAPEX" | "OPEX", display: DisplayCurrency, fx: number) {
  const map = new Map<string, { name: string; actual: number; budget: number; budgetAlloc: number }>();
  for (const r of rows) {
    if (normCat(r["Capex / Opex"]) !== capexOpex) continue;
    const name = r["Fund Center Name"] || "—";
    const cur = map.get(name) || { name, actual: 0, budget: 0, budgetAlloc: 0 };
    const v = toDisplay(Number(r[key]) || 0, r.Currency, display, fx);
    const k = classify(r);
    if (k === "A") cur.actual += v;
    else if (k === "B") cur.budget += v;
    else cur.budgetAlloc += v;
    map.set(name, cur);
  }
  return Array.from(map.values())
    .map(d => ({ ...d, remaining: d.budget - d.actual, remainingAlloc: d.budgetAlloc - d.actual }))
    .sort((a, b) => b.budget - a.budget);
}

export type DeptRow = {
  entityGroup: string;
  entity: string;
  fundCenter: string;
  category: "CAPEX" | "OPEX";
  actual: number;
  budget: number;
  budgetAlloc: number;
  remaining: number;
  remainingAlloc: number;
  usage: number; // actual/budget
  usageAlloc: number; // actual/budgetAlloc
  status: "under" | "over" | "on-track" | "no-budget";
  insight: string;
};

/** Break down remaining budget per Department (Fund Center) within Entity Group → Entity. */
export function departmentBreakdown(rows: Row[], key: Month | `YTD ${Month}`, display: DisplayCurrency, fx: number): DeptRow[] {
  const map = new Map<string, DeptRow>();
  for (const r of rows) {
    const cat = normCat(r["Capex / Opex"]);
    if (!cat) continue;
    const fc = r["Fund Center Name"] || "—";
    const eg = r["Entity Group"] || "—";
    const en = r.Entity || "—";
    const k = `${eg}||${en}||${fc}||${cat}`;
    const v = toDisplay(Number(r[key]) || 0, r.Currency, display, fx);
    const cur = map.get(k) || {
      entityGroup: eg, entity: en, fundCenter: fc, category: cat,
      actual: 0, budget: 0, budgetAlloc: 0,
      remaining: 0, remainingAlloc: 0, usage: 0, usageAlloc: 0,
      status: "no-budget" as const, insight: "",
    };
    const kk = classify(r);
    if (kk === "A") cur.actual += v;
    else if (kk === "B") cur.budget += v;
    else cur.budgetAlloc += v;
    map.set(k, cur);
  }
  const rowsOut = Array.from(map.values()).map(d => {
    const remaining = d.budget - d.actual;
    const remainingAlloc = d.budgetAlloc - d.actual;
    const usage = d.budget !== 0 ? d.actual / d.budget : 0;
    const usageAlloc = d.budgetAlloc !== 0 ? d.actual / d.budgetAlloc : 0;
    let status: DeptRow["status"] = "no-budget";
    let insight = "";
    if (d.budget === 0 && d.actual === 0) {
      status = "no-budget"; insight = "No budget allocated and no spend.";
    } else if (d.budget === 0 && d.actual !== 0) {
      status = "over"; insight = "Spending without budget allocation — investigate.";
    } else if (usage > 1) {
      status = "over"; insight = `Over budget by ${((usage - 1) * 100).toFixed(1)}% — review overruns.`;
    } else if (usage >= 0.9) {
      status = "on-track"; insight = "On track — close to budget utilization.";
    } else if (usage >= 0.5) {
      status = "under"; insight = `Under budget — ${((1 - usage) * 100).toFixed(1)}% remaining. Consider accelerating planned spend.`;
    } else {
      status = "under"; insight = `Significantly under budget — only ${(usage * 100).toFixed(1)}% used. Strong candidate to reallocate or accelerate spend.`;
    }
    return { ...d, remaining, remainingAlloc, usage, usageAlloc, status, insight };
  });
  return rowsOut.sort((a, b) => b.remaining - a.remaining);
}

export type TopSpendRow = {
  entityGroup: string;
  entity: string;
  capexActual: number;
  opexActual: number;
  actual: number;
  budget: number;
  budgetAlloc: number;
};

export type TopItemRow = {
  item: string;
  fundCenterGroup: string;
  entityGroup: string;
  entity: string;
  capexActual: number;
  opexActual: number;
  actual: number;
  budget: number;
  budgetAlloc: number;
};

export function topSpendByItem(rows: Row[], key: Month | `YTD ${Month}`, display: DisplayCurrency, fx: number): TopItemRow[] {
  const map = new Map<string, TopItemRow>();
  for (const r of rows) {
    const cat = normCat(r["Capex / Opex"]);
    if (!cat) continue;
    const item = r["Fund Center Name"] || "—";
    const fcg = r["Fund Center Group"] || "—";
    const eg = r["Entity Group"] || "—";
    const en = r.Entity || "—";
    const k = `${item}||${fcg}||${eg}||${en}`;
    const cur = map.get(k) || { item, fundCenterGroup: fcg, entityGroup: eg, entity: en, capexActual: 0, opexActual: 0, actual: 0, budget: 0, budgetAlloc: 0 };
    const v = toDisplay(Number(r[key]) || 0, r.Currency, display, fx);
    const kk = classify(r);
    if (kk === "A") {
      if (cat === "CAPEX") cur.capexActual += v; else cur.opexActual += v;
      cur.actual += v;
    } else if (kk === "B") cur.budget += v;
    else cur.budgetAlloc += v;
    map.set(k, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.actual - a.actual);
}

export function topSpendByGroupEntity(rows: Row[], key: Month | `YTD ${Month}`, display: DisplayCurrency, fx: number): TopSpendRow[] {
  const map = new Map<string, TopSpendRow>();
  for (const r of rows) {
    const cat = normCat(r["Capex / Opex"]);
    if (!cat) continue;
    const eg = r["Entity Group"] || "—";
    const en = r.Entity || "—";
    const k = `${eg}||${en}`;
    const cur = map.get(k) || { entityGroup: eg, entity: en, capexActual: 0, opexActual: 0, actual: 0, budget: 0, budgetAlloc: 0 };
    const v = toDisplay(Number(r[key]) || 0, r.Currency, display, fx);
    const kk = classify(r);
    if (kk === "A") {
      if (cat === "CAPEX") cur.capexActual += v; else cur.opexActual += v;
      cur.actual += v;
    } else if (kk === "B") cur.budget += v;
    else cur.budgetAlloc += v;
    map.set(k, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.actual - a.actual);
}

export type GroupShareRow = {
  entityGroup: string;
  actual: number;
  budget: number;
  budgetAlloc: number;
  shareOfBudget: number;
  shareOfActual: number;
  shareOfBudgetAlloc: number;
  usage: number;
  usageAlloc: number;
};

export function entityGroupShares(rows: Row[], key: Month | `YTD ${Month}`, display: DisplayCurrency, fx: number): {
  rows: GroupShareRow[];
  totalActual: number;
  totalBudget: number;
  totalBudgetAlloc: number;
} {
  const map = new Map<string, { actual: number; budget: number; budgetAlloc: number }>();
  for (const r of rows) {
    const cat = normCat(r["Capex / Opex"]);
    if (!cat) continue;
    const eg = r["Entity Group"] || "—";
    const cur = map.get(eg) || { actual: 0, budget: 0, budgetAlloc: 0 };
    const v = toDisplay(Number(r[key]) || 0, r.Currency, display, fx);
    const kk = classify(r);
    if (kk === "A") cur.actual += v;
    else if (kk === "B") cur.budget += v;
    else cur.budgetAlloc += v;
    map.set(eg, cur);
  }
  let totalActual=0, totalBudget=0, totalBudgetAlloc=0;
  for (const v of map.values()) { totalActual += v.actual; totalBudget += v.budget; totalBudgetAlloc += v.budgetAlloc; }
  const out: GroupShareRow[] = Array.from(map.entries()).map(([entityGroup, v]) => ({
    entityGroup,
    actual: v.actual,
    budget: v.budget,
    budgetAlloc: v.budgetAlloc,
    shareOfBudget: totalBudget !== 0 ? v.budget / totalBudget : 0,
    shareOfActual: totalActual !== 0 ? v.actual / totalActual : 0,
    shareOfBudgetAlloc: totalBudgetAlloc !== 0 ? v.budgetAlloc / totalBudgetAlloc : 0,
    usage: v.budget !== 0 ? v.actual / v.budget : 0,
    usageAlloc: v.budgetAlloc !== 0 ? v.actual / v.budgetAlloc : 0,
  })).sort((a, b) => b.budget - a.budget);
  return { rows: out, totalActual, totalBudget, totalBudgetAlloc };
}

export function byEntity(rows: Row[], key: Month | `YTD ${Month}`, display: DisplayCurrency, fx: number) {
  const map = new Map<string, { entity: string; actual: number; budget: number; budgetAlloc: number }>();
  for (const r of rows) {
    const cur = map.get(r.Entity) || { entity: r.Entity, actual: 0, budget: 0, budgetAlloc: 0 };
    const v = toDisplay(Number(r[key]) || 0, r.Currency, display, fx);
    const kk = classify(r);
    if (kk === "A") cur.actual += v;
    else if (kk === "B") cur.budget += v;
    else cur.budgetAlloc += v;
    map.set(r.Entity, cur);
  }
  return Array.from(map.values())
    .map(d => ({ ...d, remaining: d.budget - d.actual, remainingAlloc: d.budgetAlloc - d.actual }))
    .sort((a, b) => b.budget - a.budget);
}

const normCatPub = (c: string) => {
  const u = (c || "").toUpperCase().trim();
  if (u === "OPEX") return "OPEX" as const;
  if (u === "CAPEX" || u === "LVA") return "CAPEX" as const;
  return null;
};

export type EgYearBlock = {
  capexActual: number; capexBudget: number; capexBudgetAlloc: number;
  opexActual: number;  opexBudget: number;  opexBudgetAlloc: number;
  capexActualYTD: number[];
  opexActualYTD:  number[];
  capexBudgetYTD: number[];
  opexBudgetYTD:  number[];
  capexBudgetAllocYTD: number[];
  opexBudgetAllocYTD:  number[];
};

export type EgComparisonRow = {
  entityGroup: string;
  currentYear: number;
  lastYear: number;
  period: Month;
  mtdCurrent: { capexActual: number; capexBudget: number; capexBudgetAlloc: number; opexActual: number; opexBudget: number; opexBudgetAlloc: number };
  ytdCurrent: EgYearBlock;
  mtdLast:    { capexActual: number; capexBudget: number; capexBudgetAlloc: number; opexActual: number; opexBudget: number; opexBudgetAlloc: number };
  ytdLast:    EgYearBlock;
};

export function entityGroupYearComparison(
  allRows: Row[],
  f: Filters,
  display: DisplayCurrency,
): EgComparisonRow[] {
  const fx = f.fx;
  const currentYear = f.year;
  const lastYear = f.year - 1;
  const period = f.period;
  const ytdKey = `YTD ${period}` as const;

  const baseRows = allRows.filter(r => {
    if (r.Year !== currentYear && r.Year !== lastYear) return false;
    if (f.entity !== "ALL" && r.Entity !== f.entity) return false;
    return true;
  });

  const groups = f.entityGroup === "ALL"
    ? unique(baseRows.map(r => r["Entity Group"])).sort()
    : [f.entityGroup];

  return groups.map(eg => {
    const rows = baseRows.filter(r => r["Entity Group"] === eg);
    const makeBlock = (year: number): EgYearBlock => {
      const capexActualYTD = new Array(12).fill(0);
      const opexActualYTD  = new Array(12).fill(0);
      const capexBudgetYTD = new Array(12).fill(0);
      const opexBudgetYTD  = new Array(12).fill(0);
      const capexBudgetAllocYTD = new Array(12).fill(0);
      const opexBudgetAllocYTD  = new Array(12).fill(0);
      let cA=0,cB=0,cBA=0,oA=0,oB=0,oBA=0;
      for (const r of rows) {
        if (r.Year !== year) continue;
        const cat = normCatPub(r["Capex / Opex"]);
        if (!cat) continue;
        const kk = classify(r);
        const v = toDisplay(Number(r[ytdKey]) || 0, r.Currency, display, fx);
        if (cat === "CAPEX") { if (kk==="A") cA+=v; else if (kk==="B") cB+=v; else cBA+=v; }
        else { if (kk==="A") oA+=v; else if (kk==="B") oB+=v; else oBA+=v; }
        for (let i = 0; i < 12; i++) {
          const vv = toDisplay(Number(r[`YTD ${MONTHS[i]}` as const]) || 0, r.Currency, display, fx);
          if (cat === "CAPEX") {
            if (kk==="A") capexActualYTD[i]+=vv;
            else if (kk==="B") capexBudgetYTD[i]+=vv;
            else capexBudgetAllocYTD[i]+=vv;
          } else {
            if (kk==="A") opexActualYTD[i]+=vv;
            else if (kk==="B") opexBudgetYTD[i]+=vv;
            else opexBudgetAllocYTD[i]+=vv;
          }
        }
      }
      return {
        capexActual:cA, capexBudget:cB, capexBudgetAlloc:cBA,
        opexActual:oA,  opexBudget:oB,  opexBudgetAlloc:oBA,
        capexActualYTD, opexActualYTD, capexBudgetYTD, opexBudgetYTD,
        capexBudgetAllocYTD, opexBudgetAllocYTD,
      };
    };
    const makeMtd = (year: number) => {
      let cA=0,cB=0,cBA=0,oA=0,oB=0,oBA=0;
      for (const r of rows) {
        if (r.Year !== year) continue;
        const cat = normCatPub(r["Capex / Opex"]);
        if (!cat) continue;
        const v = toDisplay(Number(r[period]) || 0, r.Currency, display, fx);
        const kk = classify(r);
        if (cat === "CAPEX") { if (kk==="A") cA+=v; else if (kk==="B") cB+=v; else cBA+=v; }
        else { if (kk==="A") oA+=v; else if (kk==="B") oB+=v; else oBA+=v; }
      }
      return { capexActual:cA, capexBudget:cB, capexBudgetAlloc:cBA, opexActual:oA, opexBudget:oB, opexBudgetAlloc:oBA };
    };
    return {
      entityGroup: eg,
      currentYear, lastYear, period,
      mtdCurrent: makeMtd(currentYear),
      ytdCurrent: makeBlock(currentYear),
      mtdLast:    makeMtd(lastYear),
      ytdLast:    makeBlock(lastYear),
    };
  }).sort((a, b) => (b.ytdCurrent.capexActual + b.ytdCurrent.opexActual) - (a.ytdCurrent.capexActual + a.ytdCurrent.opexActual));
}

export type CategorySpendRow = {
  category: string;
  capex: number;
  opex: number;
  total: number;
};

export type CategoryEntityRow = {
  entityGroup: string;
  entity: string;
  capex: number;
  opex: number;
  total: number;
};

/** Drill-down: for a given Simplified Text category, get Actual spend per Entity Group + Entity. */
export function categoryEntityBreakdown(
  rows: Row[],
  category: string,
  key: Month | `YTD ${Month}`,
  display: DisplayCurrency,
  fx: number,
): CategoryEntityRow[] {
  const map = new Map<string, CategoryEntityRow>();
  for (const r of rows) {
    if (r["Act/Budget"] !== "Actual") continue;
    const cat = normCat(r["Capex / Opex"]);
    if (!cat) continue;
    const name = (r["Simplified Text"] || "—").toString().trim() || "—";
    if (name !== category) continue;
    const eg = r["Entity Group"] || "—";
    const en = r.Entity || "—";
    const k = `${eg}||${en}`;
    const cur = map.get(k) || { entityGroup: eg, entity: en, capex: 0, opex: 0, total: 0 };
    const v = toDisplay(Number(r[key]) || 0, r.Currency, display, fx);
    if (cat === "CAPEX") cur.capex += v; else cur.opex += v;
    cur.total += v;
    map.set(k, cur);
  }
  return Array.from(map.values()).filter(r => r.total !== 0).sort((a, b) => b.total - a.total);
}

/** Aggregate Actual spend by Simplified Text category, split into CAPEX/OPEX. */
export function spendByCategory(rows: Row[], key: Month | `YTD ${Month}`, display: DisplayCurrency, fx: number): CategorySpendRow[] {
  const map = new Map<string, CategorySpendRow>();
  for (const r of rows) {
    if (r["Act/Budget"] !== "Actual") continue;
    const cat = normCat(r["Capex / Opex"]);
    if (!cat) continue;
    const name = (r["Simplified Text"] || "—").toString().trim() || "—";
    const cur = map.get(name) || { category: name, capex: 0, opex: 0, total: 0 };
    const v = toDisplay(Number(r[key]) || 0, r.Currency, display, fx);
    if (cat === "CAPEX") cur.capex += v; else cur.opex += v;
    cur.total += v;
    map.set(name, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

/* ============================================================
 * Product-Level Breakdown (parent = Fund Center Group, children = Simplified Text products)
 * Actuals respect the current filter period. Budgets are ANNUAL (YTD Dec) to show long-term headroom.
 * ============================================================ */
export type ProductRow = {
  product: string;
  actual: number;
  budget: number;
  budgetAlloc: number;
  variance: number;
  varianceAlloc: number;
  pctOfBudget: number;
  pctOfBudgetAlloc: number;
  pctOfParentBudget: number;
};

export type ParentGroupRow = {
  group: string;
  actual: number;
  budget: number;
  budgetAlloc: number;
  variance: number;
  varianceAlloc: number;
  pctOfBudget: number;
  pctOfBudgetAlloc: number;
  products: ProductRow[];
};

export function productBreakdown(
  rows: Row[],
  actualKey: Month | `YTD ${Month}`,
  display: DisplayCurrency,
  fx: number,
): ParentGroupRow[] {
  const budgetKey: `YTD ${Month}` = "YTD Dec";
  const groups = new Map<string, Map<string, { actual: number; budget: number; budgetAlloc: number }>>();

  for (const r of rows) {
    if (!normCat(r["Capex / Opex"])) continue;
    const g = r["Fund Center Group"] || "—";
    const p = (r["Simplified Text"] || "—").toString().trim() || "—";
    if (!groups.has(g)) groups.set(g, new Map());
    const inner = groups.get(g)!;
    const cur = inner.get(p) || { actual: 0, budget: 0, budgetAlloc: 0 };
    const kk = classify(r);
    if (kk === "A") {
      cur.actual += toDisplay(Number(r[actualKey]) || 0, r.Currency, display, fx);
    } else if (kk === "B") {
      cur.budget += toDisplay(Number(r[budgetKey]) || 0, r.Currency, display, fx);
    } else {
      cur.budgetAlloc += toDisplay(Number(r[budgetKey]) || 0, r.Currency, display, fx);
    }
    inner.set(p, cur);
  }

  const out: ParentGroupRow[] = [];
  for (const [g, inner] of groups) {
    let ga=0, gb=0, gba=0;
    const prods: Omit<ProductRow, "pctOfParentBudget">[] = [];
    for (const [p, v] of inner) {
      if (v.actual === 0 && v.budget === 0 && v.budgetAlloc === 0) continue;
      ga += v.actual; gb += v.budget; gba += v.budgetAlloc;
      prods.push({
        product: p,
        actual: v.actual,
        budget: v.budget,
        budgetAlloc: v.budgetAlloc,
        variance: v.budget - v.actual,
        varianceAlloc: v.budgetAlloc - v.actual,
        pctOfBudget: v.budget ? v.actual / v.budget : 0,
        pctOfBudgetAlloc: v.budgetAlloc ? v.actual / v.budgetAlloc : 0,
      });
    }
    if (ga === 0 && gb === 0 && gba === 0) continue;
    const products: ProductRow[] = prods
      .map(p => ({ ...p, pctOfParentBudget: gb ? p.actual / gb : 0 }))
      .sort((a, b) => b.actual - a.actual);
    out.push({
      group: g,
      actual: ga,
      budget: gb,
      budgetAlloc: gba,
      variance: gb - ga,
      varianceAlloc: gba - ga,
      pctOfBudget: gb ? ga / gb : 0,
      pctOfBudgetAlloc: gba ? ga / gba : 0,
      products,
    });
  }
  return out.sort((a, b) => b.actual - a.actual);
}
