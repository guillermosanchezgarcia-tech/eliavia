import { requireAdmin } from "@/lib/auth";
import { getBankAccounts, getCategories, getOwners, PAYMENT_METHODS } from "@/lib/data";
import { formatDate, todayISO } from "@/lib/dates";
import { back } from "@/lib/flash";
import { parseEuros } from "@/lib/money";
import { friendlyError, str } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Flash } from "@/components/flash";
import { Money } from "@/components/money";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { Table, TBody, TD, TFoot, TH, THead, TR } from "@/components/ui/table";

export const metadata = { title: "Cobros" };

async function registerPayment(cid: string, fd: FormData) {
  "use server";
  const { supabase } = await requireAdmin(cid);
  const path = `/admin/${cid}/cobros`;
  const amount = parseEuros(str(fd, "amount"));
  const ownerId = str(fd, "owner_id");
  const categoryId = str(fd, "category_id");
  const date = str(fd, "payment_date");
  const bank = str(fd, "bank_account_id");
  if (!amount || amount <= 0 || !date || !bank || (!ownerId && !categoryId)) back(path, { error: "Revisa los datos: propietario (u otro ingreso), fecha, importe y cuenta." });
  const { error } = await supabase.from("payments").insert({
    community_id: cid, owner_id: ownerId, category_id: ownerId ? null : categoryId, payment_date: date, amount_cents: amount,
    method: str(fd, "method") ?? "transferencia", bank_account_id: bank, reference: str(fd, "reference"),
  });
  if (error) back(path, { error: friendlyError(error) });
  back(path, { ok: "Cobro registrado. Se ha aplicado a los recibos pendientes más antiguos." });
}

async function deletePayment(cid: string, id: string) {
  "use server";
  const { supabase } = await requireAdmin(cid);
  const { error } = await supabase.from("payments").delete().eq("id", id);
  if (error) back(`/admin/${cid}/cobros`, { error: friendlyError(error) });
  back(`/admin/${cid}/cobros`, { ok: "Cobro eliminado." });
}

export default async function Payments({ params, searchParams }: { params: Promise<{ cid: string }>; searchParams: Promise<Record<string, string>> }) {
  const { cid } = await params;
  const sp = await searchParams;
  const { supabase } = await requireAdmin(cid);
  const today = todayISO();
  let q = supabase.from("payments").select("*").eq("community_id", cid).order("payment_date", { ascending: false }).limit(500);
  if (sp.propietario) q = q.eq("owner_id", sp.propietario);
  const [{ data: payments }, owners, banks, cats, { data: balances }] = await Promise.all([
    q, getOwners(supabase, cid), getBankAccounts(supabase, cid), getCategories(supabase, cid),
    supabase.from("v_owner_balances").select("owner_id, balance_cents").eq("community_id", cid),
  ]);
  const ownerName = new Map(owners.map((o) => [o.id, o.full_name]));
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  const bankName = new Map(banks.map((b) => [b.id, b.name]));
  const bal = new Map((balances ?? []).map((b) => [b.owner_id, Number(b.balance_cents)]));
  const defaultBank = banks.find((b) => b.is_default)?.id ?? banks[0]?.id;

  return (
    <>
      <PageHeader title="Cobros" description="Pagos de los propietarios y otros ingresos de la comunidad." />
      <Flash ok={sp.ok} error={sp.error} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Registrar pago de un propietario</CardTitle></CardHeader>
          <CardContent>
            <form action={registerPayment.bind(null, cid)} className="grid gap-3 sm:grid-cols-2">
              <Field label="Propietario" className="sm:col-span-2">
                <Select name="owner_id" required defaultValue={sp.propietario ?? ""}>
                  <option value="" disabled>Elige…</option>
                  {owners.map((o) => {
                    const b = bal.get(o.id) ?? 0;
                    return <option key={o.id} value={o.id}>{o.full_name}{b > 0 ? ` (debe ${(b / 100).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €)` : ""}</option>;
                  })}
                </Select>
              </Field>
              <Field label="Fecha"><Input type="date" name="payment_date" defaultValue={today} required /></Field>
              <Field label="Importe (€)"><Input name="amount" inputMode="decimal" placeholder="250,00" required /></Field>
              <Field label="Forma de pago">
                <Select name="method">{Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
              </Field>
              <Field label="Cuenta">
                <Select name="bank_account_id" defaultValue={defaultBank}>{banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select>
              </Field>
              <Field label="Referencia / concepto" className="sm:col-span-2"><Input name="reference" placeholder="p. ej. Transferencia cuota 3T" /></Field>
              <div className="sm:col-span-2"><SubmitButton>Registrar cobro</SubmitButton></div>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Otro ingreso de la comunidad</CardTitle>
            <CardDescription>Alquiler de la azotea o de un local, intereses, subvenciones… (datos para el modelo 184).</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={registerPayment.bind(null, cid)} className="grid gap-3 sm:grid-cols-2">
              <Field label="Partida de ingreso" className="sm:col-span-2">
                <Select name="category_id" required defaultValue="">
                  <option value="" disabled>Elige…</option>
                  {cats.filter((c) => c.kind === "income" && !c.is_system && c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Fecha"><Input type="date" name="payment_date" defaultValue={today} required /></Field>
              <Field label="Importe (€)"><Input name="amount" inputMode="decimal" required /></Field>
              <Field label="Cuenta">
                <Select name="bank_account_id" defaultValue={defaultBank}>{banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select>
              </Field>
              <Field label="Forma de pago">
                <Select name="method">{Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
              </Field>
              <Field label="Concepto" className="sm:col-span-2"><Input name="reference" required /></Field>
              <div className="sm:col-span-2"><SubmitButton>Registrar ingreso</SubmitButton></div>
            </form>
          </CardContent>
        </Card>
      </div>

      <form className="mt-6 mb-3 flex gap-2 no-print">
        <Select name="propietario" defaultValue={sp.propietario ?? ""} className="w-auto">
          <option value="">Todos</option>
          {owners.map((o) => <option key={o.id} value={o.id}>{o.full_name}</option>)}
        </Select>
        <Button variant="outline" type="submit">Filtrar</Button>
      </form>
      <Card>
        <CardContent className="pt-5">
          <Table>
            <THead><TR><TH>Fecha</TH><TH>De</TH><TH>Forma</TH><TH>Cuenta</TH><TH>Referencia</TH><TH className="text-right">Importe</TH><TH></TH></TR></THead>
            <TBody>
              {(payments ?? []).map((p) => (
                <TR key={p.id}>
                  <TD>{formatDate(p.payment_date)}</TD>
                  <TD>{p.owner_id ? ownerName.get(p.owner_id) : <span className="italic">{catName.get(p.category_id)}</span>}</TD>
                  <TD>{PAYMENT_METHODS[p.method]}</TD>
                  <TD>{bankName.get(p.bank_account_id)}</TD>
                  <TD className="text-xs text-muted-foreground">{p.reference}</TD>
                  <TD className="text-right"><Money cents={p.amount_cents} /></TD>
                  <TD className="text-right">
                    <form action={deletePayment.bind(null, cid, p.id)}>
                      <SubmitButton variant="link" size="sm" className="h-auto text-xs text-destructive" confirm="¿Eliminar este cobro?">Eliminar</SubmitButton>
                    </form>
                  </TD>
                </TR>
              ))}
            </TBody>
            <TFoot>
              <TR><TD colSpan={5}>Total</TD><TD className="text-right"><Money cents={(payments ?? []).reduce((a, p) => a + Number(p.amount_cents), 0)} /></TD><TD /></TR>
            </TFoot>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
