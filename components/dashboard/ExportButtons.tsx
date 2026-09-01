"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Presentation, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { fmtAmt, fmtPct } from "@/lib/dashboard";

type Totals = {
  capex: { actual: number; budget: number; remaining: number };
  opex: { actual: number; budget: number; remaining: number };
  total: { actual: number; budget: number; remaining: number };
};
type EntityRow = { entity: string; actual: number; budget: number };

type Props = {
  totals: Totals;
  entities: EntityRow[];
  unit: string;
  periodLabel: string;
  captureElementId?: string;
};

const dateStamp = () => new Date().toISOString().slice(0, 10);

const NAVY = "#1E2761";
const ACCENT = "#F96167";
const LIGHT = "#F5F7FB";
const DARK = "#0F172A";
const MUTED = "#64748B";
const BORDER = "#E2E8F0";
const RED = "#B91C1C";
const GREEN = "#047857";

export function ExportButtons({ totals, entities, unit, periodLabel }: Props) {
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pptLoading, setPptLoading] = useState(false);

  const insights = (() => {
    const util = totals.total.budget > 0 ? totals.total.actual / totals.total.budget : 0;
    const capexUtil = totals.capex.budget > 0 ? totals.capex.actual / totals.capex.budget : 0;
    const opexUtil = totals.opex.budget > 0 ? totals.opex.actual / totals.opex.budget : 0;
    const over = totals.total.remaining < 0;
    const worst = [...entities].sort((a, b) => (a.budget - a.actual) - (b.budget - b.actual)).slice(0, 3);
    const best = [...entities].sort((a, b) => (b.budget - b.actual) - (a.budget - a.actual)).slice(0, 3);
    return { util, capexUtil, opexUtil, over, worst, best };
  })();

  // ---------------- PDF EXPORT (native drawing, mirrors PPT) ----------------
  const exportPdf = async () => {
    setPdfLoading(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "l", unit: "pt", format: "a4" });
      const W = pdf.internal.pageSize.getWidth();
      const H = pdf.internal.pageSize.getHeight();

      // ---- Page 1: Title ----
      pdf.setFillColor(NAVY);
      pdf.rect(0, 0, W, H, "F");
      pdf.setTextColor("#FFFFFF");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(34);
      pdf.text("IT Budget vs. Actual Report", W / 2, H / 2 - 30, { align: "center" });
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(18);
      pdf.setTextColor("#CADCFC");
      pdf.text(periodLabel, W / 2, H / 2 + 6, { align: "center" });
      pdf.setFontSize(12);
      pdf.text(new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }),
        W / 2, H / 2 + 30, { align: "center" });
      pdf.setFontSize(10);
      pdf.setTextColor("#8DA2C0");
      pdf.text(`Amounts in ${unit}`, W / 2, H - 30, { align: "center" });

      // ---- Page 2: Financial Summary KPIs ----
      pdf.addPage();
      pageHeader(pdf, W, "Financial Summary", `${periodLabel} · Amount in ${unit}`);

      const kpis = [
        { label: "CAPEX", d: totals.capex, color: NAVY },
        { label: "OPEX", d: totals.opex, color: "#065A82" },
        { label: "Total", d: totals.total, color: ACCENT },
      ];
      const cardW = (W - 60 - 24 * 2) / 3;
      const cardH = 280;
      const cardY = 110;
      kpis.forEach((k, i) => {
        const x = 30 + i * (cardW + 24);
        pdf.setFillColor("#FFFFFF");
        pdf.setDrawColor(BORDER);
        pdf.roundedRect(x, cardY, cardW, cardH, 10, 10, "FD");
        pdf.setTextColor(k.color);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(16);
        pdf.text(k.label, x + 18, cardY + 30);

        drawKV(pdf, x + 18, cardY + 60, "Actual", fmtAmt(k.d.actual), 26, DARK);
        drawKV(pdf, x + 18, cardY + 120, "Budget", fmtAmt(k.d.budget), 20, DARK);
        const over = k.d.remaining < 0;
        drawKV(pdf, x + 18, cardY + 180, "Variance", fmtAmt(k.d.remaining), 20, over ? RED : GREEN);

        const badge = over ? "Overspend Risk" : "Within Budget";
        const badgeColor = over ? RED : GREEN;
        pdf.setFillColor(over ? "#FEE2E2" : "#D1FAE5");
        pdf.roundedRect(x + 18, cardY + 230, 130, 26, 13, 13, "F");
        pdf.setTextColor(badgeColor);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.text(badge, x + 83, cardY + 247, { align: "center" });
      });

      // Utilization bar chart under KPIs
      const barY = cardY + cardH + 30;
      pdf.setTextColor(DARK);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13);
      pdf.text("Budget Utilization", 30, barY);
      const barsData = [
        { name: "CAPEX", u: insights.capexUtil },
        { name: "OPEX", u: insights.opexUtil },
        { name: "Total", u: insights.util },
      ];
      const barW = W - 60;
      const barRowH = 22;
      barsData.forEach((b, i) => {
        const y = barY + 20 + i * (barRowH + 6);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        pdf.setTextColor(MUTED);
        pdf.text(b.name, 30, y + 15);
        // track
        pdf.setFillColor("#E5E7EB");
        pdf.roundedRect(90, y, barW - 90, barRowH, 6, 6, "F");
        // fill
        const w = Math.max(2, Math.min(1.2, b.u) * (barW - 90));
        const c = b.u > 1 ? RED : b.u > 0.9 ? "#F59E0B" : GREEN;
        pdf.setFillColor(c);
        pdf.roundedRect(90, y, w, barRowH, 6, 6, "F");
        pdf.setTextColor(DARK);
        pdf.setFont("helvetica", "bold");
        pdf.text(fmtPct(b.u), W - 30, y + 15, { align: "right" });
      });

      // ---- Page 3: Entity Breakdown Table (with mini bars) ----
      pdf.addPage();
      pageHeader(pdf, W, "Entity Breakdown — Budget vs. Actual", `${periodLabel} · Amount in ${unit}`);

      const cols = [
        { h: "Entity", w: 240, align: "left" as const },
        { h: "Actual", w: 90, align: "right" as const },
        { h: "Budget", w: 90, align: "right" as const },
        { h: "Variance", w: 90, align: "right" as const },
        { h: "Usage", w: 60, align: "right" as const },
        { h: "", w: W - 60 - (240 + 90 * 3 + 60), align: "left" as const }, // bar
      ];
      const tableX = 30;
      let ty = 110;
      // header
      pdf.setFillColor(NAVY);
      pdf.rect(tableX, ty, W - 60, 26, "F");
      pdf.setTextColor("#FFFFFF");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      let cx = tableX;
      cols.forEach((c) => {
        if (c.h) pdf.text(c.h, c.align === "right" ? cx + c.w - 8 : cx + 8, ty + 17, { align: c.align });
        cx += c.w;
      });
      ty += 26;

      const top = entities.slice(0, 16);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      top.forEach((r, i) => {
        const rem = r.budget - r.actual;
        const over = rem < 0;
        const usage = r.budget !== 0 ? r.actual / r.budget : 0;
        if (i % 2 === 0) { pdf.setFillColor("#F8FAFC"); pdf.rect(tableX, ty, W - 60, 22, "F"); }
        cx = tableX;
        pdf.setTextColor(DARK);
        pdf.text(truncate(r.entity, 40), cx + 8, ty + 15); cx += cols[0].w;
        pdf.text(fmtAmt(r.actual), cx + cols[1].w - 8, ty + 15, { align: "right" }); cx += cols[1].w;
        pdf.setTextColor(MUTED);
        pdf.text(fmtAmt(r.budget), cx + cols[2].w - 8, ty + 15, { align: "right" }); cx += cols[2].w;
        pdf.setTextColor(over ? RED : GREEN);
        pdf.setFont("helvetica", "bold");
        pdf.text(fmtAmt(rem), cx + cols[3].w - 8, ty + 15, { align: "right" }); cx += cols[3].w;
        pdf.text(fmtPct(usage), cx + cols[4].w - 8, ty + 15, { align: "right" }); cx += cols[4].w;
        pdf.setFont("helvetica", "normal");
        // mini bar
        const trackW = cols[5].w - 16;
        pdf.setFillColor("#E5E7EB");
        pdf.roundedRect(cx + 8, ty + 6, trackW, 10, 3, 3, "F");
        const fill = Math.max(1, Math.min(1.2, usage) * trackW);
        pdf.setFillColor(over ? RED : usage > 0.9 ? "#F59E0B" : GREEN);
        pdf.roundedRect(cx + 8, ty + 6, fill, 10, 3, 3, "F");
        ty += 22;
      });

      // ---- Page 4: Key Insights ----
      pdf.addPage();
      pageHeader(pdf, W, "Key Insights", "Auto-generated commentary based on filtered view");

      let iy = 120;
      insightBlock(pdf, W, iy, insights.over ? "Overall Overspend Risk" : "Overall Within Budget",
        `Total burn is ${fmtPct(insights.util)} of plan (variance ${fmtAmt(totals.total.remaining)} ${unit}). CAPEX at ${fmtPct(insights.capexUtil)}, OPEX at ${fmtPct(insights.opexUtil)}.`,
        insights.over ? RED : GREEN);
      iy += 90;

      insightBlock(pdf, W, iy, "Top Overspend Entities",
        insights.worst.map(w => `• ${w.entity}: actual ${fmtAmt(w.actual)} vs budget ${fmtAmt(w.budget)} (var ${fmtAmt(w.budget - w.actual)})`).join("\n"),
        RED);
      iy += 130;

      insightBlock(pdf, W, iy, "Top Under-Budget Entities",
        insights.best.map(b => `• ${b.entity}: actual ${fmtAmt(b.actual)} vs budget ${fmtAmt(b.budget)} (var ${fmtAmt(b.budget - b.actual)})`).join("\n"),
        GREEN);

      // Footer for every page
      const pageCount = pdf.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        pdf.setPage(p);
        pdf.setFontSize(8);
        pdf.setTextColor(MUTED);
        pdf.text(`Generated ${new Date().toLocaleString()} · IT Budget Report`, 30, H - 14);
        pdf.text(`${p} / ${pageCount}`, W - 30, H - 14, { align: "right" });
      }

      pdf.save(`IT_Budget_Vs_Actual_Report_${dateStamp()}.pdf`);
      toast.success("PDF report downloaded.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF report.");
    } finally {
      setPdfLoading(false);
    }
  };

  // ---------------- PPT EXPORT ----------------
  const exportPpt = async () => {
    setPptLoading(true);
    try {
      const { default: PptxGenJS } = await import("pptxgenjs");
      const pptx = new PptxGenJS();
      pptx.layout = "LAYOUT_WIDE";

      const NAVY_P = "1E2761", ACCENT_P = "F96167", LIGHT_P = "F5F7FB", DARK_P = "0F172A";

      // Slide 1
      const s1 = pptx.addSlide();
      s1.background = { color: NAVY_P };
      s1.addText("IT Budget vs. Actual Report", { x: 0.6, y: 2.6, w: 12, h: 1.4, fontSize: 44, bold: true, color: "FFFFFF", fontFace: "Calibri" });
      s1.addText(periodLabel, { x: 0.6, y: 4.0, w: 12, h: 0.6, fontSize: 22, color: "CADCFC", fontFace: "Calibri" });
      s1.addText(new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }),
        { x: 0.6, y: 4.6, w: 12, h: 0.5, fontSize: 16, color: "CADCFC", fontFace: "Calibri" });
      s1.addText(`Amounts in ${unit}`, { x: 0.6, y: 6.6, w: 12, h: 0.4, fontSize: 12, color: "8DA2C0", italic: true });

      // Slide 2: KPI + utilization bar chart
      const s2 = pptx.addSlide();
      s2.background = { color: LIGHT_P };
      s2.addText("Financial Summary", { x: 0.6, y: 0.4, w: 12, h: 0.8, fontSize: 32, bold: true, color: DARK_P });
      s2.addText(`${periodLabel} · Amount in ${unit}`, { x: 0.6, y: 1.2, w: 12, h: 0.4, fontSize: 14, color: "64748B" });

      const kpis = [
        { label: "CAPEX", d: totals.capex, color: NAVY_P },
        { label: "OPEX", d: totals.opex, color: "065A82" },
        { label: "Total", d: totals.total, color: ACCENT_P },
      ];
      kpis.forEach((k, i) => {
        const x = 0.6 + i * 4.15;
        s2.addShape("roundRect", { x, y: 1.7, w: 3.9, h: 2.8, fill: { color: "FFFFFF" }, line: { color: "E2E8F0", width: 1 }, rectRadius: 0.15 });
        s2.addText(k.label, { x: x + 0.3, y: 1.8, w: 3.5, h: 0.4, fontSize: 14, bold: true, color: k.color });
        s2.addText("Actual", { x: x + 0.3, y: 2.25, w: 3.5, h: 0.3, fontSize: 10, color: "64748B" });
        s2.addText(fmtAmt(k.d.actual), { x: x + 0.3, y: 2.45, w: 3.5, h: 0.5, fontSize: 22, bold: true, color: DARK_P });
        s2.addText("Budget", { x: x + 0.3, y: 3.0, w: 3.5, h: 0.3, fontSize: 10, color: "64748B" });
        s2.addText(fmtAmt(k.d.budget), { x: x + 0.3, y: 3.2, w: 3.5, h: 0.4, fontSize: 16, color: DARK_P });
        s2.addText("Variance", { x: x + 0.3, y: 3.65, w: 3.5, h: 0.3, fontSize: 10, color: "64748B" });
        const over = k.d.remaining < 0;
        s2.addText(fmtAmt(k.d.remaining), { x: x + 0.3, y: 3.85, w: 3.5, h: 0.4, fontSize: 16, bold: true, color: over ? "B91C1C" : "047857" });
        s2.addText(over ? "Overspend Risk" : "Within Budget", { x: x + 0.3, y: 4.2, w: 3.5, h: 0.25, fontSize: 10, bold: true, color: over ? "B91C1C" : "047857" });
      });

      // Bar chart: Actual vs Budget
      s2.addChart(pptx.ChartType.bar, [
        { name: "Actual", labels: ["CAPEX", "OPEX", "Total"], values: [totals.capex.actual, totals.opex.actual, totals.total.actual] },
        { name: "Budget", labels: ["CAPEX", "OPEX", "Total"], values: [totals.capex.budget, totals.opex.budget, totals.total.budget] },
      ], {
        x: 0.6, y: 4.7, w: 12.1, h: 2.5,
        barDir: "bar", barGrouping: "clustered", showLegend: true, legendPos: "b",
        chartColors: [NAVY_P, ACCENT_P], showTitle: true, title: `Actual vs Budget (${unit})`, titleFontSize: 12,
        catAxisLabelFontSize: 9, valAxisLabelFontSize: 9,
      });

      // Slide 3: Entity breakdown table
      const s3 = pptx.addSlide();
      s3.background = { color: LIGHT_P };
      s3.addText("Entity Breakdown — Budget vs. Actual", { x: 0.6, y: 0.4, w: 12, h: 0.7, fontSize: 26, bold: true, color: DARK_P });
      s3.addText(`${periodLabel} · Amount in ${unit}`, { x: 0.6, y: 1.05, w: 12, h: 0.4, fontSize: 12, color: "64748B" });

      const top = entities.slice(0, 14);
      const header = [
        { text: "Entity", options: { bold: true, color: "FFFFFF", fill: { color: NAVY_P } } },
        { text: "Actual", options: { bold: true, color: "FFFFFF", fill: { color: NAVY_P }, align: "right" as const } },
        { text: "Budget", options: { bold: true, color: "FFFFFF", fill: { color: NAVY_P }, align: "right" as const } },
        { text: "Variance", options: { bold: true, color: "FFFFFF", fill: { color: NAVY_P }, align: "right" as const } },
        { text: "Usage", options: { bold: true, color: "FFFFFF", fill: { color: NAVY_P }, align: "right" as const } },
      ];
      const body = top.map((r) => {
        const rem = r.budget - r.actual;
        const over = rem < 0;
        const usage = r.budget !== 0 ? r.actual / r.budget : 0;
        return [
          { text: r.entity, options: { color: DARK_P } },
          { text: fmtAmt(r.actual), options: { align: "right" as const, color: DARK_P } },
          { text: fmtAmt(r.budget), options: { align: "right" as const, color: "475569" } },
          { text: fmtAmt(rem), options: { align: "right" as const, color: over ? "B91C1C" : "047857", bold: true } },
          { text: fmtPct(usage), options: { align: "right" as const, color: over ? "B91C1C" : NAVY_P, bold: true } },
        ];
      });
      s3.addTable([header, ...body], {
        x: 0.6, y: 1.6, w: 12.1, colW: [4.5, 1.9, 1.9, 1.9, 1.9],
        fontSize: 11, fontFace: "Calibri",
        border: { type: "solid", pt: 0.5, color: "E2E8F0" }, rowH: 0.32,
      });

      // Slide 4: Top overspend chart
      const s4 = pptx.addSlide();
      s4.background = { color: LIGHT_P };
      s4.addText("Top Overspend Entities", { x: 0.6, y: 0.4, w: 12, h: 0.7, fontSize: 26, bold: true, color: DARK_P });
      const worst = [...entities].sort((a, b) => (a.budget - a.actual) - (b.budget - b.actual)).slice(0, 8);
      s4.addChart(pptx.ChartType.bar, [
        { name: "Actual", labels: worst.map(w => w.entity), values: worst.map(w => w.actual) },
        { name: "Budget", labels: worst.map(w => w.entity), values: worst.map(w => w.budget) },
      ], {
        x: 0.6, y: 1.2, w: 12.1, h: 5.8, barDir: "bar", barGrouping: "clustered",
        showLegend: true, legendPos: "b", chartColors: [ACCENT_P, NAVY_P],
        catAxisLabelFontSize: 10, valAxisLabelFontSize: 10,
      });

      // Slide 5: Insights
      const s5 = pptx.addSlide();
      s5.background = { color: LIGHT_P };
      s5.addText("Key Insights", { x: 0.6, y: 0.4, w: 12, h: 0.7, fontSize: 26, bold: true, color: DARK_P });
      const bullets = [
        `Overall: burn ${fmtPct(insights.util)} of plan · variance ${fmtAmt(totals.total.remaining)} ${unit}`,
        `CAPEX at ${fmtPct(insights.capexUtil)} · OPEX at ${fmtPct(insights.opexUtil)}`,
        `Top overspend: ${insights.worst.map(w => `${w.entity} (${fmtAmt(w.budget - w.actual)})`).join(", ")}`,
        `Top under-budget: ${insights.best.map(b => `${b.entity} (+${fmtAmt(b.budget - b.actual)})`).join(", ")}`,
        insights.over ? "Recommendation: initiate mid-cycle reforecast on overspend entities." : "Recommendation: preserve buffer; monitor accelerating fund centers.",
      ];
      s5.addText(bullets.map(t => ({ text: t, options: { bullet: true } })), {
        x: 0.7, y: 1.3, w: 12, h: 5.5, fontSize: 15, color: DARK_P, paraSpaceAfter: 8,
      });

      await pptx.writeFile({ fileName: `IT_Budget_Report_${dateStamp()}.pptx` });
      toast.success("PPT report downloaded.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PPT report.");
    } finally {
      setPptLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button onClick={exportPdf} disabled={pdfLoading} size="sm" variant="secondary" className="h-9 gap-2">
        {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
        {pdfLoading ? "Generating..." : "Export PDF Report"}
      </Button>
      <Button onClick={exportPpt} disabled={pptLoading} size="sm" variant="secondary" className="h-9 gap-2">
        {pptLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Presentation className="h-4 w-4" />}
        {pptLoading ? "Generating..." : "Export PPT Report"}
      </Button>
    </div>
  );
}

// ---------------- PDF helpers ----------------
function pageHeader(pdf: import("jspdf").jsPDF, W: number, title: string, sub: string) {
  pdf.setFillColor(LIGHT);
  pdf.rect(0, 0, W, 80, "F");
  pdf.setTextColor(DARK);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.text(title, 30, 40);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.setTextColor(MUTED);
  pdf.text(sub, 30, 60);
  pdf.setDrawColor(BORDER);
  pdf.line(0, 80, W, 80);
}

function drawKV(pdf: import("jspdf").jsPDF, x: number, y: number, label: string, value: string, size: number, valueColor: string) {
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(MUTED);
  pdf.text(label, x, y);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(size);
  pdf.setTextColor(valueColor);
  pdf.text(value, x, y + size * 1.1);
}

function insightBlock(pdf: import("jspdf").jsPDF, W: number, y: number, title: string, body: string, accent: string) {
  pdf.setFillColor("#FFFFFF");
  pdf.setDrawColor(BORDER);
  pdf.roundedRect(30, y, W - 60, 110, 8, 8, "FD");
  pdf.setFillColor(accent);
  pdf.rect(30, y, 4, 110, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(accent);
  pdf.text(title, 50, y + 22);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(DARK);
  const lines = pdf.splitTextToSize(body, W - 100);
  pdf.text(lines, 50, y + 44);
}

function truncate(s: string, n: number) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }
