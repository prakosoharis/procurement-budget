"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronDown, ChevronRight, Sparkles, Loader2 } from "lucide-react";
import { invokeFunction } from "@/lib/functionsClient";
import { fmtAmt, type ParentGroupRow } from "@/lib/dashboard";
import { Button } from "@/components/ui/button";

type Props = {
  groups: ParentGroupRow[];
  unit: string;
  periodLabel: string;
};

export function ProductBudgetPanel({ groups, unit, periodLabel }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState<string>("");
  const [err, setErr] = useState<string>("");

  const totals = useMemo(() => ({
    actual: groups.reduce((s, g) => s + g.actual, 0),
    budget: groups.reduce((s, g) => s + g.budget, 0),
  }), [groups]);

  const analyze = async () => {
    setLoading(true); setErr(""); setInsight("");
    try {
      const TOP_GROUPS = 12;
      const TOP_PRODUCTS = 3;
      const riskyGroups = [...groups].sort((a, b) => {
        const aRisk = (a.variance < 0 ? Math.abs(a.variance) * 4 : 0) + a.actual + (a.pctOfBudget > 1 ? a.actual * 2 : 0);
        const bRisk = (b.variance < 0 ? Math.abs(b.variance) * 4 : 0) + b.actual + (b.pctOfBudget > 1 ? b.actual * 2 : 0);
        return bRisk - aRisk;
      }).slice(0, TOP_GROUPS);
      const payload = {
        period: periodLabel,
        unit,
        totals: {
          actual: +totals.actual.toFixed(2),
          budget: +totals.budget.toFixed(2),
          remaining: +(totals.budget - totals.actual).toFixed(2),
        },
        groupCount: groups.length,
        note: `Risk-focused payload: top ${TOP_GROUPS} categories by overage/spend risk, top ${TOP_PRODUCTS} products each; all other rows are excluded to stay under Groq limits.`,
        groups: riskyGroups.map(g => {
          const sorted = [...g.products].sort((a, b) => b.actual - a.actual);
          const top = sorted.slice(0, TOP_PRODUCTS);
          const rest = sorted.slice(TOP_PRODUCTS);
          const othersActual = rest.reduce((s, p) => s + p.actual, 0);
          const othersBudget = rest.reduce((s, p) => s + p.budget, 0);
          return {
            g: g.group,
            b: +g.budget.toFixed(2),
            a: +g.actual.toFixed(2),
            r: +g.variance.toFixed(2),
            u: +(g.pctOfBudget * 100).toFixed(1),
            pc: g.products.length,
            p: top.map(p => [
              p.product,
              +p.actual.toFixed(2),
              +p.budget.toFixed(2),
              +(p.pctOfBudget * 100).toFixed(1),
            ]),
            ...(rest.length > 0 && {
              o: [rest.length, +othersActual.toFixed(2), +othersBudget.toFixed(2)],
            }),
          };
        }),
      };
      const { data, error } = await invokeFunction<{ content?: string; error?: string }>("budget-insights", { body: { payload } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setInsight(data?.content ?? "");
    } catch (e: any) {
      setErr(e?.message || "Failed to fetch insights");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      {/* Main breakdown table */}
      <div className="xl:col-span-2 rounded-2xl border border-border/50 bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border/50 flex items-baseline justify-between gap-3 flex-wrap">
          <h3 className="text-base font-semibold tracking-tight">Product-Level Budget Breakdown</h3>
          <span className="text-xs text-muted-foreground">
            Actual = {periodLabel} · Budget = full annual · Click a row to expand · {unit}
          </span>
        </div>
        <div className="overflow-auto max-h-[640px]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card/95 backdrop-blur z-10 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border/50">
                <th className="text-left px-3 py-2">Category</th>
                <th className="text-right px-3 py-2">YTD Actual</th>
                <th className="text-right px-3 py-2">Annual Budget</th>
                <th className="text-right px-3 py-2">Remaining Budget</th>
                <th className="text-right px-3 py-2">Util %</th>
                <th className="text-left px-3 py-2 w-[160px]">Usage</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(g => {
                const isOpen = !!open[g.group];
                const util = g.pctOfBudget * 100;
                const over = util > 100;
                return (
                  <>
                    <tr
                      key={g.group}
                      onClick={() => setOpen(o => ({ ...o, [g.group]: !isOpen }))}
                      className={`border-b border-border/30 hover:bg-muted/30 cursor-pointer ${isOpen ? "bg-muted/40" : ""}`}
                    >
                      <td className="px-3 py-2 font-medium">
                        <span className="inline-flex items-center gap-1">
                          {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-primary" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                          {g.group}
                          <span className="ml-2 text-[10px] text-muted-foreground">({g.products.length})</span>
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{fmtAmt(g.actual)}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmtAmt(g.budget)}</td>
                      <td className={`px-3 py-2 text-right font-mono ${g.variance < 0 ? "text-destructive" : ""}`}>{fmtAmt(g.variance)}</td>
                      <td className={`px-3 py-2 text-right font-mono font-semibold ${over ? "text-destructive" : ""}`}>{isFinite(util) ? util.toFixed(1) + "%" : "—"}</td>
                      <td className="px-3 py-2">
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div className={`h-full ${over ? "bg-destructive" : "bg-primary"}`} style={{ width: `${Math.min(100, Math.max(0, util))}%` }} />
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={`${g.group}-x`} className="bg-muted/10">
                        <td colSpan={6} className="px-3 py-3">
                          <div className="rounded-lg border border-border/50 bg-card overflow-hidden">
                            <div className="px-3 py-2 border-b border-border/40 text-[11px] text-muted-foreground">
                              Products in <span className="text-foreground font-medium">{g.group}</span> — bars show % of this category's annual budget consumed YTD
                            </div>
                            <div className="max-h-72 overflow-auto">
                              <table className="w-full text-[11px]">
                                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                  <tr className="border-b border-border/40">
                                    <th className="text-left px-3 py-1.5">Product</th>
                                    <th className="text-right px-3 py-1.5">YTD Actual</th>
                                    <th className="text-right px-3 py-1.5">Annual Budget</th>
                                    <th className="text-right px-3 py-1.5">Util %</th>
                                    <th className="text-left px-3 py-1.5 w-[220px]">% of Category Budget</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {g.products.map(p => {
                                    const pct = p.pctOfParentBudget * 100;
                                    const util2 = p.pctOfBudget * 100;
                                    const over2 = util2 > 100;
                                    return (
                                      <tr key={p.product} className="border-b border-border/20 hover:bg-muted/30">
                                        <td className="px-3 py-1 font-medium">{p.product}</td>
                                        <td className="px-3 py-1 text-right font-mono">{fmtAmt(p.actual)}</td>
                                        <td className="px-3 py-1 text-right font-mono">{fmtAmt(p.budget)}</td>
                                        <td className={`px-3 py-1 text-right font-mono ${over2 ? "text-destructive" : ""}`}>{isFinite(util2) ? util2.toFixed(1) + "%" : "—"}</td>
                                        <td className="px-3 py-1">
                                          <div className="flex items-center gap-2">
                                            <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                                              <div className="h-full bg-info" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
                                            </div>
                                            <span className="font-mono text-[10px] w-10 text-right text-muted-foreground">{pct.toFixed(1)}%</span>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              {groups.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No data.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Insights */}
      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden flex flex-col">
        <div className="px-5 py-3 border-b border-border/50 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-base font-semibold tracking-tight">AI Insights</h3>
          <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">Groq AI</span>
        </div>
        <div className="p-4 flex-1 flex flex-col gap-3 min-h-[320px]">
          <Button
            onClick={analyze}
            disabled={loading || groups.length === 0}
            className="gap-2"
          >
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing…</> : <><Sparkles className="h-4 w-4" /> Analyze Current Budget</>}
          </Button>
          {err && <div className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">{err}</div>}
          {!insight && !err && !loading && (
            <p className="text-xs text-muted-foreground">
              Sends a compact risk-focused summary for {periodLabel} to the AI analyst for cost-saving recommendations.
            </p>
          )}
          {insight && (
            <div className="prose prose-sm dark:prose-invert max-w-none overflow-auto text-sm leading-relaxed
              prose-headings:mt-3 prose-headings:mb-2 prose-h1:text-base prose-h2:text-sm prose-h3:text-sm
              prose-p:my-2 prose-ul:my-2 prose-li:my-0.5 prose-strong:text-foreground">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{insight}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
