"use client";

import { Card } from "@/components/ui/card";
import { fmtAmt, type GroupShareRow } from "@/lib/dashboard";

const PALETTE = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--primary))",
  "hsl(var(--info))",
  "hsl(var(--accent))",
];

export function GroupBudgetShare({
  rows,
  totalActual,
  totalBudget,
  unit,
}: {
  rows: GroupShareRow[];
  totalActual: number;
  totalBudget: number;
  unit: string;
}) {
  if (!rows.length) return null;
  const overallUsage = totalBudget !== 0 ? (totalActual / totalBudget) * 100 : 0;

  return (
    <Card className="glass-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-semibold">Budget Share by Entity Group</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Each group's actual vs. its share of total budget · Amount in {unit}
          </p>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-muted-foreground">Overall Actual / Budget</div>
          <div className="text-sm font-semibold tabular-nums">
            {fmtAmt(totalActual)} / {fmtAmt(totalBudget)} {unit}
          </div>
          <div className="text-[11px] text-muted-foreground tabular-nums">
            {overallUsage.toFixed(1)}% used
          </div>
        </div>
      </div>

      {/* Stacked share bar */}
      <div className="mb-4">
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted/40">
          {rows.map((r, i) => (
            <div
              key={r.entityGroup}
              title={`${r.entityGroup} · ${(r.shareOfBudget * 100).toFixed(1)}% of budget`}
              style={{
                width: `${Math.max(0, r.shareOfBudget * 100)}%`,
                background: PALETTE[i % PALETTE.length],
              }}
            />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          {rows.map((r, i) => (
            <span key={r.entityGroup} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
              {r.entityGroup} · {(r.shareOfBudget * 100).toFixed(1)}%
            </span>
          ))}
        </div>
      </div>

      {/* Per-group rows */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {rows.map((r, i) => {
          const color = PALETTE[i % PALETTE.length];
          const usagePct = r.usage * 100;
          const sharePct = r.shareOfBudget * 100;
          const over = r.usage > 1;
          return (
            <div key={r.entityGroup} className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-sm font-medium">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                  {r.entityGroup}
                </span>
                <span
                  className={`text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded ${
                    over
                      ? "bg-[hsl(0_84%_60%/0.15)] text-[hsl(0_84%_60%)]"
                      : "bg-[hsl(142_71%_45%/0.15)] text-[hsl(142_71%_45%)]"
                  }`}
                >
                  {usagePct.toFixed(1)}% used
                </span>
              </div>

              <div className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground tabular-nums">{fmtAmt(r.actual)}</span> {unit} actual
                {" "}vs total budget{" "}
                <span className="font-semibold text-foreground tabular-nums">{fmtAmt(totalBudget)}</span> {unit}
                {" "}— this group takes{" "}
                <span className="font-semibold text-foreground">{sharePct.toFixed(1)}%</span> of the overall budget
                {" "}(group budget {fmtAmt(r.budget)} {unit}).
              </div>

              {/* dual progress: share of total budget vs usage */}
              <div className="mt-2 space-y-1.5">
                <div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                    <span>Share of total budget</span>
                    <span className="tabular-nums">{sharePct.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.min(100, sharePct)}%`, background: color }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                    <span>Usage (Actual / Group Budget)</span>
                    <span className="tabular-nums">{usagePct.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, usagePct)}%`,
                        background: over ? "hsl(0 84% 60%)" : "hsl(142 71% 45%)",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
