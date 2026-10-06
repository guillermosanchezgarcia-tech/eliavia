import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { daysBetween } from "./dates";

export interface SummaryRow {
  period_start: string;
  section: "income" | "expense" | "reserve_in" | "reserve_out";
  category_id: string | null;
  category_code: string | null;
  category_name: string | null;
  amount_cents: number;
}

export interface CategoryTotal {
  code: string;
  name: string;
  cents: number;
}

export interface IncomeExpenseReport {
  rows: SummaryRow[];
  periods: string[];
  income: CategoryTotal[];
  expense: CategoryTotal[];
  reserveIn: CategoryTotal[];
  reserveOut: CategoryTotal[];
  totalIncome: number;
  totalExpense: number;
  totalReserveIn: number;
  totalReserveOut: number;
}

function totals(rows: SummaryRow[], section: SummaryRow["section"]): CategoryTotal[] {
  const m = new Map<string, CategoryTotal>();
  for (const r of rows.filter((x) => x.section === section)) {
    const key = r.category_code ?? "—";
    const t = m.get(key) ?? { code: key, name: r.category_name ?? "Sin partida", cents: 0 };
    t.cents += Number(r.amount_cents);
    m.set(key, t);
  }
  return [...m.values()].filter((t) => t.cents !== 0).sort((a, b) => a.code.localeCompare(b.code));
}

/** Ingresos y gastos por partida (criterio de devengo: recibos emitidos y facturas por su fecha). */
export async function incomeExpenseReport(supabase: SupabaseClient, cid: string, from: string, to: string, grain: "month" | "quarter" | "year"): Promise<IncomeExpenseReport> {
  const { data, error } = await supabase.rpc("ledger_summary", { p_community: cid, p_from: from, p_to: to, p_grain: grain });
  if (error) throw new Error(error.message);
  const rows = ((data ?? []) as SummaryRow[]).map((r) => ({ ...r, amount_cents: Number(r.amount_cents) }));
  const income = totals(rows, "income");
  const expense = totals(rows, "expense");
  const reserveIn = totals(rows, "reserve_in");
  const reserveOut = totals(rows, "reserve_out");
  const sum = (x: CategoryTotal[]) => x.reduce((a, t) => a + t.cents, 0);
  return {
    rows,
    periods: [...new Set(rows.map((r) => r.period_start))].sort(),
    income, expense, reserveIn, reserveOut,
    totalIncome: sum(income), totalExpense: sum(expense), totalReserveIn: sum(reserveIn), totalReserveOut: sum(reserveOut),
  };
}

export interface BudgetVsActualRow {
  category_id: string;
  category_code: string;
  category_name: string;
  category_kind: string;
  budget_cents: number;
  actual_cents: number;
}

export async function budgetVsActual(supabase: SupabaseClient, budgetId: string): Promise<BudgetVsActualRow[]> {
  const { data } = await supabase.rpc("budget_vs_actual", { p_budget: budgetId });
  return ((data ?? []) as BudgetVsActualRow[]).map((r) => ({ ...r, budget_cents: Number(r.budget_cents), actual_cents: Number(r.actual_cents) }));
}

export interface DebtorRow {
  owner_id: string;
  full_name: string;
  nif: string | null;
  buckets: [number, number, number, number]; // 0-30, 31-90, 91-180, >180 días
  total: number;
  oldest: string;
  receipts: number;
}

/** Deudores con antigüedad de la deuda (solo administración y presidencia: datos protegidos). */
export async function debtorsReport(supabase: SupabaseClient, cid: string, asOf: string): Promise<DebtorRow[]> {
  const [{ data: receipts }, { data: owners }] = await Promise.all([
    supabase.from("v_receipts").select("owner_id, due_date, amount_cents, paid_cents, status").eq("community_id", cid).eq("status", "issued").lt("due_date", asOf),
    supabase.from("owners").select("id, full_name, nif").eq("community_id", cid),
  ]);
  const byOwner = new Map<string, DebtorRow>();
  for (const r of receipts ?? []) {
    const pending = Number(r.amount_cents) - Number(r.paid_cents);
    if (pending <= 0) continue;
    const o = (owners ?? []).find((x) => x.id === r.owner_id);
    const d = byOwner.get(r.owner_id) ?? { owner_id: r.owner_id, full_name: o?.full_name ?? "", nif: o?.nif ?? null, buckets: [0, 0, 0, 0], total: 0, oldest: r.due_date, receipts: 0 };
    const days = daysBetween(r.due_date, asOf);
    const idx = days <= 30 ? 0 : days <= 90 ? 1 : days <= 180 ? 2 : 3;
    d.buckets[idx] += pending;
    d.total += pending;
    d.receipts += 1;
    if (r.due_date < d.oldest) d.oldest = r.due_date;
    byOwner.set(r.owner_id, d);
  }
  return [...byOwner.values()].sort((a, b) => b.total - a.total);
}
