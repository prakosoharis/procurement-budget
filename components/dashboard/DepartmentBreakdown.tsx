"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, ChevronDown, TrendingDown, AlertTriangle, CheckCircle2, Lightbulb, Search, Flame } from "lucide-react";
import { fmtAmt, fmtPct, type DeptRow } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

type GroupNode = {
  entityGroup: string;
  totalBudget: number;
  totalActual: number;
  totalRemaining: number;
  entities: Map<string, { entity: string; budget: number; actual: number; remaining: number; depts: DeptRow[] }>;
};

function buildTree(rows: DeptRow[]): GroupNode[] {
  const groups = new Map<string, GroupNode>();
  for (const r of rows) {
    let g = groups.get(r.entityGroup);
    if (!g) {
      g = { entityGroup: r.entityGroup, totalBudget: 0, totalActual: 0, totalRemaining: 0, entities: new Map() };
      groups.set(r.entityGroup, g);
    }
    g.totalBudget += r.budget;
    g.totalActual += r.actual;
    g.totalRemaining += r.remaining;
    let e = g.entities.get(r.entity);
    if (!e) {
      e = { entity: r.entity, budget: 0, actual: 0, remaining: 0, depts: [] };
      g.entities.set(r.entity, e);
    }
    e.budget += r.budget;
    e.actual += r.actual;
    e.remaining += r.remaining;
    e.depts.push(r);
  }
  return Array.from(groups.values()).sort((a, b) => b.totalRemaining - a.totalRemaining);
}

const StatusBadge = ({ s }: { s: DeptRow["status"] }) => {
  const map = {
    over: { cls: "bg-destructive/15 text-destructive", icon: AlertTriangle, label: "Over" },
    "on-track": { cls: "bg-success/15 text-success", icon: CheckCircle2, label: "On track" },
    under: { cls: "bg-primary/15 text-primary", icon: TrendingDown, label: "Under" },
    "no-budget": { cls: "bg-muted text-muted-foreground", icon: AlertTriangle, label: "No budget" },
  } as const;
  const { cls, icon: Icon, label } = map[s];
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium", cls)}>
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
};

export function DepartmentBreakdown({ rows, unit }: { rows: DeptRow[]; unit: string }) {
  const [q, setQ] = useState("");
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [openEntities, setOpenEntities] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"all" | "under" | "over">("all");

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (filter === "under" && r.status !== "under") return false;
      if (filter === "over" && r.status !== "over") return false;
      if (q) {
        const t = q.toLowerCase();
        if (!r.entityGroup.toLowerCase().includes(t) && !r.entity.toLowerCase().includes(t) && !r.fundCenter.toLowerCase().includes(t)) return false;
      }
      return true;
    });
  }, [rows, q, filter]);

  const tree = useMemo(() => buildTree(filtered), [filtered]);

  // Top opportunities: largest under-spent remaining
  const opportunities = useMemo(
    () => rows.filter(r => r.status === "under" && r.budget > 0)
      .sort((a, b) => b.remaining - a.remaining)
      .slice(0, 5),
    [rows]
  );

  // Top over-budget items: biggest absolute overrun
  const overruns = useMemo(
    () => rows.filter(r => r.status === "over")
      .sort((a, b) => (a.remaining) - (b.remaining)) // most negative first
      .slice(0, 5),
    [rows]
  );

  const showUnderPanel = filter === "all" || filter === "under";
  const showOverPanel  = (filter === "all" || filter === "over") && overruns.length > 0;

  const toggleGroup = (k: string) => setOpenGroups(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const toggleEntity = (k: string) => setOpenEntities(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const expandAll = () => {
    setOpenGroups(new Set(tree.map(g => g.entityGroup)));
    const all = new Set<string>();
    tree.forEach(g => g.entities.forEach(e => all.add(`${g.entityGroup}||${e.entity}`)));
    setOpenEntities(all);
  };
  const collapseAll = () => { setOpenGroups(new Set()); setOpenEntities(new Set()); };

  return (
    <Card className="glass-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-semibold">Remaining Budget by Department</h3>
          <p className="text-xs text-muted-foreground">Drill down: Entity Group → Entity → Fund Center · Amount in {unit}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" className="h-8 pl-7 w-44 text-xs" />
          </div>
          {(["all", "under", "over"] as const).map(f => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} className="h-8 text-xs capitalize" onClick={() => setFilter(f)}>
              {f}
            </Button>
          ))}
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={expandAll}>Expand</Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={collapseAll}>Collapse</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        {showUnderPanel && opportunities.length > 0 && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold">Top Under-Budget Opportunities</h4>
              <Badge variant="secondary" className="text-[10px]">Suggested to spend / reallocate</Badge>
            </div>
            <ul className="space-y-1.5 text-xs">
              {opportunities.map((o, i) => (
                <li key={i} className="flex items-start justify-between gap-3 border-t border-border/40 pt-1.5 first:border-0 first:pt-0">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{o.fundCenter} <span className="text-muted-foreground font-normal">· {o.entity} · {o.entityGroup}</span></div>
                    <div className="text-muted-foreground">{o.insight}</div>
                  </div>
                  <div className="text-right shrink-0 font-mono">
                    <div className="text-success font-semibold">{fmtAmt(o.remaining)} {unit}</div>
                    <div className="text-[10px] text-muted-foreground">{fmtPct(o.usage)} used</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {showOverPanel && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Flame className="h-4 w-4 text-destructive" />
              <h4 className="text-sm font-semibold">Top Over-Budget Items</h4>
              <Badge variant="secondary" className="text-[10px]">Investigate / reforecast</Badge>
            </div>
            <ul className="space-y-1.5 text-xs">
              {overruns.map((o, i) => (
                <li key={i} className="flex items-start justify-between gap-3 border-t border-border/40 pt-1.5 first:border-0 first:pt-0">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{o.fundCenter} <span className="text-muted-foreground font-normal">· {o.entity} · {o.entityGroup}</span></div>
                    <div className="text-muted-foreground">{o.insight}</div>
                  </div>
                  <div className="text-right shrink-0 font-mono">
                    <div className="text-destructive font-semibold">{fmtAmt(o.remaining)} {unit}</div>
                    <div className="text-[10px] text-muted-foreground">{o.budget > 0 ? `${fmtPct(o.usage)} used` : "no budget"}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="overflow-auto max-h-[560px] -mx-2">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card/95 backdrop-blur z-10">
            <tr className="text-left text-[10px] uppercase text-muted-foreground tracking-wider">
              <th className="px-2 py-2 font-medium">Department / Entity</th>
              <th className="px-2 py-2 font-medium">Cat</th>
              <th className="px-2 py-2 font-medium text-right">Actual</th>
              <th className="px-2 py-2 font-medium text-right">Budget</th>
              <th className="px-2 py-2 font-medium text-right">Remaining Budget</th>
              <th className="px-2 py-2 font-medium text-right">Usage</th>
              <th className="px-2 py-2 font-medium">Status / Insight</th>
            </tr>
          </thead>
          <tbody>
            {tree.map(g => {
              const gOpen = openGroups.has(g.entityGroup);
              const gUsage = g.totalBudget !== 0 ? g.totalActual / g.totalBudget : 0;
              return (
                <>
                  <tr key={g.entityGroup} className="bg-secondary/40 border-t border-border/50 cursor-pointer" onClick={() => toggleGroup(g.entityGroup)}>
                    <td className="px-2 py-2 font-semibold">
                      <span className="inline-flex items-center gap-1">
                        {gOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        {g.entityGroup}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-xs text-muted-foreground">{g.entities.size} entities</td>
                    <td className="px-2 py-2 text-right font-mono">{fmtAmt(g.totalActual)}</td>
                    <td className="px-2 py-2 text-right font-mono text-muted-foreground">{fmtAmt(g.totalBudget)}</td>
                    <td className={cn("px-2 py-2 text-right font-mono font-semibold", g.totalRemaining < 0 ? "text-destructive" : "text-success")}>{fmtAmt(g.totalRemaining)}</td>
                    <td className="px-2 py-2 text-right font-mono">{fmtPct(gUsage)}</td>
                    <td className="px-2 py-2"></td>
                  </tr>
                  {gOpen && Array.from(g.entities.values()).sort((a, b) => b.remaining - a.remaining).map(e => {
                    const eKey = `${g.entityGroup}||${e.entity}`;
                    const eOpen = openEntities.has(eKey);
                    const eUsage = e.budget !== 0 ? e.actual / e.budget : 0;
                    return (
                      <>
                        <tr key={eKey} className="border-t border-border/30 bg-secondary/15 cursor-pointer hover:bg-secondary/30" onClick={() => toggleEntity(eKey)}>
                          <td className="px-2 py-2 pl-6 font-medium">
                            <span className="inline-flex items-center gap-1">
                              {eOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                              {e.entity}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-xs text-muted-foreground">{e.depts.length} depts</td>
                          <td className="px-2 py-2 text-right font-mono">{fmtAmt(e.actual)}</td>
                          <td className="px-2 py-2 text-right font-mono text-muted-foreground">{fmtAmt(e.budget)}</td>
                          <td className={cn("px-2 py-2 text-right font-mono", e.remaining < 0 ? "text-destructive" : "text-success")}>{fmtAmt(e.remaining)}</td>
                          <td className="px-2 py-2 text-right font-mono">{fmtPct(eUsage)}</td>
                          <td className="px-2 py-2"></td>
                        </tr>
                        {eOpen && e.depts.sort((a, b) => b.remaining - a.remaining).map((d, i) => (
                          <tr key={`${eKey}||${d.fundCenter}||${d.category}||${i}`} className="border-t border-border/20 hover:bg-secondary/20">
                            <td className="px-2 py-1.5 pl-10 truncate max-w-[260px]" title={d.fundCenter}>{d.fundCenter}</td>
                            <td className="px-2 py-1.5"><span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", d.category === "CAPEX" ? "bg-chart-1/15 text-chart-1" : "bg-chart-2/15 text-chart-2")}>{d.category}</span></td>
                            <td className="px-2 py-1.5 text-right font-mono">{fmtAmt(d.actual)}</td>
                            <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">{fmtAmt(d.budget)}</td>
                            <td className={cn("px-2 py-1.5 text-right font-mono", d.remaining < 0 ? "text-destructive" : "text-success")}>{fmtAmt(d.remaining)}</td>
                            <td className="px-2 py-1.5 text-right font-mono">{fmtPct(d.usage)}</td>
                            <td className="px-2 py-1.5">
                              <div className="flex items-center gap-2">
                                <StatusBadge s={d.status} />
                                <span className="text-[11px] text-muted-foreground truncate max-w-[280px]" title={d.insight}>{d.insight}</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </>
                    );
                  })}
                </>
              );
            })}
            {tree.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-muted-foreground text-xs">No departments match the current filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
