import { FileText, Lock } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { DOC_KINDS } from "@/lib/data";
import { formatDate, todayISO } from "@/lib/dates";
import { back } from "@/lib/flash";
import { bool, friendlyError, str } from "@/lib/utils";
import { deleteDocumentFile, uploadDocument } from "@/lib/uploads";
import { PageHeader } from "@/components/page-header";
import { Flash } from "@/components/flash";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Field, Input, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export const metadata = { title: "Documentos" };

async function upload(cid: string, fd: FormData) {
  "use server";
  const { supabase } = await requireAdmin(cid);
  const file = fd.get("file");
  const title = str(fd, "title");
  if (!(file instanceof File) || !title) back(`/admin/${cid}/documentos`, { error: "Indica el título y el archivo." });
  const res = await uploadDocument(supabase, cid, file, { kind: str(fd, "kind") ?? "otro", title, doc_date: str(fd, "doc_date"), restricted: bool(fd, "restricted"), folder: "documentos" });
  if (res.error) back(`/admin/${cid}/documentos`, { error: res.error });
  back(`/admin/${cid}/documentos`, { ok: "Documento subido." });
}

async function toggleRestricted(cid: string, id: string, restricted: boolean) {
  "use server";
  const { supabase } = await requireAdmin(cid);
  const { error } = await supabase.from("documents").update({ restricted }).eq("id", id);
  if (error) back(`/admin/${cid}/documentos`, { error: friendlyError(error) });
  await supabase.from("expenses").update({ restricted }).eq("document_id", id);
  back(`/admin/${cid}/documentos`, { ok: restricted ? "Documento restringido: ya no lo ven los propietarios." : "Documento visible para los propietarios." });
}

async function remove(cid: string, id: string) {
  "use server";
  const { supabase } = await requireAdmin(cid);
  const error = await deleteDocumentFile(supabase, id);
  if (error) back(`/admin/${cid}/documentos`, { error: friendlyError(error) });
  back(`/admin/${cid}/documentos`, { ok: "Documento eliminado." });
}

export default async function Documents({ params, searchParams }: { params: Promise<{ cid: string }>; searchParams: Promise<Record<string, string>> }) {
  const { cid } = await params;
  const sp = await searchParams;
  const { supabase } = await requireAdmin(cid);
  let q = supabase.from("documents").select("*").eq("community_id", cid).order("doc_date", { ascending: false, nullsFirst: false });
  if (sp.tipo) q = q.eq("kind", sp.tipo);
  else q = q.neq("kind", "factura");
  const { data: docs } = await q;

  return (
    <>
      <PageHeader title="Documentos" description="Archivo de actas, estatutos, pólizas, contratos y facturas, a disposición de los propietarios (art. 19 y 20 LPH)." />
      <Flash ok={sp.ok} error={sp.error} />
      <form className="mb-4 flex gap-2 no-print">
        <Select name="tipo" defaultValue={sp.tipo ?? ""} className="w-auto">
          <option value="">Todos salvo facturas</option>
          {Object.entries(DOC_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Button variant="outline" type="submit">Filtrar</Button>
      </form>
      <Card>
        <CardContent className="pt-5">
          <Table>
            <THead><TR><TH>Documento</TH><TH>Tipo</TH><TH>Fecha</TH><TH>Visibilidad</TH><TH></TH></TR></THead>
            <TBody>
              {(docs ?? []).map((d) => (
                <TR key={d.id}>
                  <TD><a href={`/api/documentos/${d.id}`} target="_blank" className="flex items-center gap-2 text-primary hover:underline"><FileText className="size-4 shrink-0" />{d.title}</a></TD>
                  <TD>{DOC_KINDS[d.kind]}</TD>
                  <TD>{formatDate(d.doc_date)}</TD>
                  <TD>{d.restricted ? <Badge variant="warning"><Lock className="size-3" /> Restringido</Badge> : <Badge variant="success">Propietarios</Badge>}</TD>
                  <TD className="whitespace-nowrap text-right">
                    <form action={toggleRestricted.bind(null, cid, d.id, !d.restricted)} className="inline">
                      <button className="mr-3 text-xs text-primary underline">{d.restricted ? "Hacer visible" : "Restringir"}</button>
                    </form>
                    <form action={remove.bind(null, cid, d.id)} className="inline">
                      <SubmitButton variant="link" size="sm" className="h-auto text-xs text-destructive" confirm="¿Eliminar el documento?">Eliminar</SubmitButton>
                    </form>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Subir documento</CardTitle>
          <CardDescription>Las facturas de proveedores se suben desde «Gastos y facturas» para contabilizarlas a la vez.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={upload.bind(null, cid)} className="grid gap-4 sm:grid-cols-2">
            <Field label="Título" className="sm:col-span-2"><Input name="title" required placeholder="Acta de la junta ordinaria de…" /></Field>
            <Field label="Tipo">
              <Select name="kind" defaultValue="acta">{Object.entries(DOC_KINDS).filter(([k]) => k !== "factura").map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
            </Field>
            <Field label="Fecha"><Input type="date" name="doc_date" defaultValue={todayISO()} /></Field>
            <Field label="Archivo" className="sm:col-span-2"><Input type="file" name="file" accept="application/pdf,image/*" required /></Field>
            <Checkbox name="restricted" label="Restringido (solo administración y presidencia)" className="sm:col-span-2" />
            <div className="sm:col-span-2"><SubmitButton>Subir</SubmitButton></div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
