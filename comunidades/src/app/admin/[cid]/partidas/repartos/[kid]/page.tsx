import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getProperties } from "@/lib/data";
import { formatPct } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { Flash } from "@/components/flash";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { saveWeights } from "../../actions";

export default async function KeyWeights({ params, searchParams }: { params: Promise<{ cid: string; kid: string }>; searchParams: Promise<Record<string, string>> }) {
  const { cid, kid } = await params;
  const sp = await searchParams;
  const { supabase } = await requireAdmin(cid);
  const { data: key } = await supabase.from("allocation_keys").select("*").eq("id", kid).eq("community_id", cid).single();
  if (!key) notFound();
  const [props, { data: weights }] = await Promise.all([getProperties(supabase, cid), supabase.from("allocation_key_weights").select("*").eq("key_id", kid)]);
  const w = new Map((weights ?? []).map((x) => [x.property_id, String(Number(x.weight)).replace(".", ",")]));
  return (
    <>
      <PageHeader
        title={`Coeficientes específicos · ${key.name}`}
        description="Indica el peso de cada inmueble en este reparto (por ejemplo, el % acordado en junta). Deja vacío o 0 los que no participan."
        actions={<Link href={`/admin/${cid}/partidas`} className="text-sm text-primary underline">← Volver</Link>}
      />
      <Flash ok={sp.ok} error={sp.error} />
      <Card>
        <CardContent className="pt-5">
          <form action={saveWeights.bind(null, cid, kid)}>
            <Table>
              <THead><TR><TH>Inmueble</TH><TH>Coeficiente general</TH><TH>Peso en este reparto</TH></TR></THead>
              <TBody>
                {props.map((p) => (
                  <TR key={p.id}>
                    <TD>{p.code}</TD>
                    <TD className="tabular text-muted-foreground">{formatPct(p.coefficient, 4)}</TD>
                    <TD><Input name={`w_${p.id}`} defaultValue={w.get(p.id) ?? ""} inputMode="decimal" className="max-w-32" /></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <div className="mt-4"><SubmitButton>Guardar coeficientes</SubmitButton></div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
