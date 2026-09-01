// Client-side industry benchmark dictionary for IT spend.
// Sources: Gartner IT Key Metrics Data, Deloitte CIO Survey, Flexera State of Tech Spend.
// Percentages express IT operating spend as share of revenue (industry median).

export type IndustryKey = "mining" | "multifinance" | "tech" | "banking" | "manufacturing";

export type Benchmark = {
  key: IndustryKey;
  label: string;
  itSpendPctOfRevenue: number;    // median
  capexShareOfIt: number;          // typical CAPEX / (CAPEX+OPEX)
  opexShareOfIt: number;
  utilizationTarget: number;       // healthy YTD-vs-plan burn (e.g. 0.90 for Q3)
  source: string;
  sourceUrl: string;
};

export const BENCHMARKS: Record<IndustryKey, Benchmark> = {
  mining: {
    key: "mining",
    label: "Mining & Resources",
    itSpendPctOfRevenue: 0.035,
    capexShareOfIt: 0.55,
    opexShareOfIt: 0.45,
    utilizationTarget: 0.92,
    source: "Gartner IT Key Metrics – Natural Resources",
    sourceUrl: "https://www.gartner.com/en/documents/it-key-metrics-data",
  },
  multifinance: {
    key: "multifinance",
    label: "Multifinance / NBFI",
    itSpendPctOfRevenue: 0.085,
    capexShareOfIt: 0.40,
    opexShareOfIt: 0.60,
    utilizationTarget: 0.95,
    source: "Deloitte Global CIO Survey – Financial Services",
    sourceUrl: "https://www2.deloitte.com/global-cio-survey",
  },
  banking: {
    key: "banking",
    label: "Banking",
    itSpendPctOfRevenue: 0.078,
    capexShareOfIt: 0.42,
    opexShareOfIt: 0.58,
    utilizationTarget: 0.95,
    source: "Gartner IT Key Metrics – Banking & Financial Services",
    sourceUrl: "https://www.gartner.com/en/documents/it-key-metrics-data",
  },
  tech: {
    key: "tech",
    label: "Technology / SaaS",
    itSpendPctOfRevenue: 0.075,
    capexShareOfIt: 0.30,
    opexShareOfIt: 0.70,
    utilizationTarget: 0.90,
    source: "Flexera State of Tech Spend",
    sourceUrl: "https://www.flexera.com/about-us/press-center/state-of-tech-spend",
  },
  manufacturing: {
    key: "manufacturing",
    label: "Manufacturing",
    itSpendPctOfRevenue: 0.025,
    capexShareOfIt: 0.50,
    opexShareOfIt: 0.50,
    utilizationTarget: 0.90,
    source: "Gartner IT Key Metrics – Manufacturing",
    sourceUrl: "https://www.gartner.com/en/documents/it-key-metrics-data",
  },
};

export const INDUSTRY_LIST = Object.values(BENCHMARKS);

/** Build a tiny (token-cheap) summary comparing user metrics to a chosen benchmark. */
export function buildBenchmarkDelta(input: {
  capexActual: number; capexBudget: number;
  opexActual: number; opexBudget: number;
  unit: string;
  industry: IndustryKey;
}) {
  const b = BENCHMARKS[input.industry];
  const totalActual = input.capexActual + input.opexActual;
  const totalBudget = input.capexBudget + input.opexBudget;
  const utilization = totalBudget > 0 ? totalActual / totalBudget : 0;
  const capexShare = totalActual > 0 ? input.capexActual / totalActual : 0;
  const opexShare = totalActual > 0 ? input.opexActual / totalActual : 0;
  const round = (n: number, d = 3) => Number(n.toFixed(d));
  return {
    industry: b.key,
    unit: input.unit,
    user: {
      actual: round(totalActual, 2),
      budget: round(totalBudget, 2),
      util: round(utilization),
      capexShare: round(capexShare),
      opexShare: round(opexShare),
    },
    benchmark: {
      utilTarget: b.utilizationTarget,
      capexShare: b.capexShareOfIt,
      opexShare: b.opexShareOfIt,
      itPctRevenue: b.itSpendPctOfRevenue,
    },
    delta: {
      util: round(utilization - b.utilizationTarget),
      capexShare: round(capexShare - b.capexShareOfIt),
      opexShare: round(opexShare - b.opexShareOfIt),
    },
    source: { name: b.source, url: b.sourceUrl },
  };
}
