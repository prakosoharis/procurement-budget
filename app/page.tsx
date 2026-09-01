"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { StatCard } from "@/components/dashboard/StatCard";
import { MonthlyTrendChart } from "@/components/dashboard/MonthlyTrendChart";
import { FundCenterChart } from "@/components/dashboard/FundCenterChart";
import { EntityBreakdownTable } from "@/components/dashboard/EntityBreakdownTable";
import { ChatPanel } from "@/components/dashboard/ChatPanel";
import { DataActions } from "@/components/dashboard/DataActions";
import { DepartmentBreakdown } from "@/components/dashboard/DepartmentBreakdown";
import { EntityGroupComparison } from "@/components/dashboard/EntityGroupComparison";
import { CumulativeBudgetChart } from "@/components/dashboard/CumulativeBudgetChart";
import { TopSpendTable } from "@/components/dashboard/TopSpendTable";
import { TopItemsTable } from "@/components/dashboard/TopItemsTable";
import { SpendByCategoryTable } from "@/components/dashboard/SpendByCategoryTable";
import { ProductBudgetPanel } from "@/components/dashboard/ProductBudgetPanel";
import { FullYearOutlookPanel } from "@/components/dashboard/FullYearOutlookPanel";
import { ThemeSwitcher } from "@/components/dashboard/ThemeSwitcher";
import { ExportButtons } from "@/components/dashboard/ExportButtons";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Filters, applyFilters, applyFiltersForYear, byEntity, byFundCenter, monthlyTrend, totals, valueKey, unitLabel,
  effectiveDisplay, DEFAULT_FX_USD_TO_IDR, departmentBreakdown, entityGroupYearComparison,
  cumulativeBudgetVsActual, topSpendByGroupEntity, topSpendByItem, spendByCategory, productBreakdown,
  type Row,
} from "@/lib/dashboard";
import { fetchHistoricalUsdIdr } from "@/lib/fxRate";
import { DatasetContext, fetchBudgetRows, uploadBudgetRows, resetBudgetRows } from "@/lib/datasetStore";
import { applyTheme, loadTheme, ThemeName } from "@/lib/theme";
import { Activity, LogOut } from "lucide-react";
import { toast } from "sonner";

export default function Page() {
  const router = useRouter();
  const [rows, setRowsState] = useState<Row[]>([]);
  const [source, setSource] = useState<"default" | "uploaded">("default");
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<ThemeName>(() => loadTheme());

  useEffect(() => { applyTheme(theme); }, [theme]);

  useEffect(() => {
    let cancelled = false;
    fetchBudgetRows()
      .then(({ rows }) => { if (!cancelled) setRowsState(rows); })
      .catch((err) => { console.error(err); toast.error("Failed to load dataset from database."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const uploadRows = useCallback(async (newRows: Row[]) => {
    const { rows } = await uploadBudgetRows(newRows);
    setRowsState(rows);
    setSource("uploaded");
  }, []);

  const resetRows = useCallback(async () => {
    const { rows } = await resetBudgetRows();
    setRowsState(rows);
    setSource("default");
  }, []);

  const refreshRows = useCallback(async () => {
    const { rows } = await fetchBudgetRows();
    setRowsState(rows);
  }, []);

  const ctx = useMemo(() => ({
    rows, loading, source, uploadRows, resetRows, refreshRows,
  }), [rows, loading, source, uploadRows, resetRows, refreshRows]);

  const [filters, setFilters] = useState<Filters>({
    year: 2026,
    entityGroup: "ALL",
    entity: "ALL",
    period: "Mar",
    view: "YTD",
    currencyMode: "IDR",
    displayCurrency: "IDR",
    fx: DEFAULT_FX_USD_TO_IDR,
  });

  // Auto-lock FX to the BI-style historical rate for the selected Year + Month.
  useEffect(() => {
    let cancelled = false;
    fetchHistoricalUsdIdr(filters.year, filters.period, DEFAULT_FX_USD_TO_IDR).then(({ rate }) => {
      if (!cancelled) setFilters(f => ({ ...f, fx: rate }));
    });
    return () => { cancelled = true; };
  }, [filters.year, filters.period]);

  const display = effectiveDisplay(filters);
  const filtered = useMemo(() => applyFilters(rows, filters), [rows, filters]);
  const key = valueKey(filters);
  const unit = unitLabel(display);
  const t = useMemo(() => totals(filtered, key, display, filters.fx), [filtered, key, display, filters.fx]);
  const trend = useMemo(() => monthlyTrend(filtered, display, filters.fx), [filtered, display, filters.fx]);
  const capexFC = useMemo(() => byFundCenter(filtered, key, "CAPEX", display, filters.fx), [filtered, key, display, filters.fx]);
  const opexFC = useMemo(() => byFundCenter(filtered, key, "OPEX", display, filters.fx), [filtered, key, display, filters.fx]);
  const entities = useMemo(() => byEntity(filtered, key, display, filters.fx), [filtered, key, display, filters.fx]);
  const departments = useMemo(() => departmentBreakdown(filtered, key, display, filters.fx), [filtered, key, display, filters.fx]);
  const egYoY = useMemo(() => entityGroupYearComparison(rows, filters, display), [rows, filters, display]);
  const cumCurrent = useMemo(() => cumulativeBudgetVsActual(filtered, display, filters.fx), [filtered, display, filters.fx]);
  const lastYearFiltered = useMemo(() => applyFiltersForYear(rows, filters, filters.year - 1), [rows, filters]);
  const cumLast = useMemo(() => cumulativeBudgetVsActual(lastYearFiltered, display, filters.fx), [lastYearFiltered, display, filters.fx]);
  const topSpend = useMemo(() => topSpendByGroupEntity(filtered, key, display, filters.fx), [filtered, key, display, filters.fx]);
  const topItems = useMemo(() => topSpendByItem(filtered, key, display, filters.fx), [filtered, key, display, filters.fx]);
  const categorySpend = useMemo(() => spendByCategory(filtered, key, display, filters.fx), [filtered, key, display, filters.fx]);
  const productGroups = useMemo(() => productBreakdown(filtered, key, display, filters.fx), [filtered, key, display, filters.fx]);

  const periodLabel = `${filters.view === "YTD" ? "YTD " : ""}${filters.period} ${filters.year}`;

  const modeLabel =
    filters.currencyMode === "IDR" ? "All rows · converted to IDR"
    : filters.currencyMode === "USD" ? "All rows · converted to USD"
    : `All rows · converted to ${filters.displayCurrency}`;

  const onLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  };

  return (
    <DatasetContext.Provider value={ctx}>
      <main className="min-h-screen px-4 md:px-8 py-8 max-w-[1600px] mx-auto">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-info flex items-center justify-center stat-glow">
                <Activity className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Finance · CAPEX OPEX</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              Budget Performance Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {periodLabel} · {modeLabel} · Amount in {unit}
              {filters.currencyMode === "ALL" && <> · USD↔IDR @ {filters.fx.toLocaleString()}</>}
              {source === "uploaded" && <span className="ml-2 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-medium uppercase tracking-wider">Custom data</span>}
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <ThemeSwitcher value={theme} onChange={setTheme} />
              <DataActions />
              <ExportButtons totals={t} entities={entities} unit={unit} periodLabel={periodLabel} />
              <Button onClick={onLogout} size="sm" variant="ghost" className="h-9 gap-2">
                <LogOut className="h-4 w-4" /> Logout
              </Button>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Total Records</div>
              <div className="text-2xl font-bold font-mono">{rows.length.toLocaleString()}</div>
            </div>
          </div>
        </header>

        <div id="dashboard-root">
          <FilterBar filters={filters} setFilters={setFilters} />

          <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <StatCard label="CAPEX" actual={t.capex.actual} budget={t.capex.budget} remaining={t.capex.remaining} budgetAlloc={t.capex.budgetAlloc} remainingAlloc={t.capex.remainingAlloc} unit={unit} accent="primary" />
            <StatCard label="OPEX" actual={t.opex.actual} budget={t.opex.budget} remaining={t.opex.remaining} budgetAlloc={t.opex.budgetAlloc} remainingAlloc={t.opex.remainingAlloc} unit={unit} accent="accent" />
            <StatCard label="Total Capex + Opex" actual={t.total.actual} budget={t.total.budget} remaining={t.total.remaining} budgetAlloc={t.total.budgetAlloc} remainingAlloc={t.total.remainingAlloc} unit={unit} accent="info" />
          </section>

          <Tabs defaultValue="overview" className="mt-6">
            <div className="overflow-x-auto pb-1">
              <TabsList className="h-11 min-w-max border border-border/60 bg-card/70 p-1">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="analysis">Budget Analysis</TabsTrigger>
                <TabsTrigger value="spend">Spend Details</TabsTrigger>
                <TabsTrigger value="ai">Outlook &amp; AI</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview" className="mt-4 space-y-4">
              <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <CumulativeBudgetChart title={`Cumulative Capex ${filters.year}`} points={cumCurrent.capex.points} budgetCeiling={cumCurrent.capex.budgetCeiling} budgetAllocCeiling={cumCurrent.capex.budgetAllocCeiling} unit={unit} period={filters.period} color="hsl(25 95% 55%)" />
                <CumulativeBudgetChart title={`Cumulative Opex ${filters.year}`} points={cumCurrent.opex.points} budgetCeiling={cumCurrent.opex.budgetCeiling} budgetAllocCeiling={cumCurrent.opex.budgetAllocCeiling} unit={unit} period={filters.period} color="hsl(25 95% 55%)" />
                <CumulativeBudgetChart title={`Cumulative Capex + Opex ${filters.year}`} points={cumCurrent.total.points} budgetCeiling={cumCurrent.total.budgetCeiling} budgetAllocCeiling={cumCurrent.total.budgetAllocCeiling} unit={unit} period={filters.period} color="hsl(25 95% 55%)" />
              </section>
              <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <CumulativeBudgetChart title={`Cumulative Capex ${filters.year - 1}`} points={cumLast.capex.points} budgetCeiling={cumLast.capex.budgetCeiling} budgetAllocCeiling={cumLast.capex.budgetAllocCeiling} unit={unit} period={filters.period} color="hsl(210 60% 55%)" />
                <CumulativeBudgetChart title={`Cumulative Opex ${filters.year - 1}`} points={cumLast.opex.points} budgetCeiling={cumLast.opex.budgetCeiling} budgetAllocCeiling={cumLast.opex.budgetAllocCeiling} unit={unit} period={filters.period} color="hsl(210 60% 55%)" />
                <CumulativeBudgetChart title={`Cumulative Capex + Opex ${filters.year - 1}`} points={cumLast.total.points} budgetCeiling={cumLast.total.budgetCeiling} budgetAllocCeiling={cumLast.total.budgetAllocCeiling} unit={unit} period={filters.period} color="hsl(210 60% 55%)" />
              </section>
              <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2"><MonthlyTrendChart data={trend} unit={unit} period={filters.period} /></div>
                <EntityBreakdownTable rows={entities} unit={unit} />
              </section>
            </TabsContent>

            <TabsContent value="analysis" className="mt-4 space-y-4">
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <FundCenterChart title="CAPEX by Fund Center" data={capexFC} color="chart-1" unit={unit} />
                <FundCenterChart title="OPEX by Fund Center" data={opexFC} color="chart-2" unit={unit} />
              </section>
              <ProductBudgetPanel groups={productGroups} unit={unit} periodLabel={periodLabel} />
              <DepartmentBreakdown rows={departments} unit={unit} />
              <EntityGroupComparison rows={egYoY} unit={unit} />
            </TabsContent>

            <TabsContent value="spend" className="mt-4 space-y-4">
              <TopSpendTable rows={topSpend} unit={unit} />
              <TopItemsTable rows={topItems} unit={unit} />
              <SpendByCategoryTable rows={categorySpend} unit={unit} sourceRows={filtered} periodKey={key} display={display} fx={filters.fx} />
            </TabsContent>

            <TabsContent value="ai" className="mt-4 space-y-4">
              <FullYearOutlookPanel rows={filtered} filters={filters} display={display} unit={unit} />
              <ChatPanel context={{
                period: periodLabel, view: filters.view, year: filters.year,
                entityGroup: filters.entityGroup, entity: filters.entity,
                currencyMode: filters.currencyMode, displayCurrency: display,
                fxUsdIdr: filters.fx, unit, totals: t,
                topEntities: entities.slice(0, 8),
                topCapexFundCenters: capexFC.slice(0, 8),
                topOpexFundCenters: opexFC.slice(0, 8),
                topUnderBudgetDepartments: departments.filter(d => d.status === "under" && d.budget > 0).slice(0, 10),
                topOverBudgetDepartments: departments.filter(d => d.status === "over").slice(0, 10),
                note: `Mode=${filters.currencyMode}. Amounts in ${unit}. LVA grouped under CAPEX. USD/IDR=${filters.fx} (BI reference) is used to auto-convert native row currencies.`,
              }} />
            </TabsContent>
          </Tabs>
        </div>

        <footer className="mt-10 pt-6 border-t border-border/50 text-xs text-muted-foreground text-center">
          Built from Database sheet · {rows.length.toLocaleString()} rows · Native row currency preserved (IDR/USD) · FX reference: Bank Indonesia (bi.go.id) JISDOR
        </footer>
      </main>
    </DatasetContext.Provider>
  );
}
