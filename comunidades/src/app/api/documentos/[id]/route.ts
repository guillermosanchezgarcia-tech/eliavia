import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Abre un documento: comprueba los permisos (RLS) y redirige a una URL firmada que caduca en 5 minutos.
 * Un propietario que intente abrir un documento restringido o de otra comunidad recibe un 404.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { data: doc } = await supabase.from("documents").select("storage_path").eq("id", id).maybeSingle();
  if (!doc) return NextResponse.json({ error: "Documento no encontrado o sin permiso" }, { status: 404 });
  const { data, error } = await supabase.storage.from("documentos").createSignedUrl(doc.storage_path, 300);
  if (error || !data) return NextResponse.json({ error: "No se pudo abrir el documento" }, { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
