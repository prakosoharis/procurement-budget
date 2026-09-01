"use client";

import { Card } from "@/components/ui/card";
import { fmtAmt, fmtPct } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

type Row = { entity: string; actual: number; budget: number; budgetAlloc?: number };

export function EntityBreakdownTable({ rows, unit }: { rows: Row[]; unit: string }) {
  const hasAlloc = rows.some(r => (r.budgetAlloc ?? 0) !== 0);
  return (
    <Card className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold">Entity Breakdown</h3>
          <p className="text-xs text-muted-foreground">Actual vs Budget{hasAlloc ? " vs Budget After Allocation" : ""} · {unit}</p>
        </div>
        <span className="text-xs text-muted-foreground">{rows.length} entities</span>
      </div>
      <div className="overflow-auto max-h-[380px] -mx-2">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card/95 backdrop-blur z-10">
            <tr className="text-left text-xs uppercase text-muted-foreground tracking-wider">
              <th className="px-2 py-2 font-medium">Entity</th>
              <th className="px-2 py-2 font-medium text-right">Actual</th>
              <th className="px-2 py-2 font-medium text-right">Budget</th>
              {hasAlloc && <th className="px-2 py-2 font-medium text-right text-accent">Alloc</th>}
              <th className="px-2 py-2 font-medium text-right">Remaining Budget</th>
              <th className="px-2 py-2 font-medium text-right">Usage</th>
              {hasAlloc && <th className="px-2 py-2 font-medium text-right text-accent">Use/Alloc</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const usage = r.budget !== 0 ? r.actual / r.budget : 0;
              const over = r.budget - r.actual < 0;
              const alloc = r.budgetAlloc ?? 0;
              const usageAlloc = alloc !== 0 ? r.actual / alloc : 0;
              const overAlloc = alloc - r.actual < 0;
              return (
                <tr key={r.entity} className="border-t border-border/50 hover:bg-secondary/40 transition-colors">
                  <td className="px-2 py-2.5 font-medium truncate max-w-[200px]" title={r.entity}>{r.entity}</td>
                  <td className="px-2 py-2.5 text-right font-mono">{fmtAmt(r.actual)}</td>
                  <td className="px-2 py-2.5 text-right font-mono text-muted-foreground">{fmtAmt(r.budget)}</td>
                  {hasAlloc && <td className="px-2 py-2.5 text-right font-mono text-accent">{fmtAmt(alloc)}</td>}
                  <td className={cn("px-2 py-2.5 text-right font-mono", over ? "text-destructive" : "text-success")}>
                    {fmtAmt(r.budget - r.actual)}
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <span className={cn("inline-block px-2 py-0.5 rounded-full text-xs font-medium",
                      over ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary")}>
                      {fmtPct(usage)}
                    </span>
                  </td>
                  {hasAlloc && (
                    <td className="px-2 py-2.5 text-right">
                      <span className={cn("inline-block px-2 py-0.5 rounded-full text-xs font-medium",
                        overAlloc ? "bg-destructive/15 text-destructive" : "bg-accent/15 text-accent")}>
                        {alloc !== 0 ? fmtPct(usageAlloc) : "—"}
                      </span>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
