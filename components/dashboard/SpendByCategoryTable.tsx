"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ChevronRight } from "lucide-react";
import {
  fmtAmt,
  categoryEntityBreakdown,
  type CategorySpendRow,
  type Row,
  type Month,
  type DisplayCurrency,
} from "@/lib/dashboard";

const TOP_N = 15;

type Props = {
  rows: CategorySpendRow[];
  unit: string;
  // Drill-down inputs
  sourceRows: Row[];
  periodKey: Month | `YTD ${Month}`;
  display: DisplayCurrency;
  fx: number;
};

export function SpendByCategoryTable({ rows, unit, sourceRows, periodKey, display, fx }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [openCat, setOpenCat] = useState<string | null>(null);

  const nonZero = useMemo(() => rows.filter(r => r.total !== 0), [rows]);
  const grand = useMemo(() => nonZero.reduce((s, r) => s + r.total, 0) || 1, [nonZero]);
  const visible = expanded ? nonZero : nonZero.slice(0, TOP_N);
  const canExpand = nonZero.length > TOP_N;

  const drill = useMemo(
    () => (openCat ? categoryEntityBreakdown(sourceRows, openCat, periodKey, display, fx) : []),
    [openCat, sourceRows, periodKey, display, fx],
  );

  return (
    <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
      <div className="px-5 py-3 border-b border-border/50 flex items-baseline justify-between gap-3 flex-wrap">
        <h3 className="text-base font-semibold tracking-tight">Spending by Category</h3>
        <span className="text-xs text-muted-foreground">
          Actual only · Showing {visible.length} of {nonZero.length} · Click row to drill down · Amount in {unit}
        </span>
      </div>
      <div className={expanded ? "max-h-[600px] overflow-auto" : "overflow-auto"}>
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card/95 backdrop-blur z-10 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border/50">
              <th className="text-left px-3 py-2 w-8">#</th>
              <th className="text-left px-3 py-2">Category</th>
              <th className="text-right px-3 py-2">Capex ({unit})</th>
              <th className="text-right px-3 py-2">Opex ({unit})</th>
              <th className="text-right px-3 py-2">Total ({unit})</th>
              <th className="text-right px-3 py-2">%</th>
              <th className="text-left px-3 py-2 w-[140px]">Share</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => {
              const pct = (r.total / grand) * 100;
              const isOpen = openCat === r.category;
              return (
                <>
                  <tr
                    key={r.category}
                    onClick={() => setOpenCat(isOpen ? null : r.category)}
                    className={`border-b border-border/30 hover:bg-muted/30 cursor-pointer ${isOpen ? "bg-muted/40" : ""}`}
                  >
                    <td className="px-3 py-1.5 text-muted-foreground font-mono">{i + 1}</td>
                    <td className="px-3 py-1.5 font-medium">
                      <span className="inline-flex items-center gap-1">
                        {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-primary" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                        {r.category}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono">{fmtAmt(r.capex)}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{fmtAmt(r.opex)}</td>
                    <td className="px-3 py-1.5 text-right font-mono font-semibold">{fmtAmt(r.total)}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{pct.toFixed(1)}%</td>
                    <td className="px-3 py-1.5">
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr key={`${r.category}-drill`} className="bg-muted/20">
                      <td />
                      <td colSpan={6} className="px-3 py-3">
                        <div className="rounded-lg border border-border/50 bg-card overflow-hidden">
                          <div className="px-3 py-2 border-b border-border/40 text-[11px] text-muted-foreground">
                            Breakdown — <span className="text-foreground font-medium">{r.category}</span> · {drill.length} entities
                          </div>
                          {drill.length === 0 ? (
                            <div className="px-3 py-4 text-center text-muted-foreground text-xs">No entity-level data.</div>
                          ) : (
                            <div className="max-h-72 overflow-auto">
                              <table className="w-full text-[11px]">
                                <thead className="sticky top-0 bg-card text-[10px] uppercase tracking-wider text-muted-foreground">
                                  <tr className="border-b border-border/40">
                                    <th className="text-left px-3 py-1.5">Entity Group</th>
                                    <th className="text-left px-3 py-1.5">Entity</th>
                                    <th className="text-right px-3 py-1.5">Capex</th>
                                    <th className="text-right px-3 py-1.5">Opex</th>
                                    <th className="text-right px-3 py-1.5">Total</th>
                                    <th className="text-right px-3 py-1.5">% of cat</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {drill.map(d => {
                                    const p = (d.total / r.total) * 100;
                                    return (
                                      <tr key={`${d.entityGroup}|${d.entity}`} className="border-b border-border/20 hover:bg-muted/30">
                                        <td className="px-3 py-1 text-muted-foreground">{d.entityGroup}</td>
                                        <td className="px-3 py-1 font-medium">{d.entity}</td>
                                        <td className="px-3 py-1 text-right font-mono">{fmtAmt(d.capex)}</td>
                                        <td className="px-3 py-1 text-right font-mono">{fmtAmt(d.opex)}</td>
                                        <td className="px-3 py-1 text-right font-mono font-semibold">{fmtAmt(d.total)}</td>
                                        <td className="px-3 py-1 text-right font-mono">{p.toFixed(1)}%</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
            {visible.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground text-sm">No data for current filters.</td></tr>
            )}
          </tbody>
          <tfoot className="sticky bottom-0 bg-card/95 backdrop-blur border-t border-border/50">
            <tr className="font-semibold">
              <td className="px-3 py-2" />
              <td className="px-3 py-2">Grand Total {expanded ? "" : `(top ${visible.length})`}</td>
              <td className="px-3 py-2 text-right font-mono">{fmtAmt(visible.reduce((s, r) => s + r.capex, 0))}</td>
              <td className="px-3 py-2 text-right font-mono">{fmtAmt(visible.reduce((s, r) => s + r.opex, 0))}</td>
              <td className="px-3 py-2 text-right font-mono">{fmtAmt(visible.reduce((s, r) => s + r.total, 0))}</td>
              <td className="px-3 py-2 text-right font-mono">{((visible.reduce((s, r) => s + r.total, 0) / grand) * 100).toFixed(1)}%</td>
              <td className="px-3 py-2" />
            </tr>
          </tfoot>
        </table>
      </div>
      {canExpand && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full px-5 py-2 border-t border-border/50 text-xs font-medium text-primary hover:bg-muted/40 transition flex items-center justify-center gap-1.5"
        >
          {expanded ? (
            <>Show top {TOP_N} <ChevronUp className="h-3.5 w-3.5" /></>
          ) : (
            <>Show all {nonZero.length} categories <ChevronDown className="h-3.5 w-3.5" /></>
          )}
        </button>
      )}
    </div>
  );
}
