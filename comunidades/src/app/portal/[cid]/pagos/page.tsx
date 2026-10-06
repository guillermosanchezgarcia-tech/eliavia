import { Download } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { getProperties, PAYMENT_METHODS, receiptState, type ReceiptView } from "@/lib/data";
import { formatDate, todayISO } from "@/lib/dates";
import { Money } from "@/components/money";
import { OwnerStatement } from "@/components/owner-statement";
import { PrintButton } from "@/components/print-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Mis pagos" };

export default async function MyPayments({ params }: { params: Promise<{ cid: string }> }) {
  const { cid } = await params;
  const { supabase, ownerIds } = await requireMember(cid);
  const today = todayISO();
  const ids = ownerIds.length ? ownerIds : ["00000000-0000-0000-0000-000000000000"];
  const [{ data: receipts }, { data: payments }, props] = await Promise.all([
    supabase.from("v_receipts").select("*").in("owner_id", ids).order("due_date", { ascending: false }),
    supabase.from("payments").select("*").in("owner_id", ids).order("payment_date", { ascending: false }),
    getProperties(supabase, cid),
  ]);
  const code = new Map(props.map((p) => [p.id, p.code]));
  const list = (receipts ?? []) as ReceiptView[];

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Mis recibos y pagos</h1>
        <PrintButton label="Imprimir" />
      </div>

      <Card>
        <CardHeader><CardTitle>Recibos</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-2">
          {list.length === 0 ? <p className="text-sm text-muted-foreground">No tienes recibos.</p> : null}
          {list.map((r) => {
            const st = receiptState(r, today);
            return (
              <div key={r.id} className="flex items-start justify-between gap-3 border-b pb-2 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{code.get(r.property_id)} · {formatDate(r.due_date)}</p>
                  <p className="truncate text-xs text-muted-foreground">{r.concept} · Nº {r.code}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Money cents={r.amount_cents} className="text-sm font-medium" />
                  <div className="flex items-center gap-2">
                    <Badge variant={st.variant}>{st.label}</Badge>
                    <a href={`/api/recibos/${r.id}/pdf`} target="_blank" className="text-primary" title="Descargar recibo en PDF"><Download className="size-4" /></a>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Pagos realizados</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-2">
          {(payments ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No hay pagos registrados.</p> : null}
          {(payments ?? []).map((p) => (
            <div key={p.id} className="flex items-center justify-between border-b pb-2 text-sm last:border-0">
              <div>
                <p>{formatDate(p.payment_date)} · {PAYMENT_METHODS[p.method]}</p>
                <p className="text-xs text-muted-foreground">{p.reference}</p>
              </div>
              <Money cents={p.amount_cents} className="font-medium text-success" />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Extracto de cuenta</CardTitle></CardHeader>
        <CardContent><OwnerStatement receipts={list} payments={payments ?? []} /></CardContent>
      </Card>
    </div>
  );
}
