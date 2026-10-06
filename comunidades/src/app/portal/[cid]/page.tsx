import Link from "next/link";
import { AlertCircle, CheckCircle2, FileText } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { DOC_KINDS, receiptState, type ReceiptView } from "@/lib/data";
import { formatEuros } from "@/lib/money";
import { formatDate, todayISO } from "@/lib/dates";
import { Money } from "@/components/money";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function PortalHome({ params }: { params: Promise<{ cid: string }> }) {
  const { cid } = await params;
  const { supabase, ownerIds, ownerName } = await requireMember(cid);
  const today = todayISO();
  const [{ data: balances }, { data: receipts }, { data: docs }] = await Promise.all([
    supabase.from("v_owner_balances").select("*").in("owner_id", ownerIds.length ? ownerIds : ["00000000-0000-0000-0000-000000000000"]),
    supabase.from("v_receipts").select("*").in("owner_id", ownerIds.length ? ownerIds : ["00000000-0000-0000-0000-000000000000"]).order("due_date"),
    supabase.from("documents").select("id, title, kind, doc_date").eq("community_id", cid).order("created_at", { ascending: false }).limit(5),
  ]);
  const balance = (balances ?? []).reduce((a, b) => a + Number(b.balance_cents), 0);
  const pending = ((receipts ?? []) as ReceiptView[]).filter((r) => r.status === "issued" && Number(r.paid_cents) < Number(r.amount_cents));
  const next = pending[0];

  return (
    <div className="grid grid-cols-1 gap-4">
      <h1 className="text-xl font-semibold">Hola{ownerName ? `, ${ownerName.split(" ")[0]}` : ""}</h1>
      {ownerIds.length === 0 ? (
        <Card><CardContent className="pt-5 text-sm text-muted-foreground">Tu usuario no está vinculado a ningún inmueble de esta comunidad.</CardContent></Card>
      ) : (
        <Card className={balance > 0 ? "border-destructive/40" : "border-success/40"}>
          <CardContent className="flex items-center gap-4 pt-5">
            {balance > 0 ? <AlertCircle className="size-10 text-destructive" /> : <CheckCircle2 className="size-10 text-success" />}
            <div>
              <p className="text-sm text-muted-foreground">Tu saldo con la comunidad</p>
              {balance > 0 ? (
                <p className="text-2xl font-semibold text-destructive">{formatEuros(balance)} pendiente</p>
              ) : (
                <p className="text-2xl font-semibold text-success">Estás al corriente{balance < 0 ? ` (${formatEuros(-balance)} a favor)` : ""}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {next ? (
        <Card>
          <CardHeader><CardTitle>Próximo recibo pendiente</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm">{next.concept}</p>
              <p className="text-xs text-muted-foreground">Vence el {formatDate(next.due_date)} · Nº {next.code}</p>
            </div>
            <div className="text-right">
              <Money cents={Number(next.amount_cents) - Number(next.paid_cents)} className="font-semibold" />
              <div><Badge variant={receiptState(next, today).variant}>{receiptState(next, today).label}</Badge></div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Últimos documentos</CardTitle>
          <Link href={`/portal/${cid}/documentos`} className="text-sm text-primary underline">Ver todos</Link>
        </CardHeader>
        <CardContent>
          <ul className="grid grid-cols-1 gap-2">
            {(docs ?? []).map((d) => (
              <li key={d.id}>
                <a href={`/api/documentos/${d.id}`} target="_blank" className="flex items-start gap-2 text-sm hover:text-primary">
                  <FileText className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{d.title}</span>
                    <span className="block text-xs text-muted-foreground">{DOC_KINDS[d.kind]} · {formatDate(d.doc_date)}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
