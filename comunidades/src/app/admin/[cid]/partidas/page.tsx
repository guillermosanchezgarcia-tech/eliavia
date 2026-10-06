import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getAllocationKeys, getCategories, getProperties, METHOD_LABELS } from "@/lib/data";
import { PageHeader } from "@/components/page-header";
import { Flash } from "@/components/flash";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Field, Input, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { createCategory, createGroup, createKey, deleteGroup, deleteKey, toggleCategory } from "./actions";

export const metadata = { title: "Partidas y repartos" };

const KIND: Record<string, string> = { expense: "Gasto", income: "Ingreso", reserve: "Fondo de reserva" };

export default async function Categories({ params, searchParams }: { params: Promise<{ cid: string }>; searchParams: Promise<Record<string, string>> }) {
  const { cid } = await params;
  const sp = await searchParams;
  const { supabase } = await requireAdmin(cid);
  const [cats, keys, props, { data: groups }, { data: members }] = await Promise.all([
    getCategories(supabase, cid),
    getAllocationKeys(supabase, cid),
    getProperties(supabase, cid),
    supabase.from("property_groups").select("id, name").eq("community_id", cid).order("name"),
    supabase.from("property_group_members").select("group_id, property_id"),
  ]);
  const groupName = new Map((groups ?? []).map((g) => [g.id, g.name]));
  const codeOf = new Map(props.map((p) => [p.id, p.code]));

  return (
    <>
      <PageHeader title="Partidas y repartos" description="Plan de partidas de ingresos y gastos, grupos de inmuebles y formas de reparto (art. 5 y 9.1.e LPH)." />
      <Flash ok={sp.ok} error={sp.error} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Partidas</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <THead><TR><TH>Código</TH><TH>Partida</TH><TH>Tipo</TH><TH></TH></TR></THead>
              <TBody>
                {cats.map((c) => (
                  <TR key={c.id} className={c.active ? "" : "opacity-50"}>
                    <TD className="tabular text-muted-foreground">{c.code}</TD>
                    <TD>{c.name}</TD>
                    <TD><Badge variant={c.kind === "expense" ? "muted" : c.kind === "income" ? "success" : "default"}>{KIND[c.kind]}</Badge></TD>
                    <TD className="text-right">
                      {c.is_system ? null : (
                        <form action={toggleCategory.bind(null, cid, c.id, !c.active)}>
                          <button className="text-xs text-primary underline">{c.active ? "Desactivar" : "Activar"}</button>
                        </form>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <form action={createCategory.bind(null, cid)} className="mt-4 flex flex-wrap items-end gap-2 border-t pt-4">
              <Field label="Nueva partida" className="flex-1"><Input name="name" placeholder="p. ej. Desratización" required /></Field>
              <Field label="Tipo">
                <Select name="kind"><option value="expense">Gasto</option><option value="income">Ingreso</option></Select>
              </Field>
              <SubmitButton>Añadir</SubmitButton>
            </form>
          </CardContent>
        </Card>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Repartos</CardTitle>
              <CardDescription>Cada partida del presupuesto y cada gasto usan un reparto. Por defecto, el coeficiente de participación.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <THead><TR><TH>Reparto</TH><TH>Método</TH><TH>Solo grupo</TH><TH></TH></TR></THead>
                <TBody>
                  {keys.map((k) => (
                    <TR key={k.id}>
                      <TD className="font-medium">{k.name}{k.is_default ? <Badge className="ml-2">Por defecto</Badge> : null}</TD>
                      <TD>{METHOD_LABELS[k.method]}</TD>
                      <TD>{k.group_id ? groupName.get(k.group_id) : "Todos"}</TD>
                      <TD className="text-right whitespace-nowrap">
                        {k.method === "custom" ? <Link className="mr-3 text-xs text-primary underline" href={`/admin/${cid}/partidas/repartos/${k.id}`}>Coeficientes</Link> : null}
                        {k.is_default ? null : (
                          <form action={deleteKey.bind(null, cid, k.id)} className="inline"><button className="text-xs text-destructive underline">Borrar</button></form>
                        )}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              <form action={createKey.bind(null, cid)} className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-3">
                <Field label="Nombre" className="sm:col-span-3"><Input name="name" placeholder="p. ej. Ascensor portal 2" required /></Field>
                <Field label="Método">
                  <Select name="method">
                    <option value="coefficient">Por coeficiente</option>
                    <option value="equal">Partes iguales</option>
                    <option value="custom">Coeficientes específicos</option>
                  </Select>
                </Field>
                <Field label="Solo inmuebles del grupo" className="sm:col-span-2">
                  <Select name="group_id" defaultValue="">
                    <option value="">Todos los inmuebles</option>
                    {(groups ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </Select>
                </Field>
                <div className="sm:col-span-3"><SubmitButton>Crear reparto</SubmitButton></div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Grupos de inmuebles</CardTitle></CardHeader>
            <CardContent>
              <ul className="grid gap-2 text-sm">
                {(groups ?? []).map((g) => {
                  const m = (members ?? []).filter((x) => x.group_id === g.id).map((x) => codeOf.get(x.property_id)).filter(Boolean);
                  return (
                    <li key={g.id} className="flex items-start justify-between gap-3 border-b pb-2">
                      <div><span className="font-medium">{g.name}</span><div className="text-xs text-muted-foreground">{m.join(", ") || "Sin inmuebles"}</div></div>
                      <form action={deleteGroup.bind(null, cid, g.id)}><button className="text-xs text-destructive underline">Borrar</button></form>
                    </li>
                  );
                })}
              </ul>
              <form action={createGroup.bind(null, cid)} className="mt-4 grid gap-3">
                <Field label="Nuevo grupo"><Input name="name" placeholder="p. ej. Portal 2" required /></Field>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {props.map((p) => <Checkbox key={p.id} name="properties" value={p.id} label={p.code} />)}
                </div>
                <div><SubmitButton>Crear grupo</SubmitButton></div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
