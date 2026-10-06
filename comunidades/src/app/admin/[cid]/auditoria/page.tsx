import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import { formatEuros } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export const metadata = { title: "Auditoría" };

const TABLES: Record<string, string> = {
  receipts: "Recibo", payments: "Cobro", expenses: "Gasto", budgets: "Presupuesto", budget_lines: "Partida de presupuesto",
  owners: "Propietario", ownerships: "Titularidad", properties: "Inmueble", suppliers: "Proveedor", documents: "Documento",
  communities: "Comunidad", memberships: "Acceso", bank_accounts: "Cuenta bancaria", categories: "Partida", allocation_keys: "Reparto",
};
const ACTIONS: Record<string, { label: string; variant: "success" | "warning" | "danger" }> = {
  INSERT: { label: "Alta", variant: "success" }, UPDATE: { label: "Modificación", variant: "warning" }, DELETE: { label: "Baja", variant: "danger" },
};

function summary(row: Record<string, unknown> | null) {
  if (!row) return "";
  const parts = [row.code, row.full_name, row.name, row.title, row.invoice_number && `Fra. ${row.invoice_number}`, row.concept, row.reference]
    .filter(Boolean).map(String);
  const cents = row.amount_cents ?? row.total_cents;
  if (cents != null) parts.push(formatEuros(Number(cents)));
  return parts.slice(0, 3).join(" · ");
}

export default async function Audit({ params, searchParams }: { params: Promise<{ cid: string }>; searchParams: Promise<Record<string, string>> }) {
  const { cid } = await params;
  const sp = await searchParams;
  const { supabase } = await requireAdmin(cid);
  let q = supabase.from("audit_log").select("*").eq("community_id", cid).order("changed_at", { ascending: false }).limit(300);
  if (sp.tabla) q = q.eq("table_name", sp.tabla);
  const [{ data: log }, { data: members }] = await Promise.all([q, supabase.rpc("community_members", { p_community: cid })]);
  const email = new Map((members ?? []).map((m: { user_id: string; email: string }) => [m.user_id, m.email]));

  return (
    <>
      <PageHeader title="Registro de auditoría" description="Quién crea, modifica o borra cada movimiento (últimos 300 cambios)." />
      <form className="mb-4 flex gap-2">
        <Select name="tabla" defaultValue={sp.tabla ?? ""} className="w-auto">
          <option value="">Todo</option>
          {Object.entries(TABLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Button variant="outline" type="submit">Filtrar</Button>
      </form>
      <Card>
        <CardContent className="pt-5">
          <Table>
            <THead><TR><TH>Fecha y hora</TH><TH>Usuario</TH><TH>Acción</TH><TH>Registro</TH><TH>Detalle</TH></TR></THead>
            <TBody>
              {(log ?? []).map((l) => (
                <TR key={l.id}>
                  <TD className="whitespace-nowrap text-xs">{formatDateTime(l.changed_at)}</TD>
                  <TD className="text-xs">{l.user_id ? email.get(l.user_id) ?? l.user_id.slice(0, 8) : <span className="text-muted-foreground">Sistema / carga inicial</span>}</TD>
                  <TD><Badge variant={ACTIONS[l.action].variant}>{ACTIONS[l.action].label}</Badge></TD>
                  <TD className="text-sm">{TABLES[l.table_name] ?? l.table_name}</TD>
                  <TD className="max-w-96 truncate text-xs text-muted-foreground">{summary(l.new_data ?? l.old_data)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
