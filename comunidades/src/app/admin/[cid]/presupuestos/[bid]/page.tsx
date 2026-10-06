import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Info } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { loadBudgetContext } from "@/lib/budget-data";
import { annualQuotaByProperty, installmentDueDate, planReceipts, reserveFundMinimum } from "@/lib/cuotas";
import { getReserveStatus, METHOD_LABELS } from "@/lib/data";
import { formatEuros, formatPct, centsToInput } from "@/lib/money";
import { formatDate, todayISO } from "@/lib/dates";
import { PageHeader } from "@/components/page-header";
import { Flash } from "@/components/flash";
import { Money } from "@/components/money";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { Table, TBody, TD, TFoot, TH, THead, TR } from "@/components/ui/table";
import { addLine, deleteBudget, deleteLine, issueInstallment, setStatus } from "../actions";

export default async function BudgetDetail({ params, searchParams }: { params: Promise<{ cid: string; bid: string }>; searchParams: Promise<Record<string, string>> }) {
  const { cid, bid } = await params;
  const sp = await searchParams;
  const { supabase, community } = await requireAdmin(cid);
  const loaded = await loadBudgetContext(supabase, cid, bid);
  if (!loaded) notFound();
  const { budget, lines, quotaLines, ctx, props, keys, cats, catById } = loaded;
  const keyById = new Map(keys.map((k) => [k.id, k]));
  const draft = budget.status === "draft";
  const total = quotaLines.reduce((a, l) => a + l.amount_cents, 0);
  const expenseTotal = quotaLines.filter((l) => l.category_kind !== "reserve").reduce((a, l) => a + l.amount_cents, 0);
  const reserveLine = quotaLines.filter((l) => l.category_kind === "reserve").reduce((a, l) => a + l.amount_cents, 0);

  const [reserve, { data: issued }] = await Promise.all([
    getReserveStatus(supabase, cid),
    supabase.from("receipts").select("installment, amount_cents").eq("budget_id", bid),
  ]);
  const minimum = reserveFundMinimum(expenseTotal, community.reserve_fund_pct);
  const needed = Math.max(0, minimum - (reserve?.balance_cents ?? 0));

  let quotas: Map<string, number> | null = null;
  let firstInstallment: Map<string, number> | null = null;
  let quotaError: string | null = null;
  try {
    quotas = annualQuotaByProperty(budget, quotaLines, ctx);
    firstInstallment = new Map(planReceipts(budget, quotaLines, ctx, [1]).map((r) => [r.property_id, r.amount_cents]));
  } catch (e) {
    quotaError = (e as Error).message;
  }
  const issuedByInst = new Map<number, { n: number; cents: number }>();
  for (const r of issued ?? []) {
    const v = issuedByInst.get(r.installment) ?? { n: 0, cents: 0 };
    issuedByInst.set(r.installment, { n: v.n + 1, cents: v.cents + Number(r.amount_cents) });
  }
  const isOrdinary = budget.kind === "ordinary";
  const reserveCat = cats.find((c) => c.kind === "reserve");
  const defaultKey = keys.find((k) => k.is_default);

  return (
    <>
      <PageHeader
        title={budget.name}
        description={
          <>
            {isOrdinary ? "Presupuesto ordinario" : "Derrama (cuota extraordinaria)"} · {budget.installments} plazo(s) desde el {formatDate(budget.first_due_date)} ·{" "}
            {draft ? <Badge variant="muted">Borrador</Badge> : <Badge variant="success">Aprobado en junta el {formatDate(budget.approved_at)}</Badge>}
          </>
        }
        actions={<Link href={`/admin/${cid}/presupuestos`} className="text-sm text-primary underline">← Presupuestos</Link>}
      />
      <Flash ok={sp.ok} error={sp.error} />

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Partidas</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <THead><TR><TH>Partida</TH><TH>Reparto</TH><TH className="text-right">Importe anual</TH><TH></TH></TR></THead>
              <TBody>
                {lines.map((l) => (
                  <TR key={l.id}>
                    <TD>{catById.get(l.category_id)?.name}<div className="text-xs text-muted-foreground">{l.description}</div></TD>
                    <TD className="text-sm">{keyById.get(l.allocation_key_id)?.name}<div className="text-xs text-muted-foreground">{METHOD_LABELS[keyById.get(l.allocation_key_id)?.method ?? "coefficient"]}</div></TD>
                    <TD className="text-right"><Money cents={l.amount_cents} /></TD>
                    <TD className="text-right">
                      {draft ? <form action={deleteLine.bind(null, cid, bid, l.id)}><button className="text-xs text-destructive underline">Quitar</button></form> : null}
                    </TD>
                  </TR>
                ))}
              </TBody>
              <TFoot>
                <TR><TD colSpan={2}>Gastos previstos</TD><TD className="text-right"><Money cents={expenseTotal} /></TD><TD /></TR>
                <TR><TD colSpan={2}>Aportación al fondo de reserva</TD><TD className="text-right"><Money cents={reserveLine} /></TD><TD /></TR>
                <TR><TD colSpan={2} className="font-semibold">Total a repartir</TD><TD className="text-right font-semibold"><Money cents={total} /></TD><TD /></TR>
              </TFoot>
            </Table>
            {draft ? (
              <form action={addLine.bind(null, cid, bid)} className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-4">
                <Field label="Partida">
                  <Select name="category_id" required defaultValue="">
                    <option value="" disabled>Elige…</option>
                    {cats.filter((c) => c.active && c.kind !== "income").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                </Field>
                <Field label="Reparto">
                  <Select name="allocation_key_id" defaultValue={defaultKey?.id}>
                    {keys.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
                  </Select>
                </Field>
                <Field label="Importe (€)"><Input name="amount" inputMode="decimal" placeholder="1.200,00" required /></Field>
                <Field label="Descripción"><Input name="description" /></Field>
                <div className="sm:col-span-4"><SubmitButton>Añadir partida</SubmitButton></div>
              </form>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid content-start gap-6">
          {isOrdinary ? (
            <Card>
              <CardHeader>
                <CardTitle>Fondo de reserva</CardTitle>
                <CardDescription>Mínimo legal: {formatPct(community.reserve_fund_pct, 0)} del presupuesto ordinario (art. 9.1.f LPH).</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm">
                <div className="flex justify-between"><span>Mínimo con este presupuesto</span><Money cents={minimum} /></div>
                <div className="flex justify-between"><span>Saldo actual del fondo</span><Money cents={reserve?.balance_cents ?? 0} /></div>
                <div className="flex justify-between"><span>Aportación en este presupuesto</span><Money cents={reserveLine} /></div>
                {!draft ? (
                  (reserve?.balance_cents ?? 0) < minimum ? (
                    <Alert variant="warning" className="mt-2">
                      <AlertTriangle />
                      <AlertDescription>
                        Hoy el fondo está <strong>{formatEuros(needed)}</strong> por debajo del mínimo. Incluye esa reposición en el
                        presupuesto del próximo ejercicio (art. 9.1.f LPH).
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <p className="mt-2 text-success">El fondo cubre hoy el mínimo legal.</p>
                  )
                ) : needed > reserveLine ? (
                  <Alert variant="warning" className="mt-2">
                    <AlertTriangle />
                    <AlertDescription>
                      Para reponer el fondo hasta el mínimo hace falta una aportación de al menos <strong>{formatEuros(needed)}</strong>.
                      {reserveCat && defaultKey ? (
                        <form action={addLine.bind(null, cid, bid)} className="mt-2">
                          <input type="hidden" name="category_id" value={reserveCat.id} />
                          <input type="hidden" name="allocation_key_id" value={defaultKey.id} />
                          <input type="hidden" name="amount" value={centsToInput(needed - reserveLine)} />
                          <input type="hidden" name="description" value="Reposición del fondo de reserva" />
                          <SubmitButton size="sm" variant="outline">Añadir {formatEuros(needed - reserveLine)} de reposición</SubmitButton>
                        </form>
                      ) : null}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <p className="mt-2 text-success">Con esta aportación el fondo alcanzará el mínimo legal.</p>
                )}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader><CardTitle>Aprobación en junta</CardTitle></CardHeader>
            <CardContent>
              {draft ? (
                <form action={setStatus.bind(null, cid, bid)} className="grid gap-3">
                  <input type="hidden" name="status" value="approved" />
                  <Field label="Fecha de la junta"><Input type="date" name="approved_at" defaultValue={todayISO()} /></Field>
                  <SubmitButton disabled={total === 0}>Marcar como aprobado</SubmitButton>
                </form>
              ) : (
                <form action={setStatus.bind(null, cid, bid)}>
                  <input type="hidden" name="status" value="draft" />
                  <SubmitButton variant="outline" size="sm" confirm="¿Volver a borrador?">Volver a borrador</SubmitButton>
                </form>
              )}
              {issuedByInst.size === 0 ? (
                <form action={deleteBudget.bind(null, cid, bid)} className="mt-3">
                  <SubmitButton variant="ghost" size="sm" className="text-destructive" confirm="¿Eliminar definitivamente?">Eliminar</SubmitButton>
                </form>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Emisión de recibos</CardTitle>
          <CardDescription>Cada plazo genera un recibo por inmueble a nombre de su titular en la fecha de vencimiento, con numeración correlativa.</CardDescription>
        </CardHeader>
        <CardContent>
          {draft ? (
            <Alert className="mb-3"><Info /><AlertDescription>Aprueba el presupuesto para poder emitir los recibos.</AlertDescription></Alert>
          ) : null}
          <Table>
            <THead><TR><TH>Plazo</TH><TH>Vencimiento</TH><TH>Estado</TH><TH className="text-right">Importe emitido</TH><TH></TH></TR></THead>
            <TBody>
              {Array.from({ length: budget.installments }, (_, i) => i + 1).map((inst) => {
                const done = issuedByInst.get(inst);
                return (
                  <TR key={inst}>
                    <TD>{inst} de {budget.installments}</TD>
                    <TD>{formatDate(installmentDueDate(budget, inst))}</TD>
                    <TD>{done ? <Badge variant="success">{done.n} recibos emitidos</Badge> : <Badge variant="muted">Pendiente de emitir</Badge>}</TD>
                    <TD className="text-right">{done ? <Money cents={done.cents} /> : null}</TD>
                    <TD className="text-right">
                      {!done && !draft ? (
                        <form action={issueInstallment.bind(null, cid, bid, inst)}>
                          <SubmitButton size="sm" pendingText="Emitiendo…">Emitir recibos</SubmitButton>
                        </form>
                      ) : done ? (
                        <Link href={`/admin/${cid}/recibos?presupuesto=${bid}&plazo=${inst}`} className="text-xs text-primary underline">Ver recibos</Link>
                      ) : null}
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
          <CardTitle>Cuota por inmueble</CardTitle>
          <CardDescription>Cálculo automático según el reparto de cada partida. Los céntimos sobrantes del redondeo se asignan al inmueble de mayor coeficiente.</CardDescription>
        </CardHeader>
        <CardContent>
          {quotaError ? (
            <Alert variant="danger"><AlertTriangle /><AlertTitle>No se pueden calcular las cuotas</AlertTitle><AlertDescription>{quotaError}</AlertDescription></Alert>
          ) : (
            <Table>
              <THead><TR><TH>Inmueble</TH><TH className="text-right">Coeficiente</TH><TH className="text-right">Cuota por plazo</TH><TH className="text-right">Total anual</TH></TR></THead>
              <TBody>
                {props.map((p) => (
                  <TR key={p.id}>
                    <TD>{p.code}{p.tourist_use ? <Badge variant="warning" className="ml-2">+{Number(p.tourist_surcharge_pct)} % turístico</Badge> : null}</TD>
                    <TD className="text-right tabular">{formatPct(p.coefficient, 4)}</TD>
                    <TD className="text-right"><Money cents={firstInstallment?.get(p.id) ?? 0} /></TD>
                    <TD className="text-right"><Money cents={quotas?.get(p.id) ?? 0} /></TD>
                  </TR>
                ))}
              </TBody>
              <TFoot>
                <TR>
                  <TD colSpan={3}>Total (cuadra con el presupuesto)</TD>
                  <TD className="text-right"><Money cents={[...(quotas?.values() ?? [])].reduce((a, b) => a + b, 0)} /></TD>
                </TR>
              </TFoot>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
