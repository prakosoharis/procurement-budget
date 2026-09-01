"use client";

import { Card } from "@/components/ui/card";
import { fmtAmt, fmtPct } from "@/lib/dashboard";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  actual: number;
  budget: number;
  remaining: number;
  budgetAlloc?: number;
  remainingAlloc?: number;
  unit: string;
  accent?: "primary" | "accent" | "info";
};

export function StatCard({ label, actual, budget, remaining, budgetAlloc, remainingAlloc, unit, accent = "primary" }: Props) {
  const usage = budget !== 0 ? actual / budget : 0;
  const over = remaining < 0;
  const Icon = over ? TrendingUp : usage > 0 ? TrendingDown : Minus;

  const hasAlloc = typeof budgetAlloc === "number";
  const usageAlloc = hasAlloc && budgetAlloc !== 0 ? actual / budgetAlloc : 0;
  const overAlloc = hasAlloc && (remainingAlloc ?? 0) < 0;

  const accentClass = {
    primary: "from-primary/30 to-transparent",
    accent: "from-accent/30 to-transparent",
    info: "from-info/30 to-transparent",
  }[accent];

  const dotClass = {
    primary: "bg-primary shadow-[0_0_20px_hsl(var(--primary))]",
    accent: "bg-accent shadow-[0_0_20px_hsl(var(--accent))]",
    info: "bg-info shadow-[0_0_20px_hsl(var(--info))]",
  }[accent];

  return (
    <Card className="glass-card relative overflow-hidden p-6">
      <div className={cn("absolute -top-12 -right-12 h-40 w-40 rounded-full bg-gradient-to-br blur-2xl opacity-60", accentClass)} />
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full", dotClass)} />
            <span className="text-sm font-medium text-muted-foreground tracking-wide uppercase">{label}</span>
          </div>
          <span className={cn(
            "flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full",
            over ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success"
          )}>
            <Icon className="h-3 w-3" />
            {fmtPct(usage)}
          </span>
        </div>

        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-3xl font-bold tracking-tight">{fmtAmt(actual)}</span>
          <span className="text-xs text-muted-foreground">/ {fmtAmt(budget)} {unit}</span>
        </div>

        <div className="mt-4 space-y-2">
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", over ? "bg-destructive" : "bg-gradient-to-r from-primary to-primary-glow")}
              style={{ width: `${Math.min(100, Math.max(0, usage * 100))}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Remaining vs Budget</span>
            <span className={cn("font-mono font-medium", over ? "text-destructive" : "text-foreground")}>
              {fmtAmt(remaining)} {unit}
            </span>
          </div>

          {hasAlloc && (
            <div className="pt-2 mt-2 border-t border-border/50 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="uppercase tracking-wider text-accent font-medium">Budget After Allocation</span>
                <span className={cn(
                  "font-mono font-semibold px-1.5 py-0.5 rounded",
                  overAlloc ? "bg-destructive/15 text-destructive" : "bg-accent/15 text-accent"
                )}>
                  {fmtPct(usageAlloc)}
                </span>
              </div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", overAlloc ? "bg-destructive" : "bg-accent")}
                  style={{ width: `${Math.min(100, Math.max(0, usageAlloc * 100))}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Alloc {fmtAmt(budgetAlloc ?? 0)} · Remaining</span>
                <span className={cn("font-mono", overAlloc ? "text-destructive" : "text-foreground")}>
                  {fmtAmt(remainingAlloc ?? 0)} {unit}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
