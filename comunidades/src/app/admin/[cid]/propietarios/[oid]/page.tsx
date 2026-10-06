import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getProperties, type Owner } from "@/lib/data";
import { formatDate, todayISO } from "@/lib/dates";
import { PageHeader } from "@/components/page-header";
import { Flash } from "@/components/flash";
import { Money } from "@/components/money";
import { OwnerStatement } from "@/components/owner-statement";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { OwnerFields } from "../owner-fields";
import { deleteOwner, giveAccess, revokeAccess, setPresident, transferProperty, updateOwner } from "../actions";

export default async function OwnerDetail({ params, searchParams }: { params: Promise<{ cid: string; oid: string }>; searchParams: Promise<Record<string, string>> }) {
  const { cid, oid } = await params;
  const sp = await searchParams;
  const { supabase } = await requireAdmin(cid);
  const { data: owner } = await supabase.from("owners").select("*").eq("id", oid).eq("community_id", cid).single();
  if (!owner) notFound();
  const o = owner as Owner;
  const today = todayISO();
  const [props, { data: ships }, { data: receipts }, { data: payments }, { data: bal }, { data: roles }] = await Promise.all([
    getProperties(supabase, cid),
    supabase.from("ownerships").select("*").eq("owner_id", oid).order("start_date", { ascending: false }),
    supabase.from("v_receipts").select("*").eq("owner_id", oid).order("issue_date"),
    supabase.from("payments").select("*").eq("owner_id", oid).order("payment_date"),
    supabase.from("v_owner_balances").select("*").eq("owner_id", oid).single(),
    o.user_id ? supabase.from("memberships").select("role").eq("community_id", cid).eq("user_id", o.user_id) : Promise.resolve({ data: [] as { role: string }[] }),
  ]);
  const code = new Map(props.map((p) => [p.id, p.code]));
  const isPresident = (roles ?? []).some((r) => r.role === "president");
  const balance = Number(bal?.balance_cents ?? 0);

  return (
    <>
      <PageHeader
        title={o.full_name}
        description={o.nif ?? undefined}
        actions={
          <>
            <Link href={`/admin/${cid}/propietarios`} className="text-sm text-primary underline">← Propietarios</Link>
          </>
        }
      />
      <Flash ok={sp.ok} error={sp.error} />

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Extracto de cuenta</CardTitle>
            <div className="text-right text-sm">
              Saldo: {balance > 0 ? <Money cents={balance} className="font-semibold text-destructive" /> : <span className="font-semibold text-success">{balance < 0 ? <><Money cents={-balance} /> a favor</> : "al corriente"}</span>}
            </div>
          </CardHeader>
          <CardContent>
            <OwnerStatement receipts={receipts ?? []} payments={payments ?? []} />
            <h4 className="mt-6 mb-2 text-sm font-semibold">Recibos</h4>
            <Table>
              <THead><TR><TH>Nº</TH><TH>Vencimiento</TH><TH>Inmueble</TH><TH className="text-right">Importe</TH><TH className="text-right">Pendiente</TH><TH></TH></TR></THead>
              <TBody>
                {(receipts ?? []).map((r) => (
                  <TR key={r.id}>
                    <TD className="whitespace-nowrap">{r.code}</TD>
                    <TD>{formatDate(r.due_date)}</TD>
                    <TD>{code.get(r.property_id)}</TD>
                    <TD className="text-right"><Money cents={r.amount_cents} /></TD>
                    <TD className="text-right">{r.status === "cancelled" ? <Badge variant="muted">Anulado</Badge> : <Money cents={Number(r.amount_cents) - Number(r.paid_cents)} />}</TD>
                    <TD className="text-right"><a className="text-xs text-primary underline" href={`/api/recibos/${r.id}/pdf`} target="_blank">PDF</a></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader><CardTitle>Inmuebles</CardTitle></CardHeader>
            <CardContent>
              <ul className="grid gap-2 text-sm">
                {(ships ?? []).map((s) => {
                  const current = s.start_date <= today && (!s.end_date || s.end_date >= today);
                  return (
                    <li key={s.id} className="flex justify-between gap-2">
                      <span className={current ? "font-medium" : "text-muted-foreground"}>{code.get(s.property_id)}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(s.start_date)} – {s.end_date ? formatDate(s.end_date) : "actualidad"}</span>
                    </li>
                  );
                })}
              </ul>
              <form action={transferProperty.bind(null, cid, oid)} className="mt-4 grid gap-3 border-t pt-4">
                <p className="text-sm font-medium">Cambio de titular (compraventa, herencia…)</p>
                <Field label="Inmueble que pasa a este propietario">
                  <Select name="property_id" required defaultValue="">
                    <option value="" disabled>Elige…</option>
                    {props.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
                  </Select>
                </Field>
                <Field label="Fecha de la transmisión"><Input type="date" name="date" defaultValue={today} required /></Field>
                <SubmitButton variant="outline">Registrar cambio de titular</SubmitButton>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Acceso al portal</CardTitle>
              <CardDescription>El propietario solo verá sus propios recibos y pagos y los documentos comunes.</CardDescription>
            </CardHeader>
            <CardContent>
              {o.user_id ? (
                <div className="grid gap-3">
                  <p className="text-sm"><Badge variant="success">Con acceso</Badge> {o.email}</p>
                  <form action={setPresident.bind(null, cid, oid, o.user_id, !isPresident)}>
                    <SubmitButton variant="outline" size="sm">{isPresident ? "Quitar cargo de presidente" : "Nombrar presidente de la comunidad"}</SubmitButton>
                  </form>
                  <form action={revokeAccess.bind(null, cid, oid, o.user_id)}>
                    <SubmitButton variant="ghost" size="sm" className="text-destructive" confirm="¿Retirar el acceso al portal?">Retirar acceso</SubmitButton>
                  </form>
                </div>
              ) : (
                <form action={giveAccess.bind(null, cid, oid)} className="grid gap-3">
                  <Field label="Email"><Input type="email" name="email" defaultValue={o.email ?? ""} required /></Field>
                  <Field label="Contraseña inicial" hint="Solo si es un usuario nuevo. Mínimo 8 caracteres.">
                    <Input name="password" defaultValue={Math.random().toString(36).slice(2, 8) + "-" + Math.random().toString(36).slice(2, 6).toUpperCase()} />
                  </Field>
                  <SubmitButton>Dar acceso</SubmitButton>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Datos del propietario</CardTitle></CardHeader>
        <CardContent>
          <form action={updateOwner.bind(null, cid, oid)} className="grid gap-4 sm:grid-cols-2">
            <OwnerFields o={o} />
            <div className="flex gap-2 sm:col-span-2"><SubmitButton>Guardar</SubmitButton></div>
          </form>
          <form action={deleteOwner.bind(null, cid, oid)} className="mt-4">
            <SubmitButton variant="ghost" size="sm" className="text-destructive" confirm="¿Eliminar este propietario?">Eliminar propietario</SubmitButton>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
