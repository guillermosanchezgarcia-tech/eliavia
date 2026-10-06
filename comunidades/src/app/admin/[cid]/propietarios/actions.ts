"use server";

import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { back } from "@/lib/flash";
import { bool, friendlyError, str } from "@/lib/utils";

function ownerFromForm(fd: FormData) {
  return {
    full_name: str(fd, "full_name"),
    nif: str(fd, "nif")?.toUpperCase() ?? null,
    email: str(fd, "email")?.toLowerCase() ?? null,
    phone: str(fd, "phone"),
    iban: str(fd, "iban")?.replace(/\s/g, "").toUpperCase() ?? null,
    address: str(fd, "address"),
    notes: str(fd, "notes"),
  };
}

/** Crea (o reutiliza) la cuenta de acceso al portal y la vincula con la ficha del propietario. */
async function grantAccess(cid: string, ownerId: string, email: string, password: string | null) {
  const { supabase } = await requireAdmin(cid); // comprueba que quien lo pide es administrador
  const admin = createAdminClient();
  let userId: string | null = null;
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  userId = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id ?? null;
  if (!userId) {
    if (!password || password.length < 8) return "La contraseña inicial debe tener al menos 8 caracteres.";
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) return `No se pudo crear el acceso: ${error.message}`;
    userId = data.user.id;
  }
  const { error: e1 } = await supabase.from("owners").update({ user_id: userId, email }).eq("id", ownerId);
  if (e1) return friendlyError(e1);
  const { error: e2 } = await supabase.from("memberships").upsert({ community_id: cid, user_id: userId, role: "owner" }, { onConflict: "community_id,user_id,role", ignoreDuplicates: true });
  if (e2) return friendlyError(e2);
  return null;
}

export async function createOwner(cid: string, fd: FormData) {
  const { supabase } = await requireAdmin(cid);
  const o = ownerFromForm(fd);
  const path = `/admin/${cid}/propietarios`;
  if (!o.full_name) back(path, { error: "El nombre es obligatorio." });
  const { data, error } = await supabase.from("owners").insert({ ...o, community_id: cid }).select("id").single();
  if (error) back(path, { error: friendlyError(error) });
  const propertyId = str(fd, "property_id");
  if (propertyId) {
    const { error: te } = await supabase.rpc("transfer_property", { p_property: propertyId, p_owner: data.id, p_date: str(fd, "start_date") ?? new Date().toISOString().slice(0, 10) });
    if (te) back(`${path}/${data.id}`, { error: `Propietario creado, pero no se pudo asignar el inmueble: ${friendlyError(te)}` });
  }
  if (bool(fd, "portal_access") && o.email) {
    const err = await grantAccess(cid, data.id, o.email, str(fd, "password"));
    if (err) back(`${path}/${data.id}`, { error: `Propietario creado, pero sin acceso al portal: ${err}` });
  }
  back(`${path}/${data.id}`, { ok: "Propietario creado." });
}

export async function updateOwner(cid: string, oid: string, fd: FormData) {
  const { supabase } = await requireAdmin(cid);
  const o = ownerFromForm(fd);
  const path = `/admin/${cid}/propietarios/${oid}`;
  if (!o.full_name) back(path, { error: "El nombre es obligatorio." });
  const { error } = await supabase.from("owners").update(o).eq("id", oid);
  if (error) back(path, { error: friendlyError(error) });
  back(path, { ok: "Datos guardados." });
}

export async function giveAccess(cid: string, oid: string, fd: FormData) {
  const path = `/admin/${cid}/propietarios/${oid}`;
  const email = str(fd, "email");
  if (!email) back(path, { error: "Indica el email del propietario." });
  const err = await grantAccess(cid, oid, email, str(fd, "password"));
  if (err) back(path, { error: err });
  back(path, { ok: `Acceso al portal activado para ${email}. Comunícale su contraseña inicial.` });
}

export async function revokeAccess(cid: string, oid: string, userId: string) {
  const { supabase } = await requireAdmin(cid);
  await supabase.from("memberships").delete().eq("community_id", cid).eq("user_id", userId).in("role", ["owner", "president"]);
  await supabase.from("owners").update({ user_id: null }).eq("id", oid);
  back(`/admin/${cid}/propietarios/${oid}`, { ok: "Acceso al portal retirado." });
}

export async function setPresident(cid: string, oid: string, userId: string, on: boolean) {
  const { supabase } = await requireAdmin(cid);
  if (on) await supabase.from("memberships").insert({ community_id: cid, user_id: userId, role: "president" });
  else await supabase.from("memberships").delete().eq("community_id", cid).eq("user_id", userId).eq("role", "president");
  back(`/admin/${cid}/propietarios/${oid}`, { ok: on ? "Nombrado presidente." : "Ya no es presidente." });
}

export async function transferProperty(cid: string, oid: string, fd: FormData) {
  const { supabase } = await requireAdmin(cid);
  const path = `/admin/${cid}/propietarios/${oid}`;
  const propertyId = str(fd, "property_id");
  const date = str(fd, "date");
  if (!propertyId || !date) back(path, { error: "Elige el inmueble y la fecha de la transmisión." });
  const { error } = await supabase.rpc("transfer_property", { p_property: propertyId, p_owner: oid, p_date: date });
  if (error) back(path, { error: friendlyError(error) });
  back(path, { ok: "Cambio de titular registrado. Los recibos desde esa fecha se emitirán a su nombre." });
}

export async function deleteOwner(cid: string, oid: string) {
  const { supabase } = await requireAdmin(cid);
  const { error } = await supabase.from("owners").delete().eq("id", oid);
  if (error) back(`/admin/${cid}/propietarios/${oid}`, { error: "No se puede eliminar: tiene inmuebles, recibos o cobros asociados." });
  back(`/admin/${cid}/propietarios`, { ok: "Propietario eliminado." });
}
