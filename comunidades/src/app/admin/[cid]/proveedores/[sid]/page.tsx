import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Flash } from "@/components/flash";
import { Card, CardContent } from "@/components/ui/card";
import { SubmitButton } from "@/components/submit-button";
import { SupplierFields, type Supplier } from "../supplier-fields";
import { deleteSupplier, updateSupplier } from "../actions";

export default async function EditSupplier({ params, searchParams }: { params: Promise<{ cid: string; sid: string }>; searchParams: Promise<Record<string, string>> }) {
  const { cid, sid } = await params;
  const sp = await searchParams;
  const { supabase } = await requireAdmin(cid);
  const { data } = await supabase.from("suppliers").select("*").eq("id", sid).eq("community_id", cid).single();
  if (!data) notFound();
  return (
    <>
      <PageHeader title={data.name} actions={<Link href={`/admin/${cid}/proveedores`} className="text-sm text-primary underline">← Volver</Link>} />
      <Flash ok={sp.ok} error={sp.error} />
      <Card>
        <CardContent className="pt-5">
          <form action={updateSupplier.bind(null, cid, sid)} className="grid gap-4 sm:grid-cols-2">
            <SupplierFields s={data as Supplier} />
            <div className="sm:col-span-2"><SubmitButton>Guardar</SubmitButton></div>
          </form>
        </CardContent>
      </Card>
      <form action={deleteSupplier.bind(null, cid, sid)} className="mt-4">
        <SubmitButton variant="ghost" className="text-destructive" confirm="¿Eliminar este proveedor?">Eliminar proveedor</SubmitButton>
      </form>
    </>
  );
}
