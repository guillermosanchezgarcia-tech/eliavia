"use server";

import { requireAdmin } from "@/lib/auth";
import { back } from "@/lib/flash";
import { friendlyError, str } from "@/lib/utils";
import { parseEuros } from "@/lib/money";
import { loadBudgetContext } from "@/lib/budget-data";
import { planReceipts } from "@/lib/cuotas";
import { getOwnerships, ownerAt } from "@/lib/data";

export async function createBudget(cid: string, fd: FormData) {
  const { supabase } = await requireAdmin(cid);
  const kind = str(fd, "kind") === "extraordinary" ? "extraordinary" : "ordinary";
  const name = str(fd, "name");
  const first = str(fd, "first_due_date");
  const installments = Number(str(fd, "installments") ?? 1);
  const interval = Number(str(fd, "interval_months") ?? 1);
  if (!name || !first || !(installments >= 1 && installments <= 60)) back(`/admin/${cid}/presupuestos`, { error: "Revisa el nombre, el primer vencimiento y el número de plazos (1 a 60)." });
  const { data: fy } = await supabase.from("fiscal_years").select("id").eq("community_id", cid).lte("start_date", first).gte("end_date", first).maybeSingle();
  const { data, error } = await supabase
    .from("budgets")
    .insert({ community_id: cid, kind, name, installments, interval_months: interval, first_due_date: first, notes: str(fd, "notes"), fiscal_year_id: fy?.id ?? null })
    .select("id")
    .single();
  if (error) back(`/admin/${cid}/presupuestos`, { error: friendlyError(error) });
  // Copia las partidas de otro presupuesto (p. ej. el del año anterior)
  const copyFrom = str(fd, "copy_from");
  if (copyFrom) {
    const { data: lines } = await supabase.from("budget_lines").select("category_id, allocation_key_id, amount_cents, description").eq("budget_id", copyFrom);
    if (lines?.length) await supabase.from("budget_lines").insert(lines.map((l) => ({ ...l, budget_id: data.id })));
  }
  back(`/admin/${cid}/presupuestos/${data.id}`, { ok: "Creado. Añade ahora las partidas." });
}

export async function addLine(cid: string, bid: string, fd: FormData) {
  const { supabase } = await requireAdmin(cid);
  const path = `/admin/${cid}/presupuestos/${bid}`;
  const amount = parseEuros(str(fd, "amount"));
  const category = str(fd, "category_id");
  const key = str(fd, "allocation_key_id");
  if (!category || !key || amount == null || amount <= 0) back(path, { error: "Elige partida, reparto e importe válido (p. ej. 1.234,56)." });
  const { data: b } = await supabase.from("budgets").select("status").eq("id", bid).single();
  if (b?.status === "approved") back(path, { error: "El presupuesto ya está aprobado. Vuelve a ponerlo en borrador para modificarlo." });
  const { error } = await supabase.from("budget_lines").insert({ budget_id: bid, category_id: category, allocation_key_id: key, amount_cents: amount, description: str(fd, "description") });
  if (error) back(path, { error: friendlyError(error) });
  back(path, { ok: "Partida añadida." });
}

export async function deleteLine(cid: string, bid: string, lineId: string) {
  const { supabase } = await requireAdmin(cid);
  const { data: b } = await supabase.from("budgets").select("status").eq("id", bid).single();
  if (b?.status === "approved") back(`/admin/${cid}/presupuestos/${bid}`, { error: "El presupuesto está aprobado." });
  await supabase.from("budget_lines").delete().eq("id", lineId).eq("budget_id", bid);
  back(`/admin/${cid}/presupuestos/${bid}`, { ok: "Partida eliminada." });
}

export async function setStatus(cid: string, bid: string, fd: FormData) {
  const { supabase } = await requireAdmin(cid);
  const path = `/admin/${cid}/presupuestos/${bid}`;
  const approve = str(fd, "status") === "approved";
  if (!approve) {
    const { count } = await supabase.from("receipts").select("id", { count: "exact", head: true }).eq("budget_id", bid);
    if (count) back(path, { error: "No se puede volver a borrador: ya se han emitido recibos de este presupuesto." });
  }
  const { error } = await supabase
    .from("budgets")
    .update({ status: approve ? "approved" : "draft", approved_at: approve ? str(fd, "approved_at") ?? new Date().toISOString().slice(0, 10) : null })
    .eq("id", bid);
  if (error) back(path, { error: friendlyError(error) });
  back(path, { ok: approve ? "Aprobado. Ya puedes emitir los recibos." : "Devuelto a borrador." });
}

export async function issueInstallment(cid: string, bid: string, installment: number) {
  const { supabase } = await requireAdmin(cid);
  const path = `/admin/${cid}/presupuestos/${bid}`;
  const loaded = await loadBudgetContext(supabase, cid, bid);
  if (!loaded) back(path, { error: "Presupuesto no encontrado." });
  const { budget, quotaLines, ctx } = loaded;
  if (budget.status !== "approved") back(path, { error: "Aprueba el presupuesto antes de emitir recibos." });
  const { count } = await supabase.from("receipts").select("id", { count: "exact", head: true }).eq("budget_id", bid).eq("installment", installment);
  if (count) back(path, { error: `Los recibos del plazo ${installment} ya están emitidos.` });

  let planned;
  try {
    planned = planReceipts(budget, quotaLines, ctx, [installment]);
  } catch (e) {
    back(path, { error: `No se pudieron calcular las cuotas: ${(e as Error).message}` });
  }
  const ownerships = await getOwnerships(supabase, cid);
  const missing: string[] = [];
  const payload = planned.map((r) => {
    const owner = ownerAt(ownerships, r.property_id, r.issue_date);
    if (!owner) missing.push(ctx.properties.find((p) => p.id === r.property_id)?.code ?? "?");
    return { ...r, owner_id: owner };
  });
  if (missing.length) back(path, { error: `Estos inmuebles no tienen titular en la fecha del recibo: ${missing.join(", ")}.` });
  const { data, error } = await supabase.rpc("create_receipts", { p_community: cid, p_receipts: payload });
  if (error) back(path, { error: friendlyError(error) });
  back(path, { ok: `${data} recibos emitidos para el plazo ${installment}.` });
}

export async function deleteBudget(cid: string, bid: string) {
  const { supabase } = await requireAdmin(cid);
  const { error } = await supabase.from("budgets").delete().eq("id", bid);
  if (error) back(`/admin/${cid}/presupuestos/${bid}`, { error: "No se puede borrar: tiene recibos emitidos." });
  back(`/admin/${cid}/presupuestos`, { ok: "Eliminado." });
}
