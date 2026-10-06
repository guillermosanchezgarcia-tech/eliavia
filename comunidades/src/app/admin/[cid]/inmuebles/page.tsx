import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getOwners, getOwnerships, getProperties, ownerAt, PROPERTY_KINDS } from "@/lib/data";
import { coefficientsSumTo100, coefficientsTotal } from "@/lib/reparto";
import { formatPct } from "@/lib/money";
import { todayISO } from "@/lib/dates";
import { PageHeader } from "@/components/page-header";
import { Flash } from "@/components/flash";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { Table, TBody, TD, TFoot, TH, THead, TR } from "@/components/ui/table";
import { PropertyFields } from "./property-fields";
import { createProperty } from "./actions";

export const metadata = { title: "Inmuebles" };

export default async function Properties({ params, searchParams }: { params: Promise<{ cid: string }>; searchParams: Promise<Record<string, string>> }) {
  const { cid } = await params;
  const sp = await searchParams;
  const { supabase } = await requireAdmin(cid);
  const today = todayISO();
  const [props, owners, ownerships, groupsRes, membersRes] = await Promise.all([
    getProperties(supabase, cid),
    getOwners(supabase, cid),
    getOwnerships(supabase, cid),
    supabase.from("property_groups").select("id, name").eq("community_id", cid).order("name"),
    supabase.from("property_group_members").select("group_id, property_id"),
  ]);
  const groups = groupsRes.data ?? [];
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  const ownerName = new Map(owners.map((o) => [o.id, o.full_name]));
  const total = Number(coefficientsTotal(props)) / 10000;
  const ok = coefficientsSumTo100(props);

  return (
    <>
      <PageHeader title="Inmuebles" description="Viviendas, locales, garajes y trasteros con su cuota de participación." />
      <Flash ok={sp.ok} error={sp.error} />
      <Card>
        <CardContent className="pt-5">
          <Table>
            <THead>
              <TR><TH>Inmueble</TH><TH>Tipo</TH><TH className="text-right">Coeficiente</TH><TH>Grupos</TH><TH>Titular actual</TH><TH></TH></TR>
            </THead>
            <TBody>
              {props.map((p) => {
                const owner = ownerAt(ownerships, p.id, today);
                return (
                  <TR key={p.id}>
                    <TD className="font-medium">
                      {p.code}
                      {p.tourist_use ? <Badge variant="warning" className="ml-2">Uso turístico +{Number(p.tourist_surcharge_pct).toLocaleString("es-ES")} %</Badge> : null}
                    </TD>
                    <TD>{PROPERTY_KINDS[p.kind]}</TD>
                    <TD className="text-right tabular">{formatPct(p.coefficient, 4)}</TD>
                    <TD className="text-xs text-muted-foreground">
                      {(membersRes.data ?? []).filter((m) => m.property_id === p.id).map((m) => groupName.get(m.group_id)).join(", ")}
                    </TD>
                    <TD>{owner ? <Link className="text-primary hover:underline" href={`/admin/${cid}/propietarios/${owner}`}>{ownerName.get(owner)}</Link> : <span className="text-muted-foreground">Sin titular</span>}</TD>
                    <TD className="text-right"><Link className="text-sm text-primary underline" href={`/admin/${cid}/inmuebles/${p.id}`}>Editar</Link></TD>
                  </TR>
                );
              })}
            </TBody>
            <TFoot>
              <TR>
                <TD colSpan={2}>{props.length} inmuebles</TD>
                <TD className="text-right tabular">{formatPct(total, 4)}</TD>
                <TD colSpan={3}>
                  {ok ? <Badge variant="success">Los coeficientes suman 100 %</Badge> : <Badge variant="danger">Los coeficientes deben sumar 100 % (faltan {formatPct(100 - total, 4)})</Badge>}
                </TD>
              </TR>
            </TFoot>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader><CardTitle>Añadir inmueble</CardTitle></CardHeader>
        <CardContent>
          <form action={createProperty.bind(null, cid)} className="grid gap-4 sm:grid-cols-2">
            <PropertyFields groups={groups} />
            <Field label="Titular (opcional)">
              <Select name="owner_id" defaultValue="">
                <option value="">— Sin titular —</option>
                {owners.map((o) => <option key={o.id} value={o.id}>{o.full_name}</option>)}
              </Select>
            </Field>
            <Field label="Titular desde"><Input type="date" name="start_date" defaultValue={today} /></Field>
            <div className="sm:col-span-2"><SubmitButton>Añadir inmueble</SubmitButton></div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
