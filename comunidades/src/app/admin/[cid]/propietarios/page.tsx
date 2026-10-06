import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getOwners, getOwnerships, getProperties } from "@/lib/data";
import { todayISO } from "@/lib/dates";
import { PageHeader } from "@/components/page-header";
import { Flash } from "@/components/flash";
import { Money } from "@/components/money";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox, Field, Input, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { OwnerFields } from "./owner-fields";
import { createOwner } from "./actions";

export const metadata = { title: "Propietarios" };

export default async function Owners({ params, searchParams }: { params: Promise<{ cid: string }>; searchParams: Promise<Record<string, string>> }) {
  const { cid } = await params;
  const sp = await searchParams;
  const { supabase } = await requireAdmin(cid);
  const today = todayISO();
  const [owners, ownerships, props, balances, members] = await Promise.all([
    getOwners(supabase, cid),
    getOwnerships(supabase, cid),
    getProperties(supabase, cid),
    supabase.from("v_owner_balances").select("owner_id, balance_cents").eq("community_id", cid),
    supabase.from("memberships").select("user_id, role").eq("community_id", cid),
  ]);
  const code = new Map(props.map((p) => [p.id, p.code]));
  const balance = new Map((balances.data ?? []).map((b) => [b.owner_id, Number(b.balance_cents)]));
  const presidents = new Set((members.data ?? []).filter((m) => m.role === "president").map((m) => m.user_id));
  const suggested = Math.random().toString(36).slice(2, 8) + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();

  return (
    <>
      <PageHeader title="Propietarios" description="Titulares de los inmuebles, su saldo y su acceso al portal." />
      <Flash ok={sp.ok} error={sp.error} />
      <Card>
        <CardContent className="pt-5">
          <Table>
            <THead><TR><TH>Propietario</TH><TH>Inmuebles actuales</TH><TH>Contacto</TH><TH>Portal</TH><TH className="text-right">Saldo</TH></TR></THead>
            <TBody>
              {owners.map((o) => {
                const current = ownerships.filter((x) => x.owner_id === o.id && x.start_date <= today && (!x.end_date || x.end_date >= today));
                const b = balance.get(o.id) ?? 0;
                return (
                  <TR key={o.id}>
                    <TD>
                      <Link className="font-medium text-primary hover:underline" href={`/admin/${cid}/propietarios/${o.id}`}>{o.full_name}</Link>
                      <div className="text-xs text-muted-foreground">{o.nif}</div>
                    </TD>
                    <TD>{current.map((c) => code.get(c.property_id)).join(", ") || <span className="text-muted-foreground">Antiguo titular</span>}</TD>
                    <TD className="text-xs">{o.email}<div className="text-muted-foreground">{o.phone}</div></TD>
                    <TD>
                      {o.user_id ? <Badge variant="success">Con acceso</Badge> : <Badge variant="muted">Sin acceso</Badge>}
                      {o.user_id && presidents.has(o.user_id) ? <Badge className="ml-1">Presidente</Badge> : null}
                    </TD>
                    <TD className="text-right">
                      {b > 0 ? <Money cents={b} className="text-destructive" /> : b < 0 ? <span className="text-success"><Money cents={-b} /> a favor</span> : <span className="text-success">Al corriente</span>}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Añadir propietario</CardTitle>
          <CardDescription>Si ya existe y compra otro inmueble, ve a su ficha y usa «Cambio de titular».</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createOwner.bind(null, cid)} className="grid gap-4 sm:grid-cols-2">
            <OwnerFields />
            <Field label="Inmueble que adquiere (opcional)">
              <Select name="property_id" defaultValue="">
                <option value="">—</option>
                {props.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
              </Select>
            </Field>
            <Field label="Fecha de adquisición"><Input type="date" name="start_date" defaultValue={today} /></Field>
            <div className="grid gap-3 rounded-lg border border-dashed p-3 sm:col-span-2">
              <Checkbox name="portal_access" label="Dar acceso al portal del propietario (usa el email indicado arriba)" />
              <Field label="Contraseña inicial" hint="Comunícasela al propietario. Podrá entrar también con un enlace por email.">
                <Input name="password" defaultValue={suggested} className="max-w-60" />
              </Field>
            </div>
            <div className="sm:col-span-2"><SubmitButton>Añadir propietario</SubmitButton></div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
