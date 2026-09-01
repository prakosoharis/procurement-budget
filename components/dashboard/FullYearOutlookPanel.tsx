"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { fmtAmt, MONTHS, toDisplay, type DisplayCurrency, type Filters, type Row } from "@/lib/dashboard";
import { AlertTriangle, CheckCircle2, Download, Scissors, ExternalLink, Activity } from "lucide-react";

type Sector = "Tech" | "Finance" | "Mining";

const BENCHMARKS: Record<Sector, { pct: number; text: string; link: string; label: string; action: string }> = {
  Tech: {
    pct: 0.075,
    text: "Standard IT allocation ranges from 6-9%.",
    link: "https://itbudgetcalculator.com/by-industry",
    label: "Source: Peer Benchmarks",
    action: "Run a cloud cost review (right-size instances, reserved capacity, idle workloads).",
  },
  Finance: {
    pct: 0.085,
    text: "Financial institutions allocate 7-10% due to cybersecurity/compliance.",
    link: "https://itbudgetcalculator.com/financial-services-it-budget",
    label: "Source: Financial Budget Data",
    action: "Consolidate overlapping compliance / security tools and renegotiate enterprise licenses.",
  },
  Mining: {
    pct: 0.035,
    text: "Heavy operations operate with lower IT footprints, averaging 2-5%.",
    link: "https://itbudgetcalculator.com/by-industry",
    label: "Source: Industrial Key Metrics",
    action: "Audit site infrastructure (network, SCADA integration) and defer non-critical CAPEX.",
  },
};

// IDX-listed reference companies. Revenue = FY2023 top-line (bn IDR, approx from published financials).
// Used to auto-fill the "revenue" input so users can benchmark against real Indonesian peers.
type PresetKey = "BSIM" | "GEMS" | "BBCA" | "CUSTOM";
const PRESETS: Record<Exclude<PresetKey, "CUSTOM">, {
  name: string; ticker: string; sector: Sector; revenueBnIDR: number; note: string; source: string;
}> = {
  BSIM: {
    name: "Bank Sinarmas", ticker: "BSIM.JK", sector: "Finance", revenueBnIDR: 5_300,
    note: "FY2023 total operating income ≈ IDR 5.3 T",
    source: "https://www.idx.co.id/en/listed-companies/company-profiles",
  },
  GEMS: {
    name: "Golden Energy Mines", ticker: "GEMS.JK", sector: "Mining", revenueBnIDR: 33_900,
    note: "FY2023 revenue ≈ USD 2.19 B (~IDR 33.9 T)",
    source: "https://www.idx.co.id/en/listed-companies/company-profiles",
  },
  BBCA: {
    name: "Bank Central Asia", ticker: "BBCA.JK", sector: "Finance", revenueBnIDR: 113_000,
    note: "FY2023 operating income ≈ IDR 113 T",
    source: "https://www.idx.co.id/en/listed-companies/company-profiles",
  },
};

type Props = {
  rows: Row[];        // already filtered rows for current year + entity filters
  filters: Filters;
  display: DisplayCurrency;
  unit: string;
};

export function FullYearOutlookPanel({ rows, filters, display, unit }: Props) {
  const [preset, setPreset] = useState<PresetKey>("BSIM");
  const [sector, setSector] = useState<Sector>(PRESETS.BSIM.sector);
  // revenue is stored in bn IDR (the dashboard's native unit); converted only for display when unit differs.
  const [revenueBnIDR, setRevenueBnIDR] = useState<number>(PRESETS.BSIM.revenueBnIDR);
  const [simulateCut, setSimulateCut] = useState(false);

  const applyPreset = (key: PresetKey) => {
    setPreset(key);
    if (key !== "CUSTOM") {
      setSector(PRESETS[key].sector);
      setRevenueBnIDR(PRESETS[key].revenueBnIDR);
    }
  };
  const activePreset = preset !== "CUSTOM" ? PRESETS[preset] : null;
  const revenue = revenueBnIDR; // already in bn IDR; dashboard unit is bn IDR too


  const monthIdx = MONTHS.indexOf(filters.period);
  const periodKeyYTD = `YTD ${filters.period}` as const;
  const yearBudgetKey = "YTD Dec" as const;

  const calc = useMemo(() => {
    let ytdActual = 0, ytdBudgetThroughPeriod = 0, fullYearBudget = 0;
    for (const r of rows) {
      const cat = (r["Capex / Opex"] || "").toUpperCase().trim();
      if (cat !== "OPEX" && cat !== "CAPEX" && cat !== "LVA") continue;
      if (r["Act/Budget"] === "Actual") {
        ytdActual += toDisplay(Number(r[periodKeyYTD]) || 0, r.Currency, display, filters.fx);
      } else if (r["Act/Budget"] === "Budget") {
        ytdBudgetThroughPeriod += toDisplay(Number(r[periodKeyYTD]) || 0, r.Currency, display, filters.fx);
        fullYearBudget += toDisplay(Number(r[yearBudgetKey]) || 0, r.Currency, display, filters.fx);
      }
    }
    const remainingBudget = Math.max(0, fullYearBudget - ytdBudgetThroughPeriod);
    let projected = ytdActual + remainingBudget;
    if (simulateCut) projected = projected * 0.9;
    const variance = fullYearBudget - projected; // + buffer / - overrun
    const overspend = projected > fullYearBudget;
    return { ytdActual, remainingBudget, fullYearBudget, projected, variance, overspend };
  }, [rows, periodKeyYTD, display, filters.fx, simulateCut]);

  const benchmark = BENCHMARKS[sector];
  const spendPctRevenue = revenue > 0 ? calc.projected / revenue : 0;
  const overBenchmark = spendPctRevenue > benchmark.pct;
  const risk = calc.overspend || overBenchmark;

  const dialPct = Math.min(1.5, spendPctRevenue / benchmark.pct); // 1.0 = at benchmark

  const exportReport = () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      period: `YTD ${filters.period} ${filters.year}`,
      sector, revenue, unit,
      benchmarkPct: benchmark.pct,
      spendPctRevenue,
      ytdActual: calc.ytdActual,
      remainingBudget: calc.remainingBudget,
      fullYearBudget: calc.fullYearBudget,
      projectedFullYear: calc.projected,
      variance: calc.variance,
      overspend: calc.overspend,
      overBenchmark,
      simulateCutApplied: simulateCut,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `outlook-${filters.year}-${filters.period}-${sector}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  const riskTone = risk
    ? "border-destructive/40 bg-destructive/5"
    : "border-success/40 bg-success/5";

  return (
    <Card className="glass-card p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success" />
            </span>
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Full-Year Outlook</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight">AI Executive Copilot</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Projected FY spend = YTD {filters.period} actual + remaining budget · benchmark against sector peers
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={preset} onValueChange={(v) => applyPreset(v as PresetKey)}>
            <SelectTrigger className="w-[220px] h-9"><SelectValue placeholder="IDX peer" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="BSIM">BSIM · Bank Sinarmas (Finance)</SelectItem>
              <SelectItem value="BBCA">BBCA · Bank Central Asia (Finance)</SelectItem>
              <SelectItem value="GEMS">GEMS · Golden Energy Mines (Mining)</SelectItem>
              <SelectItem value="CUSTOM">Custom peer…</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sector} onValueChange={(v) => { setSector(v as Sector); setPreset("CUSTOM"); }}>
            <SelectTrigger className="w-[130px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Tech">Tech</SelectItem>
              <SelectItem value="Finance">Finance</SelectItem>
              <SelectItem value="Mining">Mining</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">Revenue (bn IDR)</span>
            <Input
              type="number"
              value={revenueBnIDR}
              onChange={(e) => { setRevenueBnIDR(Number(e.target.value) || 0); setPreset("CUSTOM"); }}
              className="w-32 h-9"
            />
          </div>
        </div>
      </div>

      {activePreset && (
        <div className="-mt-2 text-[11px] text-muted-foreground flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
            {activePreset.ticker}
          </span>
          <span>{activePreset.name} · {activePreset.note}</span>
          <a href={activePreset.source} target="_blank" rel="noreferrer"
             className="inline-flex items-center gap-1 text-primary hover:underline">
            <ExternalLink className="h-3 w-3" /> IDX profile
          </a>
        </div>
      )}


      {/* Metric cards */}
      <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-3 rounded-xl border p-4 transition-colors", riskTone)}>
        <MetricTile
          label="Projected Full-Year Spend"
          value={calc.projected}
          unit={unit}
          tone={risk ? "risk" : "ok"}
          hint={simulateCut ? "with 10% cut applied" : "YTD actual + remaining budget"}
        />
        <MetricTile
          label="Static Whole-Year Budget"
          value={calc.fullYearBudget}
          unit={unit}
          tone="neutral"
          hint="Annual approved (fixed)"
        />
        <div className="flex flex-col justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Variance</div>
            <div className={cn("text-2xl font-bold font-mono mt-1", risk ? "text-destructive" : "text-success")}>
              {fmtAmt(calc.variance)} <span className="text-xs font-normal text-muted-foreground">{unit}</span>
            </div>
          </div>
          <span className={cn(
            "self-start mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider",
            risk ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success"
          )}>
            {risk ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
            {risk ? "Overspend Risk" : `Within Budget · ${fmtAmt(calc.variance)} ${unit} buffer`}
          </span>
        </div>
      </div>

      {/* Dial + Copilot text grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Dial */}
        <div className="lg:col-span-2 rounded-xl border border-border/60 p-4 flex flex-col items-center justify-center bg-card/40">
          <DialGauge pct={dialPct} risk={overBenchmark} />
          <div className="text-center mt-2">
            <div className="text-2xl font-bold font-mono">{(spendPctRevenue * 100).toFixed(2)}%</div>
            <div className="text-xs text-muted-foreground">IT spend / revenue · target {(benchmark.pct * 100).toFixed(1)}%</div>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-3 leading-relaxed">{benchmark.text}</p>
          <a href={benchmark.link} target="_blank" rel="noreferrer"
             className="mt-2 inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
            <ExternalLink className="h-3 w-3" /> {benchmark.label}
          </a>
        </div>

        {/* Copilot text */}
        <div className="lg:col-span-3 rounded-xl border border-border/60 bg-card/40 backdrop-blur p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">AI Copilot Insights</span>
            <span className="relative flex h-2 w-2 ml-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
            </span>
          </div>

          <InsightBlock
            icon="🚨"
            title="Priority Alert"
            tone={risk ? "risk" : "ok"}
            body={
              risk
                ? (calc.overspend
                    ? `Projected FY spend of ${fmtAmt(calc.projected)} ${unit} exceeds approved budget of ${fmtAmt(calc.fullYearBudget)} ${unit}.`
                    : `IT spend at ${(spendPctRevenue * 100).toFixed(2)}% of revenue is above the ${sector} benchmark of ${(benchmark.pct * 100).toFixed(1)}%.`)
                : `On track: projected FY spend within budget and at ${(spendPctRevenue * 100).toFixed(2)}% of revenue (target ≤ ${(benchmark.pct * 100).toFixed(1)}%).`
            }
          />

          <InsightBlock
            icon="📊"
            title="Efficiency Metric"
            body={
              <ul className="list-disc pl-4 space-y-1">
                <li>IT spend / revenue: <b>{(spendPctRevenue * 100).toFixed(2)}%</b> vs {sector} peer avg <b>{(benchmark.pct * 100).toFixed(1)}%</b> ({overBenchmark ? "above" : "within"} target).</li>
                <li>Budget utilization projected: <b>{calc.fullYearBudget ? ((calc.projected / calc.fullYearBudget) * 100).toFixed(1) : "0.0"}%</b> of annual.</li>
                <li>Remaining budget headroom: <b>{fmtAmt(calc.remainingBudget)} {unit}</b>.</li>
              </ul>
            }
          />

          <InsightBlock
            icon="📈"
            title="Recommendation"
            body={benchmark.action}
          />

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              size="sm"
              variant={simulateCut ? "default" : "outline"}
              onClick={() => setSimulateCut(v => !v)}
            >
              <Scissors className="h-3.5 w-3.5 mr-1.5" />
              {simulateCut ? "Cut Applied · Reset" : "Simulate Budget Cut 10%"}
            </Button>
            <Button size="sm" variant="outline" onClick={exportReport}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export Insight Report
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function MetricTile({ label, value, unit, tone, hint }: {
  label: string; value: number; unit: string; tone: "risk" | "ok" | "neutral"; hint?: string;
}) {
  const toneClass = tone === "risk" ? "text-destructive"
    : tone === "ok" ? "text-success"
    : "text-foreground";
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("text-2xl font-bold font-mono mt-1", toneClass)}>
        {fmtAmt(value)} <span className="text-xs font-normal text-muted-foreground">{unit}</span>
      </div>
      {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function InsightBlock({ icon, title, body, tone }: {
  icon: string; title: string; body: React.ReactNode; tone?: "risk" | "ok";
}) {
  return (
    <div className={cn(
      "rounded-lg p-3 border text-sm leading-relaxed",
      tone === "risk" ? "border-destructive/30 bg-destructive/5"
      : tone === "ok" ? "border-success/30 bg-success/5"
      : "border-border/50 bg-background/40"
    )}>
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
        <span className="mr-1">{icon}</span>{title}
      </div>
      <div className="text-foreground">{body}</div>
    </div>
  );
}

function DialGauge({ pct, risk }: { pct: number; risk: boolean }) {
  // pct = 1.0 means at benchmark; clamp 0..1.5
  const clamped = Math.max(0, Math.min(1.5, pct));
  // Semi-circle from -90deg to +90deg. Map 0..1.5 -> -90..+90
  const angle = -90 + (clamped / 1.5) * 180;
  const color = risk ? "hsl(var(--destructive))" : "hsl(var(--success))";
  return (
    <svg viewBox="0 0 200 120" className="w-full max-w-[240px]">
      {/* Track */}
      <path d="M20,110 A80,80 0 0,1 180,110" fill="none" stroke="hsl(var(--muted))" strokeWidth="14" strokeLinecap="round" />
      {/* Zones */}
      <path d="M20,110 A80,80 0 0,1 100,30" fill="none" stroke="hsl(var(--success) / 0.7)" strokeWidth="14" strokeLinecap="round" />
      <path d="M100,30 A80,80 0 0,1 140,42" fill="none" stroke="hsl(var(--warning) / 0.8)" strokeWidth="14" strokeLinecap="round" />
      <path d="M140,42 A80,80 0 0,1 180,110" fill="none" stroke="hsl(var(--destructive) / 0.8)" strokeWidth="14" strokeLinecap="round" />
      {/* Needle */}
      <g transform={`rotate(${angle} 100 110)`}>
        <line x1="100" y1="110" x2="100" y2="40" stroke={color} strokeWidth="3" strokeLinecap="round" />
        <circle cx="100" cy="110" r="6" fill={color} />
      </g>
      <text x="100" y="108" textAnchor="middle" className="fill-muted-foreground" fontSize="10">
        target = 1.0×
      </text>
    </svg>
  );
}
