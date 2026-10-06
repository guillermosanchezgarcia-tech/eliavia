"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { back } from "@/lib/flash";
import { bool, decimalInput, friendlyError, str } from "@/lib/utils";

function propertyFromForm(fd: FormData) {
  const coefficient = decimalInput(fd, "coefficient", 4);
  const surcharge = decimalInput(fd, "tourist_surcharge_pct", 2) ?? "0";
  return {
    code: str(fd, "code"),
    kind: str(fd, "kind") ?? "vivienda",
    description: str(fd, "description"),
    coefficient,
    tourist_use: bool(fd, "tourist_use"),
    tourist_surcharge_pct: bool(fd, "tourist_use") ? surcharge : "0",
    sort_order: Number(str(fd, "sort_order") ?? 0) || 0,
  };
}

async function saveGroups(cid: string, propertyId: string, fd: FormData) {
  const { supabase } = await requireAdmin(cid);
  const groups = fd.getAll("groups").map(String);
  const { data: all } = await supabase.from("property_groups").select("id").eq("community_id", cid);
  const allIds = (all ?? []).map((g) => g.id);
  if (allIds.length) await supabase.from("property_group_members").delete().eq("property_id", propertyId).in("group_id", allIds);
  if (groups.length) await supabase.from("property_group_members").insert(groups.map((g) => ({ group_id: g, property_id: propertyId })));
}

export async function createProperty(cid: string, fd: FormData) {
  const { supabase } = await requireAdmin(cid);
  const p = propertyFromForm(fd);
  const path = `/admin/${cid}/inmuebles`;
  if (!p.code || p.coefficient == null) back(path, { error: "Indica el identificador y un coeficiente válido (p. ej. 6,5000)." });
  if (Number(p.tourist_surcharge_pct) > 20) back(path, { error: "El incremento por uso turístico no puede superar el 20 % (art. 17.12 LPH)." });
  const { data, error } = await supabase.from("properties").insert({ ...p, community_id: cid }).select("id").single();
  if (error) back(path, { error: friendlyError(error) });
  await saveGroups(cid, data.id, fd);
  const ownerId = str(fd, "owner_id");
  if (ownerId) {
    await supabase.from("ownerships").insert({ community_id: cid, property_id: data.id, owner_id: ownerId, start_date: str(fd, "start_date") ?? new Date().toISOString().slice(0, 10) });
  }
  revalidatePath(path);
  back(path, { ok: `Inmueble ${p.code} creado.` });
}

export async function updateProperty(cid: string, pid: string, fd: FormData) {
  const { supabase } = await requireAdmin(cid);
  const p = propertyFromForm(fd);
  const path = `/admin/${cid}/inmuebles/${pid}`;
  if (!p.code || p.coefficient == null) back(path, { error: "Indica el identificador y un coeficiente válido." });
  if (Number(p.tourist_surcharge_pct) > 20) back(path, { error: "El incremento por uso turístico no puede superar el 20 % (art. 17.12 LPH)." });
  const { error } = await supabase.from("properties").update(p).eq("id", pid);
  if (error) back(path, { error: friendlyError(error) });
  await saveGroups(cid, pid, fd);
  back(`/admin/${cid}/inmuebles`, { ok: `Inmueble ${p.code} actualizado.` });
}

export async function deleteProperty(cid: string, pid: string) {
  const { supabase } = await requireAdmin(cid);
  const { error } = await supabase.from("properties").delete().eq("id", pid);
  if (error) back(`/admin/${cid}/inmuebles/${pid}`, { error: friendlyError(error) });
  back(`/admin/${cid}/inmuebles`, { ok: "Inmueble eliminado." });
}
