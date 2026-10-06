"use server";

import { requireAdmin } from "@/lib/auth";
import { back } from "@/lib/flash";
import { parseEuros } from "@/lib/money";
import { bool, decimalInput, friendlyError, str } from "@/lib/utils";
import { deleteDocumentFile, uploadDocument } from "@/lib/uploads";

function expenseFromForm(fd: FormData) {
  const base = parseEuros(str(fd, "base"));
  const vat = parseEuros(str(fd, "vat_amount")) ?? 0;
  const irpf = parseEuros(str(fd, "irpf_amount")) ?? 0;
  const paid = bool(fd, "is_paid");
  return {
    base,
    row: {
      supplier_id: str(fd, "supplier_id"),
      category_id: str(fd, "category_id"),
      allocation_key_id: str(fd, "allocation_key_id"),
      invoice_number: str(fd, "invoice_number"),
      invoice_date: str(fd, "invoice_date"),
      description: str(fd, "description"),
      base_cents: base ?? 0,
      vat_pct: decimalInput(fd, "vat_pct", 2) ?? "0",
      vat_cents: vat,
      irpf_pct: decimalInput(fd, "irpf_pct", 2) ?? "0",
      irpf_cents: irpf,
      total_cents: (base ?? 0) + vat,
      charged_to_reserve: bool(fd, "charged_to_reserve"),
      restricted: bool(fd, "restricted"),
      paid_date: paid ? str(fd, "paid_date") : null,
      paid_bank_account_id: paid ? str(fd, "paid_bank_account_id") : null,
    },
  };
}

export async function createExpense(cid: string, fd: FormData) {
  const { supabase } = await requireAdmin(cid);
  const path = `/admin/${cid}/gastos/nuevo`;
  const { base, row } = expenseFromForm(fd);
  if (base == null || !row.invoice_date || !row.category_id) back(path, { error: "Revisa la fecha, la partida y la base imponible (p. ej. 1.234,56)." });
  if (row.irpf_cents > row.total_cents) back(path, { error: "La retención no puede ser mayor que el total." });

  let documentId: string | null = null;
  const file = fd.get("file");
  if (file instanceof File && file.size > 0) {
    const { data: s } = row.supplier_id ? await supabase.from("suppliers").select("name").eq("id", row.supplier_id).single() : { data: null };
    const up = await uploadDocument(supabase, cid, file, {
      kind: "factura",
      title: [s?.name, row.invoice_number ? `Fra. ${row.invoice_number}` : null].filter(Boolean).join(" · ") || row.description || "Factura",
      doc_date: row.invoice_date,
      restricted: row.restricted,
      folder: `facturas/${row.invoice_date.slice(0, 4)}`,
    });
    if (up.error) back(path, { error: up.error });
    documentId = up.id!;
  }
  const { data, error } = await supabase.from("expenses").insert({ ...row, community_id: cid, document_id: documentId }).select("id").single();
  if (error) {
    if (documentId) await deleteDocumentFile(supabase, documentId);
    back(path, { error: friendlyError(error) });
  }
  back(`/admin/${cid}/gastos/${data.id}`, { ok: "Gasto registrado y contabilizado." });
}

export async function updateExpense(cid: string, eid: string, fd: FormData) {
  const { supabase } = await requireAdmin(cid);
  const path = `/admin/${cid}/gastos/${eid}`;
  const { base, row } = expenseFromForm(fd);
  if (base == null || !row.invoice_date || !row.category_id) back(path, { error: "Revisa la fecha, la partida y la base imponible." });
  const { error } = await supabase.from("expenses").update(row).eq("id", eid);
  if (error) back(path, { error: friendlyError(error) });
  const { data: e } = await supabase.from("expenses").select("document_id").eq("id", eid).single();
  if (e?.document_id) await supabase.from("documents").update({ restricted: row.restricted }).eq("id", e.document_id);
  back(path, { ok: "Cambios guardados. El asiento contable se ha regenerado." });
}

export async function replaceInvoiceFile(cid: string, eid: string, fd: FormData) {
  const { supabase } = await requireAdmin(cid);
  const path = `/admin/${cid}/gastos/${eid}`;
  const { data: e } = await supabase.from("expenses").select("*, suppliers(name)").eq("id", eid).single();
  if (!e) back(path, { error: "Gasto no encontrado." });
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) back(path, { error: "Selecciona un archivo." });
  const up = await uploadDocument(supabase, cid, file, {
    kind: "factura",
    title: [e.suppliers?.name, e.invoice_number ? `Fra. ${e.invoice_number}` : null].filter(Boolean).join(" · ") || "Factura",
    doc_date: e.invoice_date,
    restricted: e.restricted,
    folder: `facturas/${String(e.invoice_date).slice(0, 4)}`,
  });
  if (up.error) back(path, { error: up.error });
  await supabase.from("expenses").update({ document_id: up.id }).eq("id", eid);
  if (e.document_id) await deleteDocumentFile(supabase, e.document_id);
  back(path, { ok: "Factura escaneada adjuntada." });
}

export async function deleteExpense(cid: string, eid: string) {
  const { supabase } = await requireAdmin(cid);
  const { data: e } = await supabase.from("expenses").select("document_id").eq("id", eid).single();
  const { error } = await supabase.from("expenses").delete().eq("id", eid);
  if (error) back(`/admin/${cid}/gastos/${eid}`, { error: friendlyError(error) });
  if (e?.document_id) await deleteDocumentFile(supabase, e.document_id);
  back(`/admin/${cid}/gastos`, { ok: "Gasto eliminado y su asiento anulado." });
}
