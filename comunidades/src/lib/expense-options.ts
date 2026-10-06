import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAllocationKeys, getBankAccounts, getCategories } from "./data";

export async function expenseOptions(supabase: SupabaseClient, cid: string) {
  const [{ data: suppliers }, cats, keys, banks] = await Promise.all([
    supabase.from("suppliers").select("id, name, applies_withholding, withholding_pct").eq("community_id", cid).order("name"),
    getCategories(supabase, cid),
    getAllocationKeys(supabase, cid),
    getBankAccounts(supabase, cid),
  ]);
  return {
    suppliers: suppliers ?? [],
    categories: cats.filter((c) => c.kind === "expense" && c.active).map((c) => ({ id: c.id, name: c.name })),
    allCategories: cats,
    keys: keys.map((k) => ({ id: k.id, name: k.name })),
    banks: banks.map((b) => ({ id: b.id, name: b.name })),
  };
}
