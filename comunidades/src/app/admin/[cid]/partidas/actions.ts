"use server";

import { requireAdmin } from "@/lib/auth";
import { back } from "@/lib/flash";
import { decimalInput, friendlyError, str } from "@/lib/utils";

const path = (cid: string) => `/admin/${cid}/partidas`;

export async function createCategory(cid: string, fd: FormData) {
  const { supabase } = await requireAdmin(cid);
  const name = str(fd, "name");
  const kind = str(fd, "kind") as "expense" | "income";
  if (!name || !["expense", "income"].includes(kind)) back(path(cid), { error: "Indica nombre y tipo de partida." });
  const { data: existing } = await supabase.from("categories").select("code").eq("community_id", cid).like("code", kind === "expense" ? "G%" : "I%");
  const prefix = kind === "expense" ? "G" : "I";
  const next = Math.max(20, ...(existing ?? []).map((c) => Number(c.code.slice(1)) || 0).filter((n) => n < 99)) + 1;
  const { error } = await supabase.from("categories").insert({
    community_id: cid, code: `${prefix}${String(next).padStart(2, "0")}`, name, kind, sort_order: kind === "expense" ? next : 100 + next,
  });
  if (error) back(path(cid), { error: friendlyError(error) });
  back(path(cid), { ok: `Partida «${name}» creada.` });
}

export async function toggleCategory(cid: string, id: string, active: boolean) {
  const { supabase } = await requireAdmin(cid);
  await supabase.from("categories").update({ active }).eq("id", id).eq("is_system", false);
  back(path(cid), { ok: active ? "Partida activada." : "Partida desactivada (se conserva en los movimientos anteriores)." });
}

export async function createGroup(cid: string, fd: FormData) {
  const { supabase } = await requireAdmin(cid);
  const name = str(fd, "name");
  if (!name) back(path(cid), { error: "Indica el nombre del grupo." });
  const { data, error } = await supabase.from("property_groups").insert({ community_id: cid, name }).select("id").single();
  if (error) back(path(cid), { error: friendlyError(error) });
  const members = fd.getAll("properties").map(String);
  if (members.length) await supabase.from("property_group_members").insert(members.map((p) => ({ group_id: data.id, property_id: p })));
  back(path(cid), { ok: `Grupo «${name}» creado con ${members.length} inmuebles.` });
}

export async function deleteGroup(cid: string, id: string) {
  const { supabase } = await requireAdmin(cid);
  const { error } = await supabase.from("property_groups").delete().eq("id", id);
  if (error) back(path(cid), { error: "No se puede borrar: hay repartos que usan este grupo." });
  back(path(cid), { ok: "Grupo eliminado." });
}

export async function createKey(cid: string, fd: FormData) {
  const { supabase } = await requireAdmin(cid);
  const name = str(fd, "name");
  const method = str(fd, "method") ?? "coefficient";
  if (!name) back(path(cid), { error: "Indica el nombre del reparto." });
  const { data, error } = await supabase
    .from("allocation_keys")
    .insert({ community_id: cid, name, method, group_id: str(fd, "group_id") })
    .select("id")
    .single();
  if (error) back(path(cid), { error: friendlyError(error) });
  if (method === "custom") back(`${path(cid)}/repartos/${data.id}`, { ok: "Reparto creado. Indica ahora los coeficientes específicos de cada inmueble." });
  back(path(cid), { ok: `Reparto «${name}» creado.` });
}

export async function saveWeights(cid: string, kid: string, fd: FormData) {
  const { supabase } = await requireAdmin(cid);
  const rows: { key_id: string; property_id: string; weight: string }[] = [];
  for (const [k] of fd.entries()) {
    if (!k.startsWith("w_")) continue;
    const w = decimalInput(fd, k, 4);
    if (w && Number(w) > 0) rows.push({ key_id: kid, property_id: k.slice(2), weight: w });
  }
  await supabase.from("allocation_key_weights").delete().eq("key_id", kid);
  if (rows.length) {
    const { error } = await supabase.from("allocation_key_weights").insert(rows);
    if (error) back(`${path(cid)}/repartos/${kid}`, { error: friendlyError(error) });
  }
  back(`${path(cid)}/repartos/${kid}`, { ok: "Coeficientes guardados." });
}

export async function deleteKey(cid: string, id: string) {
  const { supabase } = await requireAdmin(cid);
  const { error } = await supabase.from("allocation_keys").delete().eq("id", id).eq("is_default", false);
  if (error) back(path(cid), { error: "No se puede borrar: hay presupuestos o gastos que usan este reparto." });
  back(path(cid), { ok: "Reparto eliminado." });
}
