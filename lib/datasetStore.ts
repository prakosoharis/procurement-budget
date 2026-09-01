"use client";

import { createContext, useContext } from "react";
import type { Row } from "@/lib/dashboard";

export type DatasetCtx = {
  rows: Row[];
  loading: boolean;
  source: "default" | "uploaded";
  /** Upload already-parsed rows (from an .xlsx file) and persist them to Neon, replacing the dataset for everyone. */
  uploadRows: (rows: Row[]) => Promise<void>;
  /** Wipe the dataset and reload it from the bundled seed (database.json), persisted server-side. */
  resetRows: () => Promise<void>;
  /** Re-fetch the current dataset from the server. */
  refreshRows: () => Promise<void>;
};

export const DatasetContext = createContext<DatasetCtx | null>(null);

export function useDataset() {
  const ctx = useContext(DatasetContext);
  if (!ctx) throw new Error("useDataset must be used inside DatasetProvider");
  return ctx;
}

export async function fetchBudgetRows(): Promise<{ rows: Row[]; count: number }> {
  const res = await fetch("/api/budget", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load dataset (${res.status})`);
  return res.json();
}

export async function uploadBudgetRows(rows: Row[]): Promise<{ rows: Row[]; count: number }> {
  const res = await fetch("/api/budget/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `Upload failed (${res.status})`);
  return json;
}

export async function resetBudgetRows(): Promise<{ rows: Row[]; count: number }> {
  const res = await fetch("/api/budget/reset", { method: "POST" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `Reset failed (${res.status})`);
  return json;
}
