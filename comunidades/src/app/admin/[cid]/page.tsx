import Link from "next/link";
import { AlertTriangle, Landmark, PiggyBank, Receipt, Wallet } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getProperties, getReserveStatus } from "@/lib/data";
import { coefficientsSumTo100, coefficientsTotal } from "@/lib/reparto";
import { formatEuros, formatPct } from "@/lib/money";
import { formatDate, todayISO } from "@/lib/dates";
import { PageHeader } from "@/components/page-header";
import { Flash } from "@/components/flash";
import { Stat } from "@/components/stat";
import { Money } from "@/components/money";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export default async function Dashboard({ params, searchParams }: { params: Promise<{ cid: string }>; searchParams: Promise<Record<string, string>> }) {
  const { cid } = await params;
  const sp = await searchParams;
  const { supabase, community } = await requireAdmin(cid);
  const today = todayISO();

  const [props, reserve, banks, balances, unpaidExpenses, lastPayments] = await Promise.all([
    getProperties(supabase, cid),
    getReserveStatus(supabase, cid),
    supabase.rpc("bank_balances", { p_community: cid }),
    supabase.from("v_owner_balances").select("*").eq("community_id", cid),
    supabase.from("expenses").select("payable_cents").eq("community_id", cid).is("paid_date", null),
    supabase.from("payments").select("id, payment_date, amount_cents, owner_id, reference, owners(full_name), categories(name)").eq("community_id", cid).order("payment_date", { ascending: false }).limit(6),
  ]);

  const treasury = (banks.data ?? []).reduce((a: number, b: { balance_cents: number }) => a + Number(b.balance_cents), 0);
  const debtors = (balances.data ?? []).filter((b) => Number(b.overdue_cents) > 0);
  const overdue = debtors.reduce((a, b) => a + Number(b.overdue_cents), 0);
  const pendingPay = (unpaidExpenses.data ?? []).reduce((a, e) => a + Number(e.payable_cents), 0);
  const coefOk = coefficientsSumTo100(props);

  return (
    <>
      <PageHeader title="Resumen" description={`${community.name} · datos a ${formatDate(today)}`} />
      <Flash ok={sp.ok} error={sp.error} />

      {!coefOk && props.length > 0 ? (
        <Alert variant="warning" className="mb-4">
          <AlertTriangle />
          <AlertTitle>Los coeficientes no suman 100 %</AlertTitle>
          <AlertDescription>
            Ahora suman {formatPct(Number(coefficientsTotal(props)) / 10000, 4)}. Revísalos en <Link className="underline" href={`/admin/${cid}/inmuebles`}>Inmuebles</Link>.
          </AlertDescription>
        </Alert>
      ) : null}

      {reserve && reserve.budget_id && reserve.balance_cents < reserve.minimum_cents ? (
        <Alert variant="danger" className="mb-4">
          <AlertTriangle />
          <AlertTitle>El fondo de reserva está por debajo del mínimo legal</AlertTitle>
          <AlertDescription>
            Saldo {formatEuros(reserve.balance_cents)} · mínimo {formatEuros(reserve.minimum_cents)} ({formatPct(reserve.pct, 0)} de «{reserve.budget_name}»).
            Se propone reponer <strong>{formatEuros(reserve.shortfall_cents)}</strong> al inicio del próximo ejercicio (art. 9.1.f LPH).{" "}
            <Link className="underline" href={`/admin/${cid}/informes#fondo`}>Ver detalle</Link>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Tesorería" value={formatEuros(treasury)} hint="Saldo de bancos y caja" icon={<Landmark className="size-4" />} />
        <Stat
          label="Fondo de reserva"
          value={formatEuros(reserve?.balance_cents ?? 0)}
          hint={reserve?.budget_id ? `Mínimo ${formatEuros(reserve.minimum_cents)}` : "Sin presupuesto aprobado"}
          tone={reserve && reserve.budget_id && reserve.balance_cents < reserve.minimum_cents ? "danger" : "success"}
          icon={<PiggyBank className="size-4" />}
        />
        <Stat label="Recibos vencidos sin cobrar" value={formatEuros(overdue)} hint={`${debtors.length} propietario(s) con deuda`} tone={overdue > 0 ? "warning" : "success"} icon={<Receipt className="size-4" />} />
        <Stat label="Facturas pendientes de pago" value={formatEuros(pendingPay)} hint={`${unpaidExpenses.data?.length ?? 0} factura(s)`} icon={<Wallet className="size-4" />} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Cuentas bancarias</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TBody>
                {(banks.data ?? []).map((b: { bank_account_id: string; name: string; iban: string | null; balance_cents: number }) => (
                  <TR key={b.bank_account_id}>
                    <TD>{b.name}<div className="text-xs text-muted-foreground">{b.iban}</div></TD>
                    <TD className="text-right"><Money cents={b.balance_cents} /></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Últimos cobros</CardTitle>
            <Link href={`/admin/${cid}/cobros`} className="text-sm text-primary underline">Registrar cobro</Link>
          </CardHeader>
          <CardContent>
            <Table>
              <TBody>
                {(lastPayments.data ?? []).map((p) => {
                  const row = p as unknown as { id: string; payment_date: string; amount_cents: number; reference: string | null; owners: { full_name: string } | null; categories: { name: string } | null };
                  return (
                    <TR key={row.id}>
                      <TD className="whitespace-nowrap">{formatDate(row.payment_date)}</TD>
                      <TD>{row.owners?.full_name ?? row.categories?.name}<div className="text-xs text-muted-foreground">{row.reference}</div></TD>
                      <TD className="text-right"><Money cents={row.amount_cents} /></TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Propietarios con recibos vencidos</CardTitle>
            <span className="text-xs text-muted-foreground">Información reservada: no se publica en el portal</span>
          </CardHeader>
          <CardContent>
            {debtors.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todos los propietarios están al corriente.</p>
            ) : (
              <Table>
                <THead><TR><TH>Propietario</TH><TH>Vencido desde</TH><TH className="text-right">Importe vencido</TH></TR></THead>
                <TBody>
                  {debtors.map((d) => (
                    <TR key={d.owner_id}>
                      <TD><Link className="text-primary underline-offset-4 hover:underline" href={`/admin/${cid}/propietarios/${d.owner_id}`}>{d.full_name}</Link></TD>
                      <TD>{formatDate(d.oldest_due_date)}</TD>
                      <TD className="text-right"><Money cents={d.overdue_cents} className="text-destructive" /></TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
