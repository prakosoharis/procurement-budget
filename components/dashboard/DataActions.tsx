"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Download, RotateCcw, RefreshCw, Loader2 } from "lucide-react";
import { useDataset } from "@/lib/datasetStore";
import { readExcelFile, downloadRowsAsXlsx } from "@/lib/excelIo";
import { toast } from "sonner";

export function DataActions() {
  const { rows, uploadRows, resetRows, refreshRows, source, loading } = useDataset();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onPick = () => fileRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      const newRows = await readExcelFile(f);
      if (!newRows.length) { toast.error("No valid rows found in the file."); return; }
      await uploadRows(newRows);
      toast.success(`Loaded ${newRows.length.toLocaleString()} rows from ${f.name}`);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to parse Excel file. Use the same column layout as the Database sheet.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onDownload = () => {
    downloadRowsAsXlsx(rows, `budget-dashboard-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Excel file downloaded.");
  };

  const onReset = async () => {
    setBusy(true);
    try {
      await resetRows();
      toast.success("Reverted to default dataset.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset dataset.");
    } finally {
      setBusy(false);
    }
  };

  const onRefresh = async () => {
    setBusy(true);
    try {
      await refreshRows();
      toast.success(`Refreshed from database (${rows.length.toLocaleString()} rows).`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to refresh from database.");
    } finally {
      setBusy(false);
    }
  };

  const disabled = busy || loading;

  return (
    <div className="flex items-center gap-2">
      <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onFile} disabled={disabled} />
      <Button onClick={onRefresh} size="sm" variant="default" className="h-9 gap-2" disabled={disabled}>
        {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh from Database
      </Button>
      <Button onClick={onPick} size="sm" variant="secondary" className="h-9 gap-2" disabled={disabled}>
        <Upload className="h-4 w-4" /> Upload XLSX
      </Button>
      <Button onClick={onDownload} size="sm" variant="secondary" className="h-9 gap-2" disabled={disabled}>
        <Download className="h-4 w-4" /> Download
      </Button>
      {source === "uploaded" && (
        <Button onClick={onReset} size="sm" variant="ghost" className="h-9 gap-2" disabled={disabled}>
          <RotateCcw className="h-4 w-4" /> Reset
        </Button>
      )}
    </div>
  );
}
