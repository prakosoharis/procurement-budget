"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Filters, MONTHS, unique } from "@/lib/dashboard";
import { useDataset } from "@/lib/datasetStore";
import { fetchHistoricalUsdIdr } from "@/lib/fxRate";
import { useMemo, useState } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function FilterBar({ filters, setFilters }: { filters: Filters; setFilters: (f: Filters) => void }) {
  const { rows } = useDataset();
  const years = useMemo(() => unique(rows.map(d => d.Year)).sort(), [rows]);
  const groups = useMemo(() => unique(rows.map(d => d["Entity Group"])).sort(), [rows]);
  const entities = useMemo(() => {
    const filtered = filters.entityGroup === "ALL"
      ? rows
      : rows.filter(d => d["Entity Group"] === filters.entityGroup);
    return unique(filtered.map(d => d.Entity)).sort();
  }, [filters.entityGroup, rows]);

  const [fxLoading, setFxLoading] = useState(false);
  const set = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch });

  const refreshFx = async () => {
    setFxLoading(true);
    const r = await fetchHistoricalUsdIdr(filters.year, filters.period, filters.fx);
    setFxLoading(false);
    set({ fx: r.rate });
    toast.success(`USD/IDR ${r.rate.toLocaleString()} · ${r.source}${r.date ? " · " + r.date : ""}`);
  };

  return (
    <div className="glass-card rounded-2xl p-4 flex flex-wrap items-center gap-3">
      <Tabs value={filters.view} onValueChange={(v) => set({ view: v as "MTD" | "YTD" })}>
        <TabsList className="bg-secondary/60">
          <TabsTrigger value="MTD" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">MTD</TabsTrigger>
          <TabsTrigger value="YTD" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">YTD</TabsTrigger>
        </TabsList>
      </Tabs>

      <Tabs value={filters.currencyMode} onValueChange={(v) => set({ currencyMode: v as Filters["currencyMode"] })}>
        <TabsList className="bg-secondary/60">
          <TabsTrigger value="IDR" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">IDR converted</TabsTrigger>
          <TabsTrigger value="USD" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">USD converted</TabsTrigger>
          <TabsTrigger value="ALL" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">All (converted)</TabsTrigger>
        </TabsList>
      </Tabs>

      {filters.currencyMode === "ALL" && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/60 border border-border">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Show in</span>
          <Tabs value={filters.displayCurrency} onValueChange={(v) => set({ displayCurrency: v as "IDR" | "USD" })}>
            <TabsList className="h-7 bg-background/60">
              <TabsTrigger value="IDR" className="h-6 px-2 text-xs">IDR</TabsTrigger>
              <TabsTrigger value="USD" className="h-6 px-2 text-xs">USD</TabsTrigger>
            </TabsList>
          </Tabs>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground ml-2">USD/IDR</span>
          <Input
            type="number"
            value={filters.fx}
            onChange={(e) => set({ fx: Math.max(1, Number(e.target.value) || 0) })}
            className="h-7 w-24 bg-background/60 text-xs font-mono"
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={refreshFx}
            disabled={fxLoading}
            title="Refresh from BI reference"
            className="h-7 px-2"
          >
            {fxLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          </Button>
        </div>
      )}

      <div className="h-8 w-px bg-border mx-1" />

      <FilterField label="Year">
        <Select value={String(filters.year)} onValueChange={(v) => set({ year: Number(v) })}>
          <SelectTrigger className="w-[110px] h-9 bg-secondary/60 border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Period">
        <Select value={filters.period} onValueChange={(v) => set({ period: v as Filters["period"] })}>
          <SelectTrigger className="w-[110px] h-9 bg-secondary/60 border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Entity Group">
        <Select value={filters.entityGroup} onValueChange={(v) => set({ entityGroup: v, entity: "ALL" })}>
          <SelectTrigger className="w-[150px] h-9 bg-secondary/60 border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Groups</SelectItem>
            {groups.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Entity">
        <Select value={filters.entity} onValueChange={(v) => set({ entity: v })}>
          <SelectTrigger className="w-[230px] h-9 bg-secondary/60 border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Entities</SelectItem>
            {entities.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterField>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
      {children}
    </div>
  );
}
