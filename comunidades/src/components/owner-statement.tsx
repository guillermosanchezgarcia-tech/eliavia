import { formatDate } from "@/lib/dates";
import { PAYMENT_METHODS } from "@/lib/data";
import { Money } from "@/components/money";
import { Table, TBody, TD, TFoot, TH, THead, TR } from "@/components/ui/table";

export interface StatementReceipt {
  id: string;
  code: string;
  concept: string;
  issue_date: string;
  amount_cents: number;
  status: string;
}
export interface StatementPayment {
  id: string;
  payment_date: string;
  amount_cents: number;
  method: string;
  reference: string | null;
}

/** Extracto individual: cargos (recibos) y abonos (cobros) con saldo acumulado. */
export function OwnerStatement({ receipts, payments }: { receipts: StatementReceipt[]; payments: StatementPayment[] }) {
  const rows = [
    ...receipts.filter((r) => r.status !== "cancelled").map((r) => ({ key: "r" + r.id, date: r.issue_date, text: `Recibo ${r.code} · ${r.concept}`, debit: Number(r.amount_cents), credit: 0 })),
    ...payments.map((p) => ({ key: "p" + p.id, date: p.payment_date, text: `Pago (${PAYMENT_METHODS[p.method] ?? p.method})${p.reference ? " · " + p.reference : ""}`, debit: 0, credit: Number(p.amount_cents) })),
  ].sort((a, b) => a.date.localeCompare(b.date) || b.debit - a.debit);
  let running = 0;
  const totalD = rows.reduce((a, r) => a + r.debit, 0);
  const totalC = rows.reduce((a, r) => a + r.credit, 0);
  return (
    <Table>
      <THead>
        <TR><TH>Fecha</TH><TH>Concepto</TH><TH className="text-right">Cargo</TH><TH className="text-right">Abono</TH><TH className="text-right">Saldo</TH></TR>
      </THead>
      <TBody>
        {rows.length === 0 ? <TR><TD colSpan={5} className="text-muted-foreground">Sin movimientos.</TD></TR> : null}
        {rows.map((r) => {
          running += r.debit - r.credit;
          return (
            <TR key={r.key}>
              <TD className="whitespace-nowrap">{formatDate(r.date)}</TD>
              <TD className="min-w-56">{r.text}</TD>
              <TD className="text-right">{r.debit ? <Money cents={r.debit} /> : null}</TD>
              <TD className="text-right">{r.credit ? <Money cents={r.credit} /> : null}</TD>
              <TD className="text-right"><Money cents={running} signed /></TD>
            </TR>
          );
        })}
      </TBody>
      <TFoot>
        <TR>
          <TD colSpan={2}>Totales · saldo positivo = importe pendiente; negativo = saldo a favor</TD>
          <TD className="text-right"><Money cents={totalD} /></TD>
          <TD className="text-right"><Money cents={totalC} /></TD>
          <TD className="text-right"><Money cents={totalD - totalC} signed /></TD>
        </TR>
      </TFoot>
    </Table>
  );
}
