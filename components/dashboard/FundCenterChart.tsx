"use client";

import { Card } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { fmtAmt } from "@/lib/dashboard";

type Item = { name: string; actual: number; budget: number; budgetAlloc?: number; remaining: number };

export function FundCenterChart({ title, data, color, unit }: { title: string; data: Item[]; color: string; unit: string }) {
  const top = data.slice(0, 12);
  const hasAlloc = top.some(d => (d.budgetAlloc ?? 0) !== 0);
  return (
    <Card className="glass-card p-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-base font-semibold">{title}</h3>
        <span className="text-xs text-muted-foreground">Top {top.length}</span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">Amount in {unit} · Actual vs Budget vs Budget After Allocation</p>
      <div className="h-[420px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={top} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid stroke="hsl(var(--border))" horizontal={false} />
            <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={fmtAmt} />
            <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={140}
              tickFormatter={(v: string) => v.length > 22 ? v.slice(0, 20) + "…" : v} />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
              formatter={(v: number, n) => [fmtAmt(v) + " " + unit, n]}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
            <Bar dataKey="budget" name="Budget" fill={`hsl(var(--${color}) / 0.35)`} radius={[0,6,6,0]} />
            {hasAlloc && <Bar dataKey="budgetAlloc" name="After Allocation" fill="hsl(var(--accent) / 0.75)" radius={[0,6,6,0]} />}
            <Bar dataKey="actual" name="Actual" fill={`hsl(var(--${color}))`} radius={[0,6,6,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

