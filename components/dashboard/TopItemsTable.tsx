"use client";

import { Card } from "@/components/ui/card";
import { fmtAmt, fmtPct, type TopItemRow } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

export function TopItemsTable({ rows, unit }: { rows: TopItemRow[]; unit: string }) {
  const top = rows.slice(0, 10);
  const max = Math.max(...top.map(r => r.actual), 1);
  const hasAlloc = top.some(r => (r.budgetAlloc ?? 0) !== 0);

  return (
    <Card className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold">Top 10 Highest Spend by Item</h3>
          <p className="text-xs text-muted-foreground">
            Most granular line item (Fund Center) · Actual spend in {unit}
          </p>
        </div>
        <span className="text-xs text-muted-foreground">{rows.length} items</span>
      </div>

      <div className="overflow-auto -mx-2">
        <table className="w-full text-sm">
          <thead className="bg-card/95 backdrop-blur">
            <tr className="text-left text-xs uppercase text-muted-foreground tracking-wider">
              <th className="px-2 py-2 font-medium w-8">#</th>
              <th className="px-2 py-2 font-medium">Item</th>
              <th className="px-2 py-2 font-medium">Group</th>
              <th className="px-2 py-2 font-medium">Entity</th>
              <th className="px-2 py-2 font-medium text-right">CAPEX</th>
              <th className="px-2 py-2 font-medium text-right">OPEX</th>
              <th className="px-2 py-2 font-medium text-right">Actual</th>
              <th className="px-2 py-2 font-medium text-right">Budget</th>
              {hasAlloc && <th className="px-2 py-2 font-medium text-right text-accent">Alloc</th>}
              <th className="px-2 py-2 font-medium text-right">Usage</th>
              {hasAlloc && <th className="px-2 py-2 font-medium text-right text-accent">Use/Alloc</th>}
              <th className="px-2 py-2 font-medium w-[140px]">Share</th>
            </tr>
          </thead>
          <tbody>
            {top.map((r, i) => {
              const usage = r.budget !== 0 ? r.actual / r.budget : 0;
              const over = r.actual > r.budget && r.budget > 0;
              const alloc = r.budgetAlloc ?? 0;
              const usageAlloc = alloc !== 0 ? r.actual / alloc : 0;
              const overAlloc = alloc > 0 && r.actual > alloc;
              const pct = (r.actual / max) * 100;
              return (
                <tr key={i} className="border-t border-border/50 hover:bg-secondary/40 transition-colors">
                  <td className="px-2 py-2.5 font-mono text-muted-foreground">{i + 1}</td>
                  <td className="px-2 py-2.5 font-medium truncate max-w-[200px]" title={r.item}>{r.item}</td>
                  <td className="px-2 py-2.5">
                    <span className="inline-block px-2 py-0.5 rounded-md bg-accent/15 text-accent text-xs font-medium">
                      {r.fundCenterGroup}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-muted-foreground truncate max-w-[200px]" title={`${r.entityGroup} · ${r.entity}`}>
                    <span className="text-primary text-xs">{r.entityGroup}</span> · {r.entity}
                  </td>
                  <td className="px-2 py-2.5 text-right font-mono text-muted-foreground">{fmtAmt(r.capexActual)}</td>
                  <td className="px-2 py-2.5 text-right font-mono text-muted-foreground">{fmtAmt(r.opexActual)}</td>
                  <td className="px-2 py-2.5 text-right font-mono font-semibold">{fmtAmt(r.actual)}</td>
                  <td className="px-2 py-2.5 text-right font-mono text-muted-foreground">{fmtAmt(r.budget)}</td>
                  {hasAlloc && <td className="px-2 py-2.5 text-right font-mono text-accent">{fmtAmt(alloc)}</td>}
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
                  <td className="px-2 py-2.5">
                    <div className="h-2 w-full rounded-full bg-secondary/60 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-accent to-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

