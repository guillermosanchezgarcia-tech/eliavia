import { monthLabel, quarterLabel } from "@/lib/dates";
import type { IncomeExpenseReport, SummaryRow } from "@/lib/reports";
import { Money } from "@/components/money";
import { Table, TBody, TD, TFoot, TH, THead, TR } from "@/components/ui/table";

function Section({ title, items, total }: { title: string; items: { code: string; name: string; cents: number }[]; total: number }) {
  return (
    <Table>
      <THead><TR><TH>{title}</TH><TH className="text-right">Importe</TH></TR></THead>
      <TBody>
        {items.length === 0 ? <TR><TD colSpan={2} className="text-muted-foreground">Sin movimientos</TD></TR> : null}
        {items.map((i) => (
          <TR key={i.code}><TD>{i.name}</TD><TD className="text-right"><Money cents={i.cents} /></TD></TR>
        ))}
      </TBody>
      <TFoot><TR><TD>Total</TD><TD className="text-right"><Money cents={total} /></TD></TR></TFoot>
    </Table>
  );
}

/** Ingresos, gastos y fondo de reserva por partida. */
export function IncomeExpenseTables({ r }: { r: IncomeExpenseReport }) {
  const result = r.totalIncome - r.totalExpense;
  return (
    <div className="grid gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Ingresos" items={r.income} total={r.totalIncome} />
        <Section title="Gastos" items={r.expense} total={r.totalExpense} />
      </div>
      <div className="flex flex-wrap justify-between gap-2 rounded-lg bg-muted/60 px-4 py-3 text-sm">
        <span>Resultado del periodo (ingresos − gastos)</span>
        <Money cents={result} className={result < 0 ? "font-semibold text-destructive" : "font-semibold text-success"} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Fondo de reserva · aportaciones" items={r.reserveIn} total={r.totalReserveIn} />
        <Section title="Fondo de reserva · pagos con cargo al fondo" items={r.reserveOut} total={r.totalReserveOut} />
      </div>
    </div>
  );
}

/** Tabla cruzada partidas × periodos. */
export function PeriodBreakdown({ r, grain }: { r: IncomeExpenseReport; grain: "month" | "quarter" | "year" }) {
  const label = (p: string) => (grain === "month" ? monthLabel(p) : grain === "quarter" ? quarterLabel(p) : p.slice(0, 4));
  const block = (section: SummaryRow["section"], title: string) => {
    const cats = [...new Map(r.rows.filter((x) => x.section === section).map((x) => [x.category_code, x.category_name])).entries()].sort();
    const val = (code: string | null, p: string) => r.rows.filter((x) => x.section === section && x.category_code === code && x.period_start === p).reduce((a, x) => a + x.amount_cents, 0);
    const colTotal = (p: string) => r.rows.filter((x) => x.section === section && x.period_start === p).reduce((a, x) => a + x.amount_cents, 0);
    return (
      <>
        <TR className="bg-muted/50"><TD colSpan={r.periods.length + 2} className="font-semibold">{title}</TD></TR>
        {cats.map(([code, name]) => (
          <TR key={section + code}>
            <TD className="whitespace-nowrap">{name}</TD>
            {r.periods.map((p) => <TD key={p} className="text-right text-xs">{val(code, p) ? <Money cents={val(code, p)} /> : "—"}</TD>)}
            <TD className="text-right text-xs font-medium"><Money cents={r.periods.reduce((a, p) => a + val(code, p), 0)} /></TD>
          </TR>
        ))}
        <TR>
          <TD className="font-medium">Total {title.toLowerCase()}</TD>
          {r.periods.map((p) => <TD key={p} className="text-right text-xs font-medium"><Money cents={colTotal(p)} /></TD>)}
          <TD className="text-right text-xs font-semibold"><Money cents={r.periods.reduce((a, p) => a + colTotal(p), 0)} /></TD>
        </TR>
      </>
    );
  };
  return (
    <Table>
      <THead>
        <TR><TH>Partida</TH>{r.periods.map((p) => <TH key={p} className="text-right">{label(p)}</TH>)}<TH className="text-right">Total</TH></TR>
      </THead>
      <TBody>
        {block("income", "Ingresos")}
        {block("expense", "Gastos")}
      </TBody>
    </Table>
  );
}
