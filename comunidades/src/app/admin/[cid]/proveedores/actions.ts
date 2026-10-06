"use server";

import { requireAdmin } from "@/lib/auth";
import { back } from "@/lib/flash";
import { bool, decimalInput, friendlyError, str } from "@/lib/utils";

function supplierFromForm(fd: FormData) {
  return {
    name: str(fd, "name"),
    nif: str(fd, "nif")?.toUpperCase() ?? null,
    category: str(fd, "category"),
    iban: str(fd, "iban")?.replace(/\s/g, "").toUpperCase() ?? null,
    email: str(fd, "email"),
    phone: str(fd, "phone"),
    applies_withholding: bool(fd, "applies_withholding"),
    withholding_pct: decimalInput(fd, "withholding_pct", 2) ?? "15",
    is_utility: bool(fd, "is_utility"),
    notes: str(fd, "notes"),
  };
}

export async function createSupplier(cid: string, fd: FormData) {
  const { supabase } = await requireAdmin(cid);
  const s = supplierFromForm(fd);
  if (!s.name) back(`/admin/${cid}/proveedores`, { error: "El nombre es obligatorio." });
  const { error } = await supabase.from("suppliers").insert({ ...s, community_id: cid });
  if (error) back(`/admin/${cid}/proveedores`, { error: friendlyError(error) });
  back(`/admin/${cid}/proveedores`, { ok: `Proveedor ${s.name} creado.` });
}

export async function updateSupplier(cid: string, sid: string, fd: FormData) {
  const { supabase } = await requireAdmin(cid);
  const s = supplierFromForm(fd);
  if (!s.name) back(`/admin/${cid}/proveedores/${sid}`, { error: "El nombre es obligatorio." });
  const { error } = await supabase.from("suppliers").update(s).eq("id", sid);
  if (error) back(`/admin/${cid}/proveedores/${sid}`, { error: friendlyError(error) });
  back(`/admin/${cid}/proveedores`, { ok: "Proveedor actualizado." });
}

export async function deleteSupplier(cid: string, sid: string) {
  const { supabase } = await requireAdmin(cid);
  const { error } = await supabase.from("suppliers").delete().eq("id", sid);
  if (error) back(`/admin/${cid}/proveedores/${sid}`, { error: "No se puede eliminar: tiene facturas registradas." });
  back(`/admin/${cid}/proveedores`, { ok: "Proveedor eliminado." });
}
