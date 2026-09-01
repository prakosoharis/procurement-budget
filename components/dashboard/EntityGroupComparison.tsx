"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtAmt, MONTHS, type EgComparisonRow } from "@/lib/dashboard";

type Mode = "CAPEX" | "OPEX" | "TOTAL";

function pct(curr: number, prev: number) {
  if (!isFinite(prev) || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function YoYBadge({ curr, prev }: { curr: number; prev: number }) {
  const p = pct(curr, prev);
  if (p === null) return <Badge variant="secondary" className="text-[10px]">n/a</Badge>;
  const up = p >= 0;
  const Icon = Math.abs(p) < 0.1 ? Minus : up ? TrendingUp : TrendingDown;
  const cls = Math.abs(p) < 0.1
    ? "bg-muted text-muted-foreground"
    : up ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success";
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium", cls)}>
      <Icon className="h-3 w-3" />{up ? "+" : ""}{p.toFixed(1)}%
    </span>
  );
}

function GroupCard({ row, unit, mode }: { row: EgComparisonRow; unit: string; mode: Mode }) {
  const select = (block: typeof row.ytdCurrent) => {
    if (mode === "CAPEX") return { actual: block.capexActual, budget: block.capexBudget, actualYTD: block.capexActualYTD, budgetYTD: block.capexBudgetYTD };
    if (mode === "OPEX")  return { actual: block.opexActual,  budget: block.opexBudget,  actualYTD: block.opexActualYTD,  budgetYTD: block.opexBudgetYTD };
    return {
      actual: block.capexActual + block.opexActual,
      budget: block.capexBudget + block.opexBudget,
      actualYTD: block.capexActualYTD.map((v, i) => v + block.opexActualYTD[i]),
      budgetYTD: block.capexBudgetYTD.map((v, i) => v + block.opexBudgetYTD[i]),
    };
  };
  const cy = select(row.ytdCurrent);
  const ly = select(row.ytdLast);
  const mtdCY = mode === "CAPEX" ? row.mtdCurrent.capexActual
    : mode === "OPEX" ? row.mtdCurrent.opexActual
    : row.mtdCurrent.capexActual + row.mtdCurrent.opexActual;
  const mtdLY = mode === "CAPEX" ? row.mtdLast.capexActual
    : mode === "OPEX" ? row.mtdLast.opexActual
    : row.mtdLast.capexActual + row.mtdLast.opexActual;
  const remainingCY = cy.budget - cy.actual;

  const chartData = MONTHS.map((m, i) => ({
    month: m,
    actualCY: cy.actualYTD[i],
    actualLY: ly.actualYTD[i],
    budgetCY: cy.budgetYTD[i],
  }));

  return (
    <Card className="glass-card p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{mode}</div>
          <h4 className="text-lg font-semibold">{row.entityGroup}</h4>
          <div className="text-[11px] text-muted-foreground">YTD {row.period} · {row.currentYear} vs {row.lastYear}</div>
        </div>
        <YoYBadge curr={cy.actual} prev={ly.actual} />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-lg border border-border/40 bg-secondary/30 p-3">
          <div className="text-[10px] uppercase text-muted-foreground tracking-wider">YTD {row.period} {row.currentYear}</div>
          <div className="text-xl font-bold font-mono mt-1">{fmtAmt(cy.actual)}</div>
          <div className="text-[10px] text-muted-foreground font-mono">vs Budget {fmtAmt(cy.budget)} {unit}</div>
          <div className={cn("text-[11px] font-mono mt-1", remainingCY >= 0 ? "text-success" : "text-destructive")}>
            {remainingCY >= 0 ? "Remaining Budget " : "Over by "} {fmtAmt(Math.abs(remainingCY))} {unit}
          </div>
        </div>
        <div className="rounded-lg border border-border/40 bg-secondary/15 p-3">
          <div className="text-[10px] uppercase text-muted-foreground tracking-wider">YTD {row.period} {row.lastYear}</div>
          <div className="text-xl font-bold font-mono mt-1 text-muted-foreground">{fmtAmt(ly.actual)}</div>
          <div className="text-[10px] text-muted-foreground font-mono">vs Budget {fmtAmt(ly.budget)} {unit}</div>
          <div className="text-[11px] text-muted-foreground mt-1">
            MTD {row.period}: <span className="font-mono">{fmtAmt(mtdCY)}</span> <span className="opacity-60">({row.currentYear})</span>
            <span className="mx-1">·</span>
            <span className="font-mono">{fmtAmt(mtdLY)}</span> <span className="opacity-60">({row.lastYear})</span>
          </div>
        </div>
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={10} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={(v) => fmtAmt(v as number)} />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
              formatter={(v: number, n: string) => [`${fmtAmt(v)} ${unit}`, n]}
            />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Line type="monotone" dataKey="budgetCY" name={`Budget ${row.currentYear}`} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="actualCY" name={`Actual ${row.currentYear}`} stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 2 }} />
            <Line type="monotone" dataKey="actualLY" name={`Actual ${row.lastYear}`} stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 2 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function EntityGroupComparison({ rows, unit }: { rows: EgComparisonRow[]; unit: string }) {
  const [mode, setMode] = useState<Mode>("TOTAL");
  const totals = useMemo(() => {
    const sum = rows.reduce((s, r) => {
      const cy = r.ytdCurrent, ly = r.ytdLast;
      s.cyA += cy.capexActual + cy.opexActual;
      s.cyB += cy.capexBudget + cy.opexBudget;
      s.lyA += ly.capexActual + ly.opexActual;
      return s;
    }, { cyA: 0, cyB: 0, lyA: 0 });
    return sum;
  }, [rows]);

  if (!rows.length) return null;

  return (
    <Card className="glass-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h3 className="text-base font-semibold">Entity Group · Cumulative CAPEX & OPEX</h3>
          <p className="text-xs text-muted-foreground">
            Current year vs last year (YTD {rows[0].period}) · Amount in {unit}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right mr-3">
            <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Group YoY (Actual)</div>
            <div className="flex items-center justify-end gap-2 mt-0.5">
              <span className="font-mono text-sm font-semibold">{fmtAmt(totals.cyA)} {unit}</span>
              <YoYBadge curr={totals.cyA} prev={totals.lyA} />
            </div>
          </div>
          {(["CAPEX", "OPEX", "TOTAL"] as const).map(m => (
            <Button key={m} size="sm" variant={mode === m ? "default" : "outline"} className="h-8 text-xs" onClick={() => setMode(m)}>
              {m}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {rows.map(r => <GroupCard key={r.entityGroup} row={r} unit={unit} mode={mode} />)}
      </div>
    </Card>
  );
}
