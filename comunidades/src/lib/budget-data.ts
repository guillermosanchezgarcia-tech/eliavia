import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BudgetForQuotas, BudgetLineForQuotas, QuotaContext } from "./cuotas";
import { getAllocationKeys, getCategories, getProperties } from "./data";

export interface BudgetRow extends BudgetForQuotas {
  community_id: string;
  status: "draft" | "approved";
  approved_at: string | null;
  notes: string | null;
  fiscal_year_id: string | null;
}

/** Carga todo lo necesario para calcular las cuotas de un presupuesto. */
export async function loadBudgetContext(supabase: SupabaseClient, cid: string, budgetId: string) {
  const { data: budget } = await supabase.from("budgets").select("*").eq("id", budgetId).eq("community_id", cid).single();
  if (!budget) return null;
  const [props, keys, cats, { data: lines }, { data: groupMembers }, { data: weights }] = await Promise.all([
    getProperties(supabase, cid),
    getAllocationKeys(supabase, cid),
    getCategories(supabase, cid),
    supabase.from("budget_lines").select("*").eq("budget_id", budgetId).order("amount_cents", { ascending: false }),
    supabase.from("property_group_members").select("group_id, property_id"),
    supabase.from("allocation_key_weights").select("key_id, property_id, weight"),
  ]);
  const catById = new Map(cats.map((c) => [c.id, c]));
  const incomeCode = budget.kind === "ordinary" ? "I01" : "I02";
  const income = cats.find((c) => c.code === incomeCode);

  const gm = new Map<string, Set<string>>();
  for (const m of groupMembers ?? []) {
    if (!gm.has(m.group_id)) gm.set(m.group_id, new Set());
    gm.get(m.group_id)!.add(m.property_id);
  }
  const cw = new Map<string, Map<string, string>>();
  for (const w of weights ?? []) {
    if (!cw.has(w.key_id)) cw.set(w.key_id, new Map());
    cw.get(w.key_id)!.set(w.property_id, String(w.weight));
  }
  const ctx: QuotaContext = {
    properties: props,
    keys: keys.map((k) => ({ id: k.id, method: k.method, group_id: k.group_id })),
    groupMembers: gm,
    customWeights: cw,
    incomeCategoryId: income?.id ?? "",
  };
  const quotaLines: BudgetLineForQuotas[] = (lines ?? []).map((l) => ({
    id: l.id,
    category_id: l.category_id,
    category_kind: catById.get(l.category_id)?.kind ?? "expense",
    allocation_key_id: l.allocation_key_id,
    amount_cents: Number(l.amount_cents),
  }));
  return { budget: budget as BudgetRow, lines: lines ?? [], quotaLines, ctx, props, keys, cats, catById };
}
