import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { getMemberships, requireUser } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { Flash } from "@/components/flash";
import { LegalNotice } from "@/components/legal-notice";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { createCommunity } from "./actions";

export const metadata = { title: "Mis comunidades" };

const REGIONS = [
  "Andalucía", "Aragón", "Principado de Asturias", "Illes Balears", "Canarias", "Cantabria", "Castilla-La Mancha", "Castilla y León",
  "Cataluña", "Comunitat Valenciana", "Extremadura", "Galicia", "Comunidad de Madrid", "Región de Murcia", "Comunidad Foral de Navarra",
  "País Vasco", "La Rioja", "Ceuta", "Melilla",
];

export default async function AdminHome({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { user } = await requireUser();
  const memberships = await getMemberships();
  const byCommunity = new Map<string, { name: string; city: string | null; roles: string[] }>();
  for (const m of memberships) {
    const c = byCommunity.get(m.community_id) ?? { name: m.communities?.name ?? "", city: m.communities?.city ?? null, roles: [] };
    c.roles.push(m.role);
    byCommunity.set(m.community_id, c);
  }
  const ROLE: Record<string, string> = { admin: "Administrador", president: "Presidente", owner: "Propietario" };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <Logo className="text-lg" />
        <form action="/auth/salir" method="post">
          <button className="text-sm text-muted-foreground hover:text-foreground">Salir ({user.email})</button>
        </form>
      </div>
      <Flash ok={sp.ok} error={sp.error} />
      <h1 className="mb-1 text-2xl font-semibold">Mis comunidades</h1>
      <p className="mb-6 text-sm text-muted-foreground">Elige una comunidad para gestionarla o da de alta una nueva.</p>

      <div className="grid gap-4 sm:grid-cols-2">
        {[...byCommunity.entries()].map(([id, c]) => (
          <Card key={id}>
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-primary/10 p-2 text-primary"><Building2 className="size-5" /></div>
                <div className="flex-1">
                  <CardTitle>{c.name}</CardTitle>
                  <CardDescription>{c.city}</CardDescription>
                  <div className="mt-2 flex flex-wrap gap-1">{c.roles.map((r) => <Badge key={r} variant="muted">{ROLE[r]}</Badge>)}</div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex gap-2">
              {c.roles.includes("admin") ? (
                <Link href={`/admin/${id}`} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Gestionar</Link>
              ) : null}
              <Link href={`/portal/${id}`} className="rounded-lg border px-4 py-2 text-sm font-medium">Portal del propietario</Link>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plus className="size-4" /> Dar de alta una comunidad</CardTitle>
          <CardDescription>Se crean automáticamente el plan de partidas, el reparto por coeficiente y el ejercicio actual. Tú quedarás como administrador.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createCommunity} className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" className="sm:col-span-2"><Input name="name" placeholder="Comunidad de Propietarios Calle Mayor, 1" required /></Field>
            <Field label="CIF"><Input name="cif" placeholder="H12345678" /></Field>
            <Field label="Dirección"><Input name="address" /></Field>
            <Field label="Código postal"><Input name="postal_code" inputMode="numeric" /></Field>
            <Field label="Municipio"><Input name="city" /></Field>
            <Field label="Provincia"><Input name="province" /></Field>
            <Field label="Comunidad autónoma" hint="En Cataluña el fondo de reserva mínimo es del 5 % (Código Civil de Cataluña).">
              <Select name="region" defaultValue="">
                <option value="">—</option>
                {REGIONS.map((r) => <option key={r}>{r}</option>)}
              </Select>
            </Field>
            <div className="sm:col-span-2"><SubmitButton>Crear comunidad</SubmitButton></div>
          </form>
        </CardContent>
      </Card>
      <LegalNotice />
    </main>
  );
}
