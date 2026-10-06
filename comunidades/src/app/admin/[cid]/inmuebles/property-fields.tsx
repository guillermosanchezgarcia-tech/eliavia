import { Checkbox, Field, Input, Select } from "@/components/ui/input";
import { PROPERTY_KINDS, type Property } from "@/lib/data";

export function PropertyFields({ p, groups, memberOf }: { p?: Property; groups: { id: string; name: string }[]; memberOf?: Set<string> }) {
  return (
    <>
      <Field label="Identificador"><Input name="code" defaultValue={p?.code} placeholder="1ºA, Local 2, Garaje 5…" required /></Field>
      <Field label="Tipo">
        <Select name="kind" defaultValue={p?.kind ?? "vivienda"}>
          {Object.entries(PROPERTY_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </Field>
      <Field label="Coeficiente (%)" hint="Cuota de participación del título constitutivo. Hasta 4 decimales.">
        <Input name="coefficient" defaultValue={p ? String(Number(p.coefficient)).replace(".", ",") : ""} inputMode="decimal" placeholder="6,5000" required />
      </Field>
      <Field label="Orden"><Input name="sort_order" type="number" defaultValue={p?.sort_order ?? 0} /></Field>
      <Field label="Descripción" className="sm:col-span-2"><Input name="description" defaultValue={p?.description ?? ""} /></Field>
      <Field label="Grupos de reparto" className="sm:col-span-2" hint="Sirven para repartos que solo afectan a algunos inmuebles (p. ej. ascensor, garajes).">
        <div className="flex flex-wrap gap-4">
          {groups.length === 0 ? <span className="text-sm text-muted-foreground">No hay grupos. Créalos en «Partidas y repartos».</span> : null}
          {groups.map((g) => <Checkbox key={g.id} name="groups" value={g.id} defaultChecked={memberOf?.has(g.id)} label={g.name} />)}
        </div>
      </Field>
      <div className="grid gap-2 rounded-lg border border-dashed p-3 sm:col-span-2">
        <Checkbox name="tourist_use" defaultChecked={p?.tourist_use} label="Vivienda de uso turístico (art. 17.12 LPH)" />
        <Field label="Incremento de participación en gastos acordado en junta (%)" hint="Máximo legal: 20 %. Se aplica en todos los repartos de este inmueble.">
          <Input name="tourist_surcharge_pct" inputMode="decimal" defaultValue={p ? String(Number(p.tourist_surcharge_pct)).replace(".", ",") : "0"} className="max-w-32" />
        </Field>
      </div>
    </>
  );
}
