import { Download } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getReserveStatus } from "@/lib/data";
import { budgetVsActual, debtorsReport, incomeExpenseReport } from "@/lib/reports";
import { formatDate, todayISO } from "@/lib/dates";
import { PageHeader } from "@/components/page-header";
import { Money } from "@/components/money";
import { PrintButton } from "@/components/print-button";
import { IncomeExpenseTables, PeriodBreakdown } from "@/components/reports/income-expense";
import { BudgetVsActualTable } from "@/components/reports/budget-vs-actual";
import { ReserveFundPanel } from "@/components/reports/reserve-fund";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TFoot, TH, THead, TR } from "@/components/ui/table";

export const metadata = { title: "Informes" };

export default async function Reports({ params, searchParams }: { params: Promise<{ cid: string }>; searchParams: Promise<Record<string, string>> }) {
  const { cid } = await params;
  const sp = await searchParams;
  const { supabase, community } = await requireAdmin(cid);
  const today = todayISO();
  const year = sp.anio ?? today.slice(0, 4);
  const from = sp.desde || `${year}-01-01`;
  const to = sp.hasta || `${year}-12-31`;
  const grain = (["month", "quarter", "year"].includes(sp.agrupar) ? sp.agrupar : "month") as "month" | "quarter" | "year";

  const { data: budgets } = await supabase.from("budgets").select("id, name, kind, first_due_date").eq("community_id", cid).eq("kind", "ordinary").order("first_due_date", { ascending: false });
  const budgetId = sp.presupuesto ?? budgets?.find((b) => b.first_due_date.startsWith(year))?.id ?? budgets?.[0]?.id;

  const [report, bva, reserve, { data: evolution }, { data: banks }, debtors] = await Promise.all([
    incomeExpenseReport(supabase, cid, from, to, grain),
    budgetId ? budgetVsActual(supabase, budgetId) : Promise.resolve([]),
    getReserveStatus(supabase, cid),
    supabase.rpc("reserve_fund_evolution", { p_community: cid }),
    supabase.rpc("bank_balances", { p_community: cid }),
    debtorsReport(supabase, cid, today),
  ]);
  const qs = new URLSearchParams({ desde: from, hasta: to, agrupar: grain, ...(budgetId ? { presupuesto: budgetId } : {}) }).toString();

  return (
    <>
      <PageHeader
        title="Informes"
        description={`${community.name} · del ${formatDate(from)} al ${formatDate(to)}`}
        actions={
          <>
            <a href={`/api/informes/${cid}?${qs}`} className={buttonVariants({ variant: "outline" })}><Download /> Excel</a>
            <PrintButton />
          </>
        }
      />
      <form className="mb-6 flex flex-wrap items-end gap-2 no-print">
        <Select name="anio" defaultValue={year} className="w-auto">
          {[0, 1, 2, 3].map((d) => { const y = String(Number(today.slice(0, 4)) - d); return <option key={y}>{y}</option>; })}
        </Select>
        <Input type="date" name="desde" defaultValue={sp.desde ?? ""} className="w-auto" aria-label="Desde (opcional)" />
        <Input type="date" name="hasta" defaultValue={sp.hasta ?? ""} className="w-auto" aria-label="Hasta (opcional)" />
        <Select name="agrupar" defaultValue={grain} className="w-auto">
          <option value="month">Por meses</option>
          <option value="quarter">Por trimestres</option>
          <option value="year">Por años</option>
        </Select>
        <Button variant="outline" type="submit">Actualizar</Button>
      </form>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Desglose de ingresos y gastos por partida</CardTitle>
            <CardDescription>Criterio de devengo: cuotas por la fecha de emisión del recibo y gastos por la fecha de la factura. Cuadra con los asientos contables.</CardDescription>
          </CardHeader>
          <CardContent><IncomeExpenseTables r={report} /></CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Evolución por {grain === "month" ? "meses" : grain === "quarter" ? "trimestres" : "años"}</CardTitle></CardHeader>
          <CardContent><PeriodBreakdown r={report} grain={grain} /></CardContent>
        </Card>

        <Card>
          <CardHeader className="sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Presupuesto frente a gasto real</CardTitle>
              <CardDescription>Desviaciones de cada partida del presupuesto ordinario.</CardDescription>
            </div>
            <form className="flex gap-2 no-print">
              <input type="hidden" name="anio" value={year} />
              <Select name="presupuesto" defaultValue={budgetId} className="w-auto">
                {(budgets ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
              <Button variant="outline" size="sm" type="submit" className="h-10">Ver</Button>
            </form>
          </CardHeader>
          <CardContent>{bva.length ? <BudgetVsActualTable rows={bva} /> : <p className="text-sm text-muted-foreground">No hay presupuesto ordinario.</p>}</CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Tesorería</CardTitle><CardDescription>Saldo actual de cada cuenta.</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <TBody>
                  {(banks ?? []).map((b: { bank_account_id: string; name: string; iban: string | null; balance_cents: number }) => (
                    <TR key={b.bank_account_id}><TD>{b.name}<div className="text-xs text-muted-foreground">{b.iban}</div></TD><TD className="text-right"><Money cents={b.balance_cents} /></TD></TR>
                  ))}
                </TBody>
                <TFoot><TR><TD>Total</TD><TD className="text-right"><Money cents={(banks ?? []).reduce((a: number, b: { balance_cents: number }) => a + Number(b.balance_cents), 0)} /></TD></TR></TFoot>
              </Table>
            </CardContent>
          </Card>
          <Card id="fondo">
            <CardHeader><CardTitle>Fondo de reserva</CardTitle></CardHeader>
            <CardContent><ReserveFundPanel status={reserve} evolution={(evolution ?? []).map((e: { month: string; in_cents: number; out_cents: number; balance_cents: number }) => e)} /></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Deudores · antigüedad de la deuda a {formatDate(today)}</CardTitle>
            <CardDescription>
              Uso interno de la administración y la presidencia. No debe publicarse (la AEPD sanciona su difusión); solo se incluye en la
              convocatoria de la junta (art. 16.2 LPH).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <THead><TR><TH>Propietario</TH><TH className="text-right">0–30 días</TH><TH className="text-right">31–90</TH><TH className="text-right">91–180</TH><TH className="text-right">+180</TH><TH className="text-right">Total</TH></TR></THead>
              <TBody>
                {debtors.length === 0 ? <TR><TD colSpan={6} className="text-muted-foreground">No hay deudas vencidas.</TD></TR> : null}
                {debtors.map((d) => (
                  <TR key={d.owner_id}>
                    <TD>{d.full_name}<div className="text-xs text-muted-foreground">{d.receipts} recibo(s) · desde {formatDate(d.oldest)}</div></TD>
                    {d.buckets.map((b, i) => <TD key={i} className="text-right">{b ? <Money cents={b} /> : "—"}</TD>)}
                    <TD className="text-right font-semibold"><Money cents={d.total} className="text-destructive" /></TD>
                  </TR>
                ))}
              </TBody>
              <TFoot>
                <TR>
                  <TD>Total</TD>
                  {[0, 1, 2, 3].map((i) => <TD key={i} className="text-right"><Money cents={debtors.reduce((a, d) => a + d.buckets[i], 0)} /></TD>)}
                  <TD className="text-right"><Money cents={debtors.reduce((a, d) => a + d.total, 0)} /></TD>
                </TR>
              </TFoot>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
