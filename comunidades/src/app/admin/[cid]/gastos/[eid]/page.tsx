import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { expenseOptions } from "@/lib/expense-options";
import { PageHeader } from "@/components/page-header";
import { Flash } from "@/components/flash";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { ExpenseForm } from "../expense-form";
import { deleteExpense, replaceInvoiceFile, updateExpense } from "../actions";

export default async function ExpenseDetail({ params, searchParams }: { params: Promise<{ cid: string; eid: string }>; searchParams: Promise<Record<string, string>> }) {
  const { cid, eid } = await params;
  const sp = await searchParams;
  const { supabase } = await requireAdmin(cid);
  const { data: e } = await supabase.from("expenses").select("*, documents(id, title, mime_type)").eq("id", eid).eq("community_id", cid).single();
  if (!e) notFound();
  const o = await expenseOptions(supabase, cid);
  const doc = e.documents as { id: string; title: string; mime_type: string } | null;
  return (
    <>
      <PageHeader
        title={`Factura ${e.invoice_number ?? ""}`}
        description={e.description}
        actions={<Link href={`/admin/${cid}/gastos`} className="text-sm text-primary underline">← Gastos</Link>}
      />
      <Flash ok={sp.ok} error={sp.error} />
      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardContent className="pt-5">
            <ExpenseForm
              action={updateExpense.bind(null, cid, eid)}
              {...o}
              withFile={false}
              defaults={{ ...e, base_cents: Number(e.base_cents), vat_cents: Number(e.vat_cents), irpf_cents: Number(e.irpf_cents) }}
              submitLabel="Guardar cambios"
            />
          </CardContent>
        </Card>
        <div className="grid content-start gap-6 xl:col-span-2">
          <Card>
            <CardHeader><CardTitle>Documento escaneado</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              {doc ? (
                <>
                  <a href={`/api/documentos/${doc.id}`} target="_blank" className="flex items-center gap-2 text-sm text-primary underline">
                    <FileText className="size-4" /> {doc.title}
                  </a>
                  {e.restricted ? <Badge variant="warning">Restringido: no visible para propietarios</Badge> : <Badge variant="success">Visible en el portal del propietario</Badge>}
                  {doc.mime_type?.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/documentos/${doc.id}`} alt="Factura escaneada" className="max-h-[480px] w-full rounded-lg border object-contain" />
                  ) : (
                    <iframe src={`/api/documentos/${doc.id}`} className="h-[480px] w-full rounded-lg border" title="Factura escaneada" />
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Sin documento adjunto.</p>
              )}
              <form action={replaceInvoiceFile.bind(null, cid, eid)} className="grid gap-2 border-t pt-3">
                <Input type="file" name="file" accept="application/pdf,image/*" required />
                <SubmitButton variant="outline" size="sm">{doc ? "Sustituir documento" : "Adjuntar documento"}</SubmitButton>
              </form>
            </CardContent>
          </Card>
          <form action={deleteExpense.bind(null, cid, eid)}>
            <SubmitButton variant="ghost" className="text-destructive" confirm="¿Eliminar este gasto y su documento?">Eliminar gasto</SubmitButton>
          </form>
        </div>
      </div>
    </>
  );
}
