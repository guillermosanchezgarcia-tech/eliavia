import { FileText } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { getCategories } from "@/lib/data";
import { formatDate, todayISO } from "@/lib/dates";
import { Money } from "@/components/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";

export const metadata = { title: "Facturas de la comunidad" };

export default async function Invoices({ params, searchParams }: { params: Promise<{ cid: string }>; searchParams: Promise<Record<string, string>> }) {
  const { cid } = await params;
  const sp = await searchParams;
  const { supabase } = await requireMember(cid);
  const year = todayISO().slice(0, 4);
  const from = sp.desde || `${year}-01-01`;
  const to = sp.hasta || `${year}-12-31`;
  // Los permisos RLS ocultan automáticamente las facturas restringidas
  let q = supabase.from("expenses").select("id, invoice_date, invoice_number, description, total_cents, charged_to_reserve, document_id, category_id, suppliers(name)").eq("community_id", cid).gte("invoice_date", from).lte("invoice_date", to).order("invoice_date", { ascending: false });
  if (sp.proveedor) q = q.eq("supplier_id", sp.proveedor);
  if (sp.partida) q = q.eq("category_id", sp.partida);
  const [{ data: rows }, cats, { data: visible }] = await Promise.all([q, getCategories(supabase, cid), supabase.from("expenses").select("supplier_id, suppliers(id, name)").eq("community_id", cid)]);
  // Solo proveedores con facturas visibles para el propietario
  const suppliers = [...new Map((visible ?? []).filter((e) => e.suppliers).map((e) => {
    const s = e.suppliers as unknown as { id: string; name: string };
    return [s.id, s] as const;
  })).values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  const total = (rows ?? []).reduce((a, r) => a + Number(r.total_cents), 0);

  return (
    <div className="grid grid-cols-1 gap-4">
      <h1 className="text-xl font-semibold">Facturas de la comunidad</h1>
      <form className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap [&>*]:min-w-0">
        <Input type="date" name="desde" defaultValue={from} aria-label="Desde" className="sm:w-auto" />
        <Input type="date" name="hasta" defaultValue={to} aria-label="Hasta" className="sm:w-auto" />
        <Select name="proveedor" defaultValue={sp.proveedor ?? ""} className="sm:w-auto">
          <option value="">Todos los proveedores</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <Select name="partida" defaultValue={sp.partida ?? ""} className="sm:w-auto">
          <option value="">Todas las partidas</option>
          {cats.filter((c) => c.kind === "expense").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Button type="submit" variant="outline" className="col-span-2 sm:col-span-1">Filtrar</Button>
      </form>
      <Card>
        <CardContent className="grid grid-cols-1 gap-1 pt-5">
          {(rows ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No hay facturas en este periodo.</p> : null}
          {(rows ?? []).map((r) => {
            const supplier = (r.suppliers as unknown as { name: string } | null)?.name;
            return (
              <div key={r.id} className="flex items-start gap-3 border-b py-2 last:border-0">
                {r.document_id ? (
                  <a href={`/api/documentos/${r.document_id}`} target="_blank" className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary" title="Ver factura escaneada"><FileText className="size-4" /></a>
                ) : <div className="mt-0.5 size-8" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{supplier ?? "Sin proveedor"}</p>
                  <p className="truncate text-xs text-muted-foreground">{formatDate(r.invoice_date)} · {catName.get(r.category_id)}{r.invoice_number ? ` · Fra. ${r.invoice_number}` : ""}</p>
                  {r.charged_to_reserve ? <Badge variant="muted" className="mt-1">Con cargo al fondo de reserva</Badge> : null}
                </div>
                <Money cents={r.total_cents} className="text-sm font-medium" />
              </div>
            );
          })}
          <div className="flex justify-between pt-3 text-sm font-semibold"><span>Total</span><Money cents={total} /></div>
        </CardContent>
      </Card>
    </div>
  );
}
