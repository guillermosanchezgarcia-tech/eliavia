import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { receiptPdf } from "@/lib/pdf";

/** Recibo en PDF. Los permisos RLS garantizan que cada propietario solo descarga los suyos. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { data: r } = await supabase.from("v_receipts").select("*").eq("id", id).maybeSingle();
  if (!r) return NextResponse.json({ error: "Recibo no encontrado o sin permiso" }, { status: 404 });
  const [{ data: community }, { data: owner }, { data: property }, { data: lines }, { data: bank }] = await Promise.all([
    supabase.from("communities").select("name, cif, address, postal_code, city").eq("id", r.community_id).single(),
    supabase.from("owners").select("full_name, nif").eq("id", r.owner_id).single(),
    supabase.from("properties").select("code").eq("id", r.property_id).single(),
    supabase.from("receipt_lines").select("amount_cents, categories(name)").eq("receipt_id", id),
    supabase.from("bank_accounts").select("iban").eq("community_id", r.community_id).eq("is_default", true).maybeSingle(),
  ]);
  const bytes = await receiptPdf({
    community: { name: community?.name ?? "", cif: community?.cif, address: community?.address, city: [community?.postal_code, community?.city].filter(Boolean).join(" ") },
    code: r.code,
    concept: r.concept,
    issueDate: r.issue_date,
    dueDate: r.due_date,
    owner: { name: owner?.full_name ?? "", nif: owner?.nif },
    property: property?.code ?? "",
    lines: (lines ?? []).map((l) => ({ label: (l.categories as unknown as { name: string } | null)?.name ?? "", cents: Number(l.amount_cents) })),
    totalCents: Number(r.amount_cents),
    paidCents: Number(r.paid_cents),
    iban: bank?.iban,
  });
  return new NextResponse(Buffer.from(bytes), {
    headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="recibo-${String(r.code).replace("/", "-")}.pdf"` },
  });
}
