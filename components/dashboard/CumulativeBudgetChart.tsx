"use client";

import { Card } from "@/components/ui/card";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, ReferenceLine, XAxis, YAxis,
  Tooltip, CartesianGrid, Legend,
} from "recharts";
import { fmtAmt, type CumulativePoint, type Month } from "@/lib/dashboard";

type Props = {
  title: string;
  points: CumulativePoint[];
  budgetCeiling: number;
  budgetAllocCeiling?: number;
  unit: string;
  period?: Month;
  color?: string;
};

export function CumulativeBudgetChart({
  title, points, budgetCeiling, budgetAllocCeiling, unit, period, color = "hsl(25 95% 55%)",
}: Props) {
  const periodIdx = period
    ? ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].indexOf(period)
    : 11;
  const visiblePoints = points.slice(0, periodIdx + 1);
  const hasAlloc = typeof budgetAllocCeiling === "number";
  const maxY = Math.max(
    budgetCeiling,
    hasAlloc ? budgetAllocCeiling! : 0,
    ...visiblePoints.map(p => Math.max(p.ytdActual, p.ytdBudgetAlloc || 0)),
  ) * 1.15 || 1;
  const ytdActual = visiblePoints[visiblePoints.length - 1]?.ytdActual ?? 0;
  const usedPct = budgetCeiling !== 0 ? (ytdActual / budgetCeiling) * 100 : 0;
  const usedPctAlloc = hasAlloc && budgetAllocCeiling! !== 0 ? (ytdActual / budgetAllocCeiling!) * 100 : 0;
  const isFullYear = visiblePoints.length > 9;

  return (
    <Card className="glass-card p-4">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h3 className="text-sm font-semibold leading-snug">{title}</h3>
        <div className="shrink-0 text-right space-y-1">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Budget Ceiling (FY)</div>
            <div className="text-sm font-semibold tabular-nums">{fmtAmt(budgetCeiling)} {unit}</div>
          </div>
          {hasAlloc && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-accent">After Allocation (FY)</div>
              <div className="text-sm font-semibold tabular-nums text-accent">{fmtAmt(budgetAllocCeiling!)} {unit}</div>
            </div>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        {period ? `YTD ${period}: ${fmtAmt(ytdActual)} ${unit}` : `Amount in ${unit}`}
        {` · ${usedPct.toFixed(1)}% of FY budget`}
        {hasAlloc && ` · ${usedPctAlloc.toFixed(1)}% of allocation`}
      </p>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={visiblePoints.map(p => ({ ...p, monthShort: p.month.replace(/^YTD\s+/i, "") }))}
            margin={{ top: 24, right: 18, bottom: 8, left: 0 }}
          >
            <defs>
              <linearGradient id={`grad-${title.replace(/\s+/g, "-")}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.95} />
                <stop offset="100%" stopColor={color} stopOpacity={0.55} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="hsl(var(--border))" vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="monthShort"
              stroke="hsl(var(--muted-foreground))"
              fontSize={isFullYear ? 8 : 10}
              tickLine={false} axisLine={false} interval={0} tickMargin={6} height={30}
              padding={{ left: 2, right: 2 }}
              tick={{ dy: 3, fontSize: isFullYear ? 8 : 10, fill: "hsl(var(--muted-foreground))" }}
            />
            <YAxis
              domain={[0, maxY]}
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              tickLine={false} axisLine={false}
              tickFormatter={fmtAmt} width={38}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
              labelFormatter={(l) => `YTD ${l}`}
              formatter={(v: number, n: string) => [`${fmtAmt(v)} ${unit}`, n]}
            />
            <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" />
            <ReferenceLine
              y={budgetCeiling}
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              label={{ value: `Budget ${fmtAmt(budgetCeiling)}`, position: "insideTopRight", fill: "hsl(var(--muted-foreground))", fontSize: 10, offset: 6 }}
            />
            {hasAlloc && (
              <ReferenceLine
                y={budgetAllocCeiling!}
                stroke="hsl(var(--accent))"
                strokeWidth={1.5}
                strokeDasharray="2 3"
                label={{ value: `Alloc ${fmtAmt(budgetAllocCeiling!)}`, position: "insideBottomRight", fill: "hsl(var(--accent))", fontSize: 10, offset: 6 }}
              />
            )}
            <Bar
              dataKey="ytdActual"
              name="YTD Actual"
              fill={`url(#grad-${title.replace(/\s+/g, "-")})`}
              radius={[6, 6, 0, 0]}
              maxBarSize={isFullYear ? 12 : 18}
            />
            {hasAlloc && (
              <Line
                type="monotone"
                dataKey="ytdBudgetAlloc"
                name="YTD Alloc (cum.)"
                stroke="hsl(var(--accent))"
                strokeWidth={2}
                strokeDasharray="4 3"
                dot={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
