import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import type { Property } from "@/lib/data";
import { formatDate } from "@/lib/dates";
import { PageHeader } from "@/components/page-header";
import { Flash } from "@/components/flash";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/submit-button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { PropertyFields } from "../property-fields";
import { deleteProperty, updateProperty } from "../actions";

export default async function EditProperty({ params, searchParams }: { params: Promise<{ cid: string; pid: string }>; searchParams: Promise<Record<string, string>> }) {
  const { cid, pid } = await params;
  const sp = await searchParams;
  const { supabase } = await requireAdmin(cid);
  const { data: p } = await supabase.from("properties").select("*").eq("id", pid).eq("community_id", cid).single();
  if (!p) notFound();
  const [{ data: groups }, { data: members }, { data: history }] = await Promise.all([
    supabase.from("property_groups").select("id, name").eq("community_id", cid).order("name"),
    supabase.from("property_group_members").select("group_id").eq("property_id", pid),
    supabase.from("ownerships").select("id, start_date, end_date, owners(id, full_name)").eq("property_id", pid).order("start_date", { ascending: false }),
  ]);
  return (
    <>
      <PageHeader title={`Inmueble ${p.code}`} actions={<Link href={`/admin/${cid}/inmuebles`} className="text-sm text-primary underline">← Volver</Link>} />
      <Flash ok={sp.ok} error={sp.error} />
      <Card>
        <CardContent className="pt-5">
          <form action={updateProperty.bind(null, cid, pid)} className="grid gap-4 sm:grid-cols-2">
            <PropertyFields p={p as Property} groups={groups ?? []} memberOf={new Set((members ?? []).map((m) => m.group_id))} />
            <div className="sm:col-span-2"><SubmitButton>Guardar cambios</SubmitButton></div>
          </form>
        </CardContent>
      </Card>
      <Card className="mt-6">
        <CardHeader><CardTitle>Histórico de titulares</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <THead><TR><TH>Titular</TH><TH>Desde</TH><TH>Hasta</TH></TR></THead>
            <TBody>
              {(history ?? []).map((h) => {
                const row = h as unknown as { id: string; start_date: string; end_date: string | null; owners: { id: string; full_name: string } };
                return (
                  <TR key={row.id}>
                    <TD><Link className="text-primary hover:underline" href={`/admin/${cid}/propietarios/${row.owners.id}`}>{row.owners.full_name}</Link></TD>
                    <TD>{formatDate(row.start_date)}</TD>
                    <TD>{row.end_date ? formatDate(row.end_date) : "Actualidad"}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">Para registrar una compraventa, usa «Cambio de titular» en la ficha del nuevo propietario.</p>
        </CardContent>
      </Card>
      <form action={deleteProperty.bind(null, cid, pid)} className="mt-6">
        <SubmitButton variant="outline" className="text-destructive" confirm="¿Seguro que quieres eliminar este inmueble? Solo es posible si no tiene recibos.">Eliminar inmueble</SubmitButton>
      </form>
    </>
  );
}
