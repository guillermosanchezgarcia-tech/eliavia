import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { debtorsReport } from "@/lib/reports";
import { formatDate, todayISO } from "@/lib/dates";
import { Money } from "@/components/money";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TFoot, TH, THead, TR } from "@/components/ui/table";

export const metadata = { title: "Presidencia" };

/** Estado de cuentas completo para el presidente (solo lectura). */
export default async function Presidency({ params }: { params: Promise<{ cid: string }> }) {
  const { cid } = await params;
  const { supabase, canViewAccounts } = await requireMember(cid);
  if (!canViewAccounts) redirect(`/portal/${cid}`);
  const today = todayISO();
  const [{ data: banks }, debtors, { data: balances }] = await Promise.all([
    supabase.rpc("bank_balances", { p_community: cid }),
    debtorsReport(supabase, cid, today),
    supabase.from("v_owner_balances").select("*").eq("community_id", cid).order("full_name"),
  ]);
  return (
    <div className="grid grid-cols-1 gap-4">
      <div>
        <h1 className="text-xl font-semibold">Estado de cuentas · Presidencia</h1>
        <p className="text-sm text-muted-foreground">Información reservada a la presidencia y la administración. Solo lectura.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Tesorería</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TBody>
              {(banks ?? []).map((b: { bank_account_id: string; name: string; balance_cents: number }) => (
                <TR key={b.bank_account_id}><TD>{b.name}</TD><TD className="text-right"><Money cents={b.balance_cents} /></TD></TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Relación de deudores a {formatDate(today)}</CardTitle>
          <CardDescription>No la difundas: la relación de deudores solo puede figurar en la convocatoria de la junta (art. 16.2 LPH) y su publicación vulnera la protección de datos.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <THead><TR><TH>Propietario</TH><TH>Desde</TH><TH className="text-right">Vencido</TH></TR></THead>
            <TBody>
              {debtors.length === 0 ? <TR><TD colSpan={3} className="text-muted-foreground">Nadie debe recibos vencidos.</TD></TR> : null}
              {debtors.map((d) => <TR key={d.owner_id}><TD>{d.full_name}</TD><TD>{formatDate(d.oldest)}</TD><TD className="text-right"><Money cents={d.total} className="text-destructive" /></TD></TR>)}
            </TBody>
            <TFoot><TR><TD colSpan={2}>Total</TD><TD className="text-right"><Money cents={debtors.reduce((a, d) => a + d.total, 0)} /></TD></TR></TFoot>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Saldo de todos los propietarios</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <THead><TR><TH>Propietario</TH><TH className="text-right">Cargado</TH><TH className="text-right">Pagado</TH><TH className="text-right">Saldo</TH></TR></THead>
            <TBody>
              {(balances ?? []).map((b) => (
                <TR key={b.owner_id}>
                  <TD>{b.full_name}</TD>
                  <TD className="text-right"><Money cents={b.charged_cents} /></TD>
                  <TD className="text-right"><Money cents={b.paid_cents} /></TD>
                  <TD className="text-right"><Money cents={b.balance_cents} signed /></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
