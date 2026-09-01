import { pgTable, serial, integer, text, doublePrecision, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const budgetRows = pgTable("budget_rows", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull(),
  actBudget: text("act_budget").notNull(), // "Actual" | "Budget" | "Budget After Allocation"
  entity: text("entity").notNull(),
  entityGroup: text("entity_group").notNull(),
  capexOpex: text("capex_opex").notNull(),
  fundCenterGroup: text("fund_center_group").notNull(),
  fundCenterName: text("fund_center_name").notNull(),
  currency: text("currency").notNull(),
  simplifiedText: text("simplified_text").notNull().default(""),

  jan: doublePrecision("jan").notNull().default(0),
  feb: doublePrecision("feb").notNull().default(0),
  mar: doublePrecision("mar").notNull().default(0),
  apr: doublePrecision("apr").notNull().default(0),
  may: doublePrecision("may").notNull().default(0),
  jun: doublePrecision("jun").notNull().default(0),
  jul: doublePrecision("jul").notNull().default(0),
  aug: doublePrecision("aug").notNull().default(0),
  sep: doublePrecision("sep").notNull().default(0),
  oct: doublePrecision("oct").notNull().default(0),
  nov: doublePrecision("nov").notNull().default(0),
  dec: doublePrecision("dec").notNull().default(0),

  ytdJan: doublePrecision("ytd_jan").notNull().default(0),
  ytdFeb: doublePrecision("ytd_feb").notNull().default(0),
  ytdMar: doublePrecision("ytd_mar").notNull().default(0),
  ytdApr: doublePrecision("ytd_apr").notNull().default(0),
  ytdMay: doublePrecision("ytd_may").notNull().default(0),
  ytdJun: doublePrecision("ytd_jun").notNull().default(0),
  ytdJul: doublePrecision("ytd_jul").notNull().default(0),
  ytdAug: doublePrecision("ytd_aug").notNull().default(0),
  ytdSep: doublePrecision("ytd_sep").notNull().default(0),
  ytdOct: doublePrecision("ytd_oct").notNull().default(0),
  ytdNov: doublePrecision("ytd_nov").notNull().default(0),
  ytdDec: doublePrecision("ytd_dec").notNull().default(0),
});
