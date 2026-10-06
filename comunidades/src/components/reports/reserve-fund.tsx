import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { ReserveStatus } from "@/lib/data";
import { formatEuros, formatPct } from "@/lib/money";
import { monthLabel } from "@/lib/dates";
import { Money } from "@/components/money";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export function ReserveFundPanel({ status, evolution }: { status: ReserveStatus | null; evolution: { month: string; in_cents: number; out_cents: number; balance_cents: number }[] }) {
  if (!status) return null;
  const below = !!status.budget_id && status.balance_cents < status.minimum_cents;
  const max = Math.max(1, status.minimum_cents, ...evolution.map((e) => Number(e.balance_cents)));
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Saldo del fondo</div><div className="text-xl font-semibold tabular">{formatEuros(status.balance_cents)}</div></div>
        <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Mínimo legal ({formatPct(status.pct, 0)})</div><div className="text-xl font-semibold tabular">{formatEuros(status.minimum_cents)}</div></div>
        <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Base: {status.budget_name ?? "sin presupuesto aprobado"}</div><div className="text-xl font-semibold tabular">{formatEuros(status.base_budget_cents)}</div></div>
      </div>
      {!status.budget_id ? null : below ? (
        <Alert variant="danger">
          <AlertTriangle />
          <AlertTitle>Por debajo del mínimo</AlertTitle>
          <AlertDescription>
            El fondo no puede bajar del mínimo en ningún momento del ejercicio y lo dispuesto debe reponerse al inicio del siguiente
            (art. 9.1.f LPH). Reposición propuesta: <strong>{formatEuros(status.shortfall_cents)}</strong>.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert variant="success"><CheckCircle2 /><AlertDescription>El fondo de reserva cubre el mínimo legal.</AlertDescription></Alert>
      )}
      {evolution.length ? (
        <>
          <div className="flex h-36 items-end gap-1 rounded-lg border p-3" aria-label="Evolución del saldo">
            {evolution.map((e) => (
              <div key={e.month} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t"
                  style={{ height: `${(Math.max(0, Number(e.balance_cents)) / max) * 100}px`, background: Number(e.balance_cents) < status.minimum_cents ? "var(--destructive)" : "var(--primary)" }}
                  title={`${monthLabel(e.month)}: ${formatEuros(e.balance_cents)}`}
                />
                <span className="text-[10px] text-muted-foreground">{monthLabel(e.month).slice(0, 4)}</span>
              </div>
            ))}
          </div>
          <Table>
            <THead><TR><TH>Mes</TH><TH className="text-right">Entradas</TH><TH className="text-right">Salidas</TH><TH className="text-right">Saldo</TH></TR></THead>
            <TBody>
              {evolution.map((e) => (
                <TR key={e.month}>
                  <TD>{monthLabel(e.month)}</TD>
                  <TD className="text-right"><Money cents={e.in_cents} /></TD>
                  <TD className="text-right"><Money cents={e.out_cents} /></TD>
                  <TD className="text-right font-medium"><Money cents={e.balance_cents} /></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </>
      ) : null}
    </div>
  );
}
