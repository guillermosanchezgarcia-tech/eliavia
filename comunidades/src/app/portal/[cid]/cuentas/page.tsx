import { requireMember } from "@/lib/auth";
import { getCategories, getReserveStatus } from "@/lib/data";
import { budgetVsActual, incomeExpenseReport } from "@/lib/reports";
import { formatDate, todayISO } from "@/lib/dates";
import { BarList } from "@/components/bar-list";
import { Money } from "@/components/money";
import { BudgetVsActualTable } from "@/components/reports/budget-vs-actual";
import { ReserveFundPanel } from "@/components/reports/reserve-fund";
import { IncomeExpenseTables } from "@/components/reports/income-expense";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Table, TBody, TD, TFoot, TH, THead, TR } from "@/components/ui/table";

export const metadata = { title: "Cuentas de la comunidad" };

export default async function Accounts({ params, searchParams }: { params: Promise<{ cid: string }>; searchParams: Promise<Record<string, string>> }) {
  const { cid } = await params;
  const sp = await searchParams;
  const { supabase } = await requireMember(cid);
  const thisYear = todayISO().slice(0, 4);
  const year = sp.anio ?? thisYear;
  const [report, reserve, { data: evolution }, cats, { data: budgets }] = await Promise.all([
    incomeExpenseReport(supabase, cid, `${year}-01-01`, `${year}-12-31`, "year"),
    getReserveStatus(supabase, cid),
    supabase.rpc("reserve_fund_evolution", { p_community: cid }),
    getCategories(supabase, cid),
    // Los propietarios solo ven presupuestos aprobados (RLS)
    supabase.from("budgets").select("id, name, kind, approved_at, first_due_date, budget_lines(amount_cents, category_id, description)").eq("community_id", cid).eq("status", "approved").order("first_due_date", { ascending: false }),
  ]);
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  const budget = (budgets ?? []).find((b) => b.kind === "ordinary" && b.first_due_date.startsWith(year)) ?? (budgets ?? []).find((b) => b.kind === "ordinary");
  const bva = budget ? await budgetVsActual(supabase, budget.id) : [];

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Cuentas de la comunidad</h1>
        <form className="flex gap-2">
          <Select name="anio" defaultValue={year} className="w-auto">
            {[0, 1, 2].map((d) => { const y = String(Number(thisYear) - d); return <option key={y}>{y}</option>; })}
          </Select>
          <Button variant="outline" type="submit">Ver</Button>
        </form>
      </div>

      <Card>
        <CardHeader><CardTitle>Gastos por partida · {year}</CardTitle></CardHeader>
        <CardContent>
          {report.expense.length ? <BarList items={report.expense.map((e) => ({ label: e.name, cents: e.cents }))} /> : <p className="text-sm text-muted-foreground">Sin gastos registrados.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ingresos y gastos · {year}</CardTitle>
          <CardDescription>Importes globales de la comunidad (sin datos de ningún propietario).</CardDescription>
        </CardHeader>
        <CardContent><IncomeExpenseTables r={report} /></CardContent>
      </Card>

      {budget ? (
        <Card>
          <CardHeader>
            <CardTitle>{budget.name}</CardTitle>
            <CardDescription>Aprobado en junta el {formatDate(budget.approved_at)}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-6">
            <Table>
              <THead><TR><TH>Partida</TH><TH className="text-right">Importe</TH></TR></THead>
              <TBody>
                {(budget.budget_lines ?? []).map((l: { amount_cents: number; category_id: string; description: string | null }, i: number) => (
                  <TR key={i}><TD>{catName.get(l.category_id)}<div className="text-xs text-muted-foreground">{l.description}</div></TD><TD className="text-right"><Money cents={l.amount_cents} /></TD></TR>
                ))}
              </TBody>
              <TFoot><TR><TD>Total</TD><TD className="text-right"><Money cents={(budget.budget_lines ?? []).reduce((a: number, l: { amount_cents: number }) => a + Number(l.amount_cents), 0)} /></TD></TR></TFoot>
            </Table>
            <div>
              <h4 className="mb-2 text-sm font-semibold">Presupuesto frente a gasto real</h4>
              <BudgetVsActualTable rows={bva} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader><CardTitle>Fondo de reserva</CardTitle></CardHeader>
        <CardContent><ReserveFundPanel status={reserve} evolution={evolution ?? []} /></CardContent>
      </Card>
    </div>
  );
}
