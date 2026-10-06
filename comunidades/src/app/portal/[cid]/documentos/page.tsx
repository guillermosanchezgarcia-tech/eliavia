import { FileText } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { DOC_KINDS } from "@/lib/data";
import { formatDate } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Documentos" };

export default async function Docs({ params }: { params: Promise<{ cid: string }> }) {
  const { cid } = await params;
  const { supabase } = await requireMember(cid);
  const { data: docs } = await supabase.from("documents").select("id, title, kind, doc_date").eq("community_id", cid).neq("kind", "factura").order("doc_date", { ascending: false });
  const groups = new Map<string, NonNullable<typeof docs>>();
  for (const d of docs ?? []) groups.set(d.kind, [...(groups.get(d.kind) ?? []), d]);
  return (
    <div className="grid grid-cols-1 gap-4">
      <h1 className="text-xl font-semibold">Documentos de la comunidad</h1>
      {groups.size === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay documentos.</p> : null}
      {[...groups.entries()].map(([kind, list]) => (
        <Card key={kind}>
          <CardHeader><CardTitle>{DOC_KINDS[kind]}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-2">
            {list.map((d) => (
              <a key={d.id} href={`/api/documentos/${d.id}`} target="_blank" className="flex items-center gap-2 text-sm hover:text-primary">
                <FileText className="size-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1">{d.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDate(d.doc_date)}</span>
              </a>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
