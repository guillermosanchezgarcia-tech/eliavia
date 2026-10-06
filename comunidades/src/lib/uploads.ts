import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

function safeName(name: string) {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-80) || "documento";
}

/**
 * Sube un archivo al almacenamiento privado y crea su ficha en «documents».
 * Devuelve el id del documento o un mensaje de error.
 */
export async function uploadDocument(
  supabase: SupabaseClient,
  cid: string,
  file: File,
  meta: { kind: string; title: string; doc_date: string | null; restricted: boolean; folder: string }
): Promise<{ id?: string; error?: string }> {
  if (!file || file.size === 0) return { error: "No se ha seleccionado ningún archivo." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "El archivo supera el tamaño máximo de 10 MB." };
  const type = file.type || "application/octet-stream";
  if (!ALLOWED.includes(type)) return { error: "Formato no admitido. Usa PDF, JPG, PNG, WEBP o HEIC." };
  const path = `${cid}/${meta.folder}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const { error: upErr } = await supabase.storage.from("documentos").upload(path, file, { contentType: type, upsert: false });
  if (upErr) return { error: `No se pudo subir el archivo: ${upErr.message}` };
  const { data, error } = await supabase
    .from("documents")
    .insert({ community_id: cid, kind: meta.kind, title: meta.title, doc_date: meta.doc_date, storage_path: path, mime_type: type, size_bytes: file.size, restricted: meta.restricted })
    .select("id")
    .single();
  if (error) {
    await supabase.storage.from("documentos").remove([path]);
    return { error: error.message };
  }
  return { id: data.id };
}

export async function deleteDocumentFile(supabase: SupabaseClient, documentId: string) {
  const { data } = await supabase.from("documents").select("storage_path").eq("id", documentId).single();
  const { error } = await supabase.from("documents").delete().eq("id", documentId);
  if (!error && data) await supabase.storage.from("documentos").remove([data.storage_path]);
  return error;
}
