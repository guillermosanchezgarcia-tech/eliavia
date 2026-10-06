import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { formatDate, todayISO } from "@/lib/dates";
import { PageHeader } from "@/components/page-header";
import { Flash } from "@/components/flash";
import { Money } from "@/components/money";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { createBudget } from "./actions";

export const metadata = { title: "Presupuestos y derramas" };

export default async function Budgets({ params, searchParams }: { params: Promise<{ cid: string }>; searchParams: Promise<Record<string, string>> }) {
  const { cid } = await params;
  const sp = await searchParams;
  const { supabase } = await requireAdmin(cid);
  const { data: budgets } = await supabase.from("budgets").select("*, budget_lines(amount_cents)").eq("community_id", cid).order("first_due_date", { ascending: false });
  const nextYear = Number(todayISO().slice(0, 4)) + 1;

  return (
    <>
      <PageHeader title="Presupuestos y derramas" description="El administrador prepara el plan de gastos previsibles y la junta lo aprueba (art. 14 y 20 LPH)." />
      <Flash ok={sp.ok} error={sp.error} />
      <Card>
        <CardContent className="pt-5">
          <Table>
            <THead><TR><TH>Nombre</TH><TH>Tipo</TH><TH>Plazos</TH><TH>Primer vencimiento</TH><TH>Estado</TH><TH className="text-right">Total</TH></TR></THead>
            <TBody>
              {(budgets ?? []).map((b) => (
                <TR key={b.id}>
                  <TD><Link className="font-medium text-primary hover:underline" href={`/admin/${cid}/presupuestos/${b.id}`}>{b.name}</Link></TD>
                  <TD>{b.kind === "ordinary" ? "Ordinario" : <Badge variant="warning">Derrama</Badge>}</TD>
                  <TD>{b.installments} {b.installments > 1 ? `(cada ${b.interval_months} mes${b.interval_months > 1 ? "es" : ""})` : ""}</TD>
                  <TD>{formatDate(b.first_due_date)}</TD>
                  <TD>{b.status === "approved" ? <Badge variant="success">Aprobado {formatDate(b.approved_at)}</Badge> : <Badge variant="muted">Borrador</Badge>}</TD>
                  <TD className="text-right"><Money cents={(b.budget_lines ?? []).reduce((a: number, l: { amount_cents: number }) => a + Number(l.amount_cents), 0)} /></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Nuevo presupuesto o derrama</CardTitle>
          <CardDescription>Una derrama es una cuota extraordinaria (obras, reparaciones…) con su propio reparto y plazos.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createBudget.bind(null, cid)} className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" className="sm:col-span-2"><Input name="name" defaultValue={`Presupuesto ordinario ${nextYear}`} required /></Field>
            <Field label="Tipo">
              <Select name="kind"><option value="ordinary">Presupuesto ordinario</option><option value="extraordinary">Derrama (extraordinario)</option></Select>
            </Field>
            <Field label="Primer vencimiento"><Input type="date" name="first_due_date" defaultValue={`${nextYear}-01-01`} required /></Field>
            <Field label="Número de plazos" hint="12 = mensual, 4 = trimestral, 1 = pago único"><Input type="number" name="installments" min={1} max={60} defaultValue={4} /></Field>
            <Field label="Meses entre plazos"><Input type="number" name="interval_months" min={1} max={12} defaultValue={3} /></Field>
            <Field label="Copiar partidas de" className="sm:col-span-2">
              <Select name="copy_from" defaultValue={budgets?.find((b) => b.kind === "ordinary")?.id ?? ""}>
                <option value="">— Empezar vacío —</option>
                {(budgets ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </Field>
            <Field label="Notas" className="sm:col-span-2"><Textarea name="notes" className="min-h-16" /></Field>
            <div className="sm:col-span-2"><SubmitButton>Crear</SubmitButton></div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
