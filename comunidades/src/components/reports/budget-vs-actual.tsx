import type { BudgetVsActualRow } from "@/lib/reports";
import { Money } from "@/components/money";
import { Table, TBody, TD, TFoot, TH, THead, TR } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function BudgetVsActualTable({ rows }: { rows: BudgetVsActualRow[] }) {
  const tb = rows.reduce((a, r) => a + r.budget_cents, 0);
  const ta = rows.reduce((a, r) => a + r.actual_cents, 0);
  const pct = (b: number, a: number) => (b ? `${(((a - b) / b) * 100).toLocaleString("es-ES", { maximumFractionDigits: 1 })} %` : "—");
  return (
    <Table>
      <THead><TR><TH>Partida</TH><TH className="text-right">Presupuesto</TH><TH className="text-right">Real</TH><TH className="text-right">Desviación</TH><TH className="text-right">%</TH></TR></THead>
      <TBody>
        {rows.map((r) => {
          const dev = r.actual_cents - r.budget_cents;
          const bad = r.category_kind === "expense" ? dev > 0 : dev < 0;
          return (
            <TR key={r.category_id}>
              <TD>{r.category_name}{r.category_kind === "reserve" ? <span className="text-xs text-muted-foreground"> (aportaciones emitidas)</span> : null}</TD>
              <TD className="text-right"><Money cents={r.budget_cents} /></TD>
              <TD className="text-right"><Money cents={r.actual_cents} /></TD>
              <TD className={cn("text-right", bad ? "text-destructive" : "text-success")}><Money cents={dev} /></TD>
              <TD className={cn("text-right text-xs", bad ? "text-destructive" : "text-success")}>{pct(r.budget_cents, r.actual_cents)}</TD>
            </TR>
          );
        })}
      </TBody>
      <TFoot>
        <TR>
          <TD>Total</TD>
          <TD className="text-right"><Money cents={tb} /></TD>
          <TD className="text-right"><Money cents={ta} /></TD>
          <TD className="text-right"><Money cents={ta - tb} /></TD>
          <TD className="text-right text-xs">{pct(tb, ta)}</TD>
        </TR>
      </TFoot>
    </Table>
  );
}
