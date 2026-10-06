import { requireAdmin } from "@/lib/auth";
import { getOwners, getProperties, receiptState, type ReceiptView } from "@/lib/data";
import { formatDate, todayISO } from "@/lib/dates";
import { back } from "@/lib/flash";
import { friendlyError } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Flash } from "@/components/flash";
import { Money } from "@/components/money";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { Table, TBody, TD, TFoot, TH, THead, TR } from "@/components/ui/table";

export const metadata = { title: "Recibos" };

async function cancelReceipt(cid: string, id: string) {
  "use server";
  const { supabase } = await requireAdmin(cid);
  const { data: r } = await supabase.from("v_receipts").select("paid_cents").eq("id", id).single();
  if (r && Number(r.paid_cents) > 0) back(`/admin/${cid}/recibos`, { error: "No se puede anular un recibo con cobros aplicados." });
  const { error } = await supabase.from("receipts").update({ status: "cancelled" }).eq("id", id);
  if (error) back(`/admin/${cid}/recibos`, { error: friendlyError(error) });
  back(`/admin/${cid}/recibos`, { ok: "Recibo anulado. Su asiento contable se ha eliminado." });
}

export default async function Receipts({ params, searchParams }: { params: Promise<{ cid: string }>; searchParams: Promise<Record<string, string>> }) {
  const { cid } = await params;
  const sp = await searchParams;
  const { supabase } = await requireAdmin(cid);
  const today = todayISO();
  let q = supabase.from("v_receipts").select("*").eq("community_id", cid).order("due_date", { ascending: false }).order("code", { ascending: false }).limit(1000);
  if (sp.propietario) q = q.eq("owner_id", sp.propietario);
  if (sp.presupuesto) q = q.eq("budget_id", sp.presupuesto);
  if (sp.plazo) q = q.eq("installment", Number(sp.plazo));
  if (sp.anio) q = q.gte("issue_date", `${sp.anio}-01-01`).lte("issue_date", `${sp.anio}-12-31`);
  const [{ data }, owners, props] = await Promise.all([q, getOwners(supabase, cid), getProperties(supabase, cid)]);
  let receipts = (data ?? []) as ReceiptView[];
  if (sp.estado === "pendientes") receipts = receipts.filter((r) => r.status === "issued" && Number(r.paid_cents) < Number(r.amount_cents));
  if (sp.estado === "vencidos") receipts = receipts.filter((r) => r.status === "issued" && Number(r.paid_cents) < Number(r.amount_cents) && r.due_date < today);
  const ownerName = new Map(owners.map((o) => [o.id, o.full_name]));
  const code = new Map(props.map((p) => [p.id, p.code]));
  const active = receipts.filter((r) => r.status === "issued");
  const total = active.reduce((a, r) => a + Number(r.amount_cents), 0);
  const paid = active.reduce((a, r) => a + Number(r.paid_cents), 0);

  return (
    <>
      <PageHeader title="Recibos" description="Los cobros de cada propietario se aplican a sus recibos por orden de antigüedad." />
      <Flash ok={sp.ok} error={sp.error} />
      <form className="mb-4 flex flex-wrap items-end gap-2 no-print">
        <Select name="propietario" defaultValue={sp.propietario ?? ""} className="w-auto">
          <option value="">Todos los propietarios</option>
          {owners.map((o) => <option key={o.id} value={o.id}>{o.full_name}</option>)}
        </Select>
        <Select name="estado" defaultValue={sp.estado ?? ""} className="w-auto">
          <option value="">Todos los estados</option>
          <option value="pendientes">Pendientes de cobro</option>
          <option value="vencidos">Vencidos</option>
        </Select>
        <Select name="anio" defaultValue={sp.anio ?? ""} className="w-auto">
          <option value="">Todos los años</option>
          {[0, 1, 2].map((d) => { const y = Number(today.slice(0, 4)) - d; return <option key={y}>{y}</option>; })}
        </Select>
        <Button variant="outline" type="submit">Filtrar</Button>
      </form>
      <Card>
        <CardContent className="pt-5">
          <Table>
            <THead><TR><TH>Nº</TH><TH>Vencimiento</TH><TH>Inmueble</TH><TH>Propietario</TH><TH>Concepto</TH><TH className="text-right">Importe</TH><TH>Estado</TH><TH></TH></TR></THead>
            <TBody>
              {receipts.map((r) => {
                const st = receiptState(r, today);
                return (
                  <TR key={r.id}>
                    <TD className="whitespace-nowrap tabular">{r.code}</TD>
                    <TD>{formatDate(r.due_date)}</TD>
                    <TD>{code.get(r.property_id)}</TD>
                    <TD>{ownerName.get(r.owner_id)}</TD>
                    <TD className="max-w-64 truncate text-xs text-muted-foreground" title={r.concept}>{r.concept}</TD>
                    <TD className="text-right"><Money cents={r.amount_cents} /></TD>
                    <TD><Badge variant={st.variant}>{st.label}</Badge></TD>
                    <TD className="whitespace-nowrap text-right">
                      <a className="mr-2 text-xs text-primary underline" href={`/api/recibos/${r.id}/pdf`} target="_blank">PDF</a>
                      {r.status === "issued" && Number(r.paid_cents) === 0 ? (
                        <form action={cancelReceipt.bind(null, cid, r.id)} className="inline">
                          <SubmitButton variant="link" size="sm" className="h-auto text-xs text-destructive" confirm={`¿Anular el recibo ${r.code}?`}>Anular</SubmitButton>
                        </form>
                      ) : null}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
            <TFoot>
              <TR>
                <TD colSpan={5}>{active.length} recibos · cobrado <Money cents={paid} /> · pendiente <Money cents={total - paid} className="text-destructive" /></TD>
                <TD className="text-right"><Money cents={total} /></TD>
                <TD colSpan={2} />
              </TR>
            </TFoot>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
