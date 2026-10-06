import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBankAccounts } from "@/lib/data";
import { back } from "@/lib/flash";
import { defaultPrivacyPolicy } from "@/lib/privacidad";
import { bool, decimalInput, friendlyError, str } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Flash } from "@/components/flash";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export const metadata = { title: "Configuración" };

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

async function saveCommunity(cid: string, fd: FormData) {
  "use server";
  const { supabase } = await requireAdmin(cid);
  const path = `/admin/${cid}/configuracion`;
  const pct = decimalInput(fd, "reserve_fund_pct", 2);
  if (!str(fd, "name") || pct == null) back(path, { error: "Revisa el nombre y el % del fondo de reserva." });
  const { error } = await supabase.from("communities").update({
    name: str(fd, "name"), cif: str(fd, "cif"), address: str(fd, "address"), postal_code: str(fd, "postal_code"), city: str(fd, "city"),
    province: str(fd, "province"), region: str(fd, "region"), reserve_fund_pct: pct, secretary_name: str(fd, "secretary_name"),
    fiscal_year_start_month: Number(str(fd, "fiscal_year_start_month") ?? 1),
  }).eq("id", cid);
  if (error) back(path, { error: friendlyError(error) });
  back(path, { ok: "Datos de la comunidad guardados." });
}

async function savePrivacy(cid: string, fd: FormData) {
  "use server";
  const { supabase } = await requireAdmin(cid);
  const { error } = await supabase.from("communities").update({ privacy_policy: str(fd, "privacy_policy") }).eq("id", cid);
  if (error) back(`/admin/${cid}/configuracion`, { error: friendlyError(error) });
  back(`/admin/${cid}/configuracion`, { ok: "Política de privacidad guardada." });
}

async function addBank(cid: string, fd: FormData) {
  "use server";
  const { supabase } = await requireAdmin(cid);
  if (!str(fd, "name")) back(`/admin/${cid}/configuracion`, { error: "Indica el nombre de la cuenta." });
  const isDefault = bool(fd, "is_default");
  if (isDefault) await supabase.from("bank_accounts").update({ is_default: false }).eq("community_id", cid);
  const { error } = await supabase.from("bank_accounts").insert({
    community_id: cid, name: str(fd, "name"), iban: str(fd, "iban")?.replace(/\s/g, "").toUpperCase() ?? null, is_cash: bool(fd, "is_cash"), is_default: isDefault,
  });
  if (error) back(`/admin/${cid}/configuracion`, { error: friendlyError(error) });
  back(`/admin/${cid}/configuracion`, { ok: "Cuenta añadida." });
}

async function deleteBank(cid: string, id: string) {
  "use server";
  const { supabase } = await requireAdmin(cid);
  const { error } = await supabase.from("bank_accounts").delete().eq("id", id);
  if (error) back(`/admin/${cid}/configuracion`, { error: "No se puede borrar: tiene movimientos." });
  back(`/admin/${cid}/configuracion`, { ok: "Cuenta eliminada." });
}

async function addAdmin(cid: string, fd: FormData) {
  "use server";
  const { supabase } = await requireAdmin(cid);
  const path = `/admin/${cid}/configuracion`;
  const email = str(fd, "email")?.toLowerCase();
  if (!email) back(path, { error: "Indica el email." });
  const admin = createAdminClient();
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  let userId = list?.users.find((u) => u.email?.toLowerCase() === email)?.id;
  if (!userId) {
    const password = str(fd, "password");
    if (!password || password.length < 8) back(path, { error: "Es un usuario nuevo: indica una contraseña inicial de al menos 8 caracteres." });
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) back(path, { error: error.message });
    userId = data.user.id;
  }
  const { error } = await supabase.from("memberships").insert({ community_id: cid, user_id: userId, role: "admin" });
  if (error) back(path, { error: friendlyError(error) });
  back(path, { ok: `${email} ya es administrador de la comunidad.` });
}

async function removeAdmin(cid: string, userId: string) {
  "use server";
  const { supabase, user } = await requireAdmin(cid);
  if (userId === user.id) back(`/admin/${cid}/configuracion`, { error: "No puedes quitarte a ti mismo el acceso de administrador." });
  await supabase.from("memberships").delete().eq("community_id", cid).eq("user_id", userId).eq("role", "admin");
  back(`/admin/${cid}/configuracion`, { ok: "Administrador retirado." });
}

export default async function Settings({ params, searchParams }: { params: Promise<{ cid: string }>; searchParams: Promise<Record<string, string>> }) {
  const { cid } = await params;
  const sp = await searchParams;
  const { supabase, community: c } = await requireAdmin(cid);
  const [banks, { data: members }] = await Promise.all([getBankAccounts(supabase, cid), supabase.rpc("community_members", { p_community: cid })]);
  const ROLE: Record<string, string> = { admin: "Administrador", president: "Presidente", owner: "Propietario" };

  return (
    <>
      <PageHeader title="Configuración" />
      <Flash ok={sp.ok} error={sp.error} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Datos de la comunidad</CardTitle></CardHeader>
          <CardContent>
            <form action={saveCommunity.bind(null, cid)} className="grid gap-3 sm:grid-cols-2">
              <Field label="Nombre" className="sm:col-span-2"><Input name="name" defaultValue={c.name} required /></Field>
              <Field label="CIF"><Input name="cif" defaultValue={c.cif ?? ""} /></Field>
              <Field label="Dirección"><Input name="address" defaultValue={c.address ?? ""} /></Field>
              <Field label="Código postal"><Input name="postal_code" defaultValue={c.postal_code ?? ""} /></Field>
              <Field label="Municipio"><Input name="city" defaultValue={c.city ?? ""} /></Field>
              <Field label="Provincia"><Input name="province" defaultValue={c.province ?? ""} /></Field>
              <Field label="Comunidad autónoma"><Input name="region" defaultValue={c.region ?? ""} /></Field>
              <Field label="% mínimo del fondo de reserva" hint="10 % (LPH). En Cataluña, 5 % (Código Civil de Cataluña).">
                <Input name="reserve_fund_pct" defaultValue={String(Number(c.reserve_fund_pct)).replace(".", ",")} inputMode="decimal" />
              </Field>
              <Field label="Inicio del ejercicio contable">
                <Select name="fiscal_year_start_month" defaultValue={String(c.fiscal_year_start_month)}>
                  {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </Select>
              </Field>
              <Field label="Secretario/a (firma de certificados)" className="sm:col-span-2"><Input name="secretary_name" defaultValue={c.secretary_name ?? ""} /></Field>
              <div className="sm:col-span-2"><SubmitButton>Guardar</SubmitButton></div>
            </form>
          </CardContent>
        </Card>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader><CardTitle>Cuentas bancarias y caja</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TBody>
                  {banks.map((b) => (
                    <TR key={b.id}>
                      <TD>{b.name} {b.is_default ? <Badge>Principal</Badge> : null} {b.is_cash ? <Badge variant="muted">Caja</Badge> : null}<div className="text-xs text-muted-foreground">{b.iban}</div></TD>
                      <TD className="text-right"><form action={deleteBank.bind(null, cid, b.id)}><button className="text-xs text-destructive underline">Borrar</button></form></TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              <form action={addBank.bind(null, cid)} className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2">
                <Field label="Nombre"><Input name="name" placeholder="Cuenta principal" required /></Field>
                <Field label="IBAN"><Input name="iban" /></Field>
                <div className="flex gap-4 sm:col-span-2">
                  <Checkbox name="is_default" label="Cuenta principal" />
                  <Checkbox name="is_cash" label="Es la caja (efectivo)" />
                </div>
                <div><SubmitButton>Añadir cuenta</SubmitButton></div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Usuarios con acceso</CardTitle><CardDescription>Administradores, presidente y propietarios con acceso al portal.</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <THead><TR><TH>Email</TH><TH>Rol</TH><TH></TH></TR></THead>
                <TBody>
                  {(members ?? []).map((m: { user_id: string; email: string; role: string }) => (
                    <TR key={m.user_id + m.role}>
                      <TD>{m.email}</TD>
                      <TD><Badge variant={m.role === "admin" ? "default" : "muted"}>{ROLE[m.role]}</Badge></TD>
                      <TD className="text-right">{m.role === "admin" ? <form action={removeAdmin.bind(null, cid, m.user_id)}><button className="text-xs text-destructive underline">Quitar</button></form> : null}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              <form action={addAdmin.bind(null, cid)} className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2">
                <Field label="Añadir administrador (email)"><Input name="email" type="email" required /></Field>
                <Field label="Contraseña inicial (si es nuevo)"><Input name="password" /></Field>
                <div><SubmitButton variant="outline">Añadir administrador</SubmitButton></div>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Política de privacidad</CardTitle>
            <CardDescription>La comunidad es la responsable del tratamiento y el administrador, el encargado. Los propietarios la aceptan en su primer acceso.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={savePrivacy.bind(null, cid)} className="grid gap-3">
              <Textarea name="privacy_policy" defaultValue={c.privacy_policy || defaultPrivacyPolicy(c)} className="min-h-80 font-mono text-xs" />
              <div><SubmitButton>Guardar política</SubmitButton></div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
