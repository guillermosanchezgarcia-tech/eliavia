import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Flash } from "@/components/flash";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/submit-button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { SupplierFields, type Supplier } from "./supplier-fields";
import { createSupplier } from "./actions";

export const metadata = { title: "Proveedores" };

export default async function Suppliers({ params, searchParams }: { params: Promise<{ cid: string }>; searchParams: Promise<Record<string, string>> }) {
  const { cid } = await params;
  const sp = await searchParams;
  const { supabase } = await requireAdmin(cid);
  const { data } = await supabase.from("suppliers").select("*").eq("community_id", cid).order("name");
  const suppliers = (data ?? []) as Supplier[];
  return (
    <>
      <PageHeader title="Proveedores" />
      <Flash ok={sp.ok} error={sp.error} />
      <Card>
        <CardContent className="pt-5">
          <Table>
            <THead><TR><TH>Proveedor</TH><TH>NIF</TH><TH>Categoría</TH><TH>Fiscalidad</TH><TH></TH></TR></THead>
            <TBody>
              {suppliers.map((s) => (
                <TR key={s.id}>
                  <TD className="font-medium">{s.name}<div className="text-xs font-normal text-muted-foreground">{s.email}</div></TD>
                  <TD>{s.nif}</TD>
                  <TD>{s.category}</TD>
                  <TD className="space-x-1">
                    {s.applies_withholding ? <Badge variant="warning">IRPF {Number(s.withholding_pct).toLocaleString("es-ES")} %</Badge> : null}
                    {s.is_utility ? <Badge variant="muted">Suministro (fuera del 347)</Badge> : null}
                  </TD>
                  <TD className="text-right"><Link className="text-sm text-primary underline" href={`/admin/${cid}/proveedores/${s.id}`}>Editar</Link></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
      <Card className="mt-6">
        <CardHeader><CardTitle>Añadir proveedor</CardTitle></CardHeader>
        <CardContent>
          <form action={createSupplier.bind(null, cid)} className="grid gap-4 sm:grid-cols-2">
            <SupplierFields />
            <div className="sm:col-span-2"><SubmitButton>Añadir proveedor</SubmitButton></div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
