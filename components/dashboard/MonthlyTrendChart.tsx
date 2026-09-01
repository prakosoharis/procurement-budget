"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Cell,
} from "recharts";
import { fmtAmt, MONTHS, type Month } from "@/lib/dashboard";

type Point = {
  month: string;
  capexActual: number;
  capexBudget: number;
  opexActual: number;
  opexBudget: number;
};

type Mode = "capex" | "opex";

const tooltipStyle = {
  contentStyle: {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 12,
    fontSize: 12,
    boxShadow: "0 8px 24px hsl(var(--background) / 0.4)",
  },
  labelStyle: { color: "hsl(var(--muted-foreground))", fontWeight: 600, marginBottom: 4 },
};

export function MonthlyTrendChart({ data, unit, period }: { data: Point[]; unit: string; period?: Month }) {
  const [mode, setMode] = useState<Mode>("capex");

  const series = useMemo(() => {
    return data.map((d) => {
      const actual = mode === "capex" ? d.capexActual : d.opexActual;
      const budget = mode === "capex" ? d.capexBudget : d.opexBudget;
      const variance = actual - budget; // negative => under budget (good for spend)
      const variancePct = budget !== 0 ? (variance / budget) * 100 : 0;
      return { month: d.month, actual, budget, variance, variancePct };
    });
  }, [data, mode]);

  const totals = useMemo(() => {
    const ytdEndIdx = period ? MONTHS.indexOf(period) : MONTHS.length - 1;
    // Actual YTD: only sum up to (and including) the selected period month.
    const a = series.reduce((s, r, i) => (i <= ytdEndIdx ? s + r.actual : s), 0);
    // Budget Full Year: sum across all 12 months regardless of period.
    const b = series.reduce((s, r) => s + r.budget, 0);
    const v = a - b;
    const pct = b !== 0 ? (v / b) * 100 : 0;
    return { actual: a, budget: b, variance: v, pct };
  }, [series, period]);

  const accent = mode === "capex" ? "hsl(var(--chart-1))" : "hsl(var(--chart-2))";
  const accentSoft = mode === "capex" ? "hsl(var(--chart-1) / 0.18)" : "hsl(var(--chart-2) / 0.18)";

  return (
    <Card className="glass-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-semibold">Monthly Trend</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Actual vs Budget · variance shown as bars below the line · Amount in {unit}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/30">
            <Button
              size="sm"
              variant={mode === "capex" ? "default" : "ghost"}
              className="h-7 px-3 text-xs"
              onClick={() => setMode("capex")}
            >
              CAPEX
            </Button>
            <Button
              size="sm"
              variant={mode === "opex" ? "default" : "ghost"}
              className="h-7 px-3 text-xs"
              onClick={() => setMode("opex")}
            >
              OPEX
            </Button>
          </div>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <SummaryTile label={period ? `Actual YTD ${period}` : "Actual YTD"} value={fmtAmt(totals.actual)} unit={unit} dotColor={accent} />
        <SummaryTile label="Budget Full Year" value={fmtAmt(totals.budget)} unit={unit} dotColor="hsl(var(--muted-foreground))" />
        <SummaryTile
          label="Remaining Budget"
          value={fmtAmt(Math.max(0, -totals.variance))}
          unit={`${unit}${totals.variance <= 0 ? ` · ${Math.abs(totals.pct).toFixed(1)}% left` : " · none"}`}
          dotColor="hsl(142 71% 45%)"
          highlight={totals.variance <= 0 ? "good" : undefined}
        />
        <SummaryTile
          label="Over Budget"
          value={totals.variance > 0 ? fmtAmt(totals.variance) : "—"}
          unit={totals.variance > 0 ? `${unit} · +${totals.pct.toFixed(1)}%` : unit}
          dotColor="hsl(0 84% 60%)"
          highlight={totals.variance > 0 ? "bad" : undefined}
        />
      </div>

      {/* Main chart: Budget area + Actual line */}
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
            <defs>
              <linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity={0.35} />
                <stop offset="100%" stopColor={accent} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="hsl(var(--border))" vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={fmtAmt}
            />
            <Tooltip
              {...tooltipStyle}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as (typeof series)[number];
                const under = row.variance <= 0;
                return (
                  <div
                    style={tooltipStyle.contentStyle}
                    className="px-3 py-2 min-w-[180px]"
                  >
                    <div style={tooltipStyle.labelStyle}>{label}</div>
                    <Row label="Actual" value={`${fmtAmt(row.actual)} ${unit}`} color={accent} />
                    <Row label="Budget" value={`${fmtAmt(row.budget)} ${unit}`} color="hsl(var(--muted-foreground))" />
                    <div className="my-1.5 border-t border-border" />
                    <Row
                      label={under ? "Under by" : "Over by"}
                      value={`${fmtAmt(Math.abs(row.variance))} ${unit} (${row.variancePct >= 0 ? "+" : ""}${row.variancePct.toFixed(1)}%)`}
                      color={under ? "hsl(142 71% 45%)" : "hsl(0 84% 60%)"}
                      bold
                    />
                  </div>
                );
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
            {/* Budget as a soft "target" area band */}
            <Bar
              dataKey="budget"
              name="Budget"
              fill={accentSoft}
              stroke="hsl(var(--muted-foreground) / 0.35)"
              strokeDasharray="3 3"
              radius={[4, 4, 0, 0]}
              barSize={28}
            />
            {/* Actual as a bold line + dots over the budget band — easy to see gap */}
            <Line
              type="monotone"
              dataKey="actual"
              name="Actual"
              stroke={accent}
              strokeWidth={3}
              dot={{ r: 4, strokeWidth: 2, fill: "hsl(var(--background))" }}
              activeDot={{ r: 6 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Variance bar chart — diverging from zero */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-muted-foreground">
            Variance per month (Actual − Budget)
          </span>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: "hsl(142 71% 45%)" }} />
              Under
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: "hsl(0 84% 60%)" }} />
              Over
            </span>
          </div>
        </div>
        <div className="h-[110px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ top: 4, right: 12, bottom: 0, left: -8 }}>
              <CartesianGrid stroke="hsl(var(--border))" vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={fmtAmt}
              />
              <ReferenceLine y={0} stroke="hsl(var(--border))" />
              <Tooltip
                {...tooltipStyle}
                formatter={(v: number) => {
                  const under = v <= 0;
                  return [
                    `${under ? "Under by " : "Over by "}${fmtAmt(Math.abs(v))} ${unit}`,
                    "Variance",
                  ];
                }}
              />
              <Bar dataKey="variance" name="Variance" radius={[4, 4, 4, 4]} barSize={20}>
                {series.map((row, i) => (
                  <Cell
                    key={i}
                    fill={row.variance <= 0 ? "hsl(142 71% 45%)" : "hsl(0 84% 60%)"}
                  />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}

function SummaryTile({
  label,
  value,
  unit,
  dotColor,
  highlight,
}: {
  label: string;
  value: string;
  unit: string;
  dotColor: string;
  highlight?: "good" | "bad";
}) {
  const ring =
    highlight === "good"
      ? "ring-1 ring-[hsl(142_71%_45%/0.35)] bg-[hsl(142_71%_45%/0.06)]"
      : highlight === "bad"
      ? "ring-1 ring-[hsl(0_84%_60%/0.35)] bg-[hsl(0_84%_60%/0.06)]"
      : "bg-muted/30";
  return (
    <div className={`rounded-lg px-3 py-2 ${ring}`}>
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <span className="h-2 w-2 rounded-full" style={{ background: dotColor }} />
        {label}
      </div>
      <div className="mt-1 text-base font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] text-muted-foreground tabular-nums">{unit}</div>
    </div>
  );
}

function Row({ label, value, color, bold }: { label: string; value: string; color: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 text-xs py-0.5">
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        {label}
      </span>
      <span className={`tabular-nums ${bold ? "font-semibold" : ""}`} style={bold ? { color } : undefined}>
        {value}
      </span>
    </div>
  );
}
