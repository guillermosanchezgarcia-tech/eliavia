import Link from "next/link";
import { FileText, Lock, PiggyBank } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getCategories } from "@/lib/data";
import { formatDate, todayISO } from "@/lib/dates";
import { PageHeader } from "@/components/page-header";
import { Flash } from "@/components/flash";
import { Money } from "@/components/money";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Table, TBody, TD, TFoot, TH, THead, TR } from "@/components/ui/table";

export const metadata = { title: "Gastos y facturas" };

export default async function Expenses({ params, searchParams }: { params: Promise<{ cid: string }>; searchParams: Promise<Record<string, string>> }) {
  const { cid } = await params;
  const sp = await searchParams;
  const { supabase } = await requireAdmin(cid);
  const year = todayISO().slice(0, 4);
  const from = sp.desde || `${year}-01-01`;
  const to = sp.hasta || `${year}-12-31`;
  let q = supabase.from("expenses").select("*, suppliers(name)").eq("community_id", cid).gte("invoice_date", from).lte("invoice_date", to).order("invoice_date", { ascending: false });
  if (sp.proveedor) q = q.eq("supplier_id", sp.proveedor);
  if (sp.partida) q = q.eq("category_id", sp.partida);
  if (sp.pago === "pendiente") q = q.is("paid_date", null);
  if (sp.pago === "pagada") q = q.not("paid_date", "is", null);
  const [{ data: expenses }, cats, { data: suppliers }] = await Promise.all([q, getCategories(supabase, cid), supabase.from("suppliers").select("id, name").eq("community_id", cid).order("name")]);
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  const rows = expenses ?? [];
  const sum = (k: string) => rows.reduce((a, e) => a + Number(e[k]), 0);

  return (
    <>
      <PageHeader
        title="Gastos y facturas"
        description="Registro de facturas de proveedores con su documento escaneado."
        actions={<Link href={`/admin/${cid}/gastos/nuevo`} className={buttonVariants()}>Nuevo gasto</Link>}
      />
      <Flash ok={sp.ok} error={sp.error} />
      <form className="mb-4 flex flex-wrap items-end gap-2 no-print">
        <Input type="date" name="desde" defaultValue={from} className="w-auto" aria-label="Desde" />
        <Input type="date" name="hasta" defaultValue={to} className="w-auto" aria-label="Hasta" />
        <Select name="proveedor" defaultValue={sp.proveedor ?? ""} className="w-auto">
          <option value="">Todos los proveedores</option>
          {(suppliers ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <Select name="partida" defaultValue={sp.partida ?? ""} className="w-auto">
          <option value="">Todas las partidas</option>
          {cats.filter((c) => c.kind === "expense").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select name="pago" defaultValue={sp.pago ?? ""} className="w-auto">
          <option value="">Pagadas y pendientes</option>
          <option value="pendiente">Pendientes de pago</option>
          <option value="pagada">Pagadas</option>
        </Select>
        <Button variant="outline" type="submit">Filtrar</Button>
      </form>
      <Card>
        <CardContent className="pt-5">
          <Table>
            <THead>
              <TR><TH>Fecha</TH><TH>Proveedor / concepto</TH><TH>Partida</TH><TH className="text-right">Base</TH><TH className="text-right">IVA</TH><TH className="text-right">Ret. IRPF</TH><TH className="text-right">Total</TH><TH>Pago</TH><TH></TH></TR>
            </THead>
            <TBody>
              {rows.map((e) => (
                <TR key={e.id}>
                  <TD className="whitespace-nowrap">{formatDate(e.invoice_date)}</TD>
                  <TD>
                    <Link href={`/admin/${cid}/gastos/${e.id}`} className="font-medium text-primary hover:underline">{e.suppliers?.name ?? "Sin proveedor"}</Link>
                    <div className="max-w-72 truncate text-xs text-muted-foreground" title={e.description}>{e.invoice_number ? `Fra. ${e.invoice_number} · ` : ""}{e.description}</div>
                  </TD>
                  <TD className="text-sm">{catName.get(e.category_id)}</TD>
                  <TD className="text-right"><Money cents={e.base_cents} /></TD>
                  <TD className="text-right"><Money cents={e.vat_cents} /></TD>
                  <TD className="text-right">{Number(e.irpf_cents) ? <Money cents={e.irpf_cents} /> : null}</TD>
                  <TD className="text-right"><Money cents={e.total_cents} /></TD>
                  <TD>{e.paid_date ? <Badge variant="success">{formatDate(e.paid_date)}</Badge> : <Badge variant="warning">Pendiente</Badge>}</TD>
                  <TD className="whitespace-nowrap">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      {e.document_id ? <a href={`/api/documentos/${e.document_id}`} target="_blank" title="Ver factura escaneada"><FileText className="size-4 text-primary" /></a> : null}
                      {e.charged_to_reserve ? <span title="Con cargo al fondo de reserva"><PiggyBank className="size-4" /></span> : null}
                      {e.restricted ? <span title="Restringido"><Lock className="size-4" /></span> : null}
                    </span>
                  </TD>
                </TR>
              ))}
            </TBody>
            <TFoot>
              <TR>
                <TD colSpan={3}>{rows.length} facturas</TD>
                <TD className="text-right"><Money cents={sum("base_cents")} /></TD>
                <TD className="text-right"><Money cents={sum("vat_cents")} /></TD>
                <TD className="text-right"><Money cents={sum("irpf_cents")} /></TD>
                <TD className="text-right"><Money cents={sum("total_cents")} /></TD>
                <TD colSpan={2} />
              </TR>
            </TFoot>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
