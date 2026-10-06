import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { Flash } from "@/components/flash";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { LegalNotice } from "@/components/legal-notice";
import { getMemberships, requireUser } from "@/lib/auth";
import { back } from "@/lib/flash";
import { defaultPrivacyPolicy } from "@/lib/privacidad";

export const metadata = { title: "Primer acceso" };

async function accept(formData: FormData) {
  "use server";
  if (formData.get("accept") !== "on") back("/primer-acceso", { error: "Debes aceptar la política de privacidad para continuar." });
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("profiles").update({ privacy_accepted_at: new Date().toISOString() }).eq("id", user.id);
  if (error) back("/primer-acceso", { error: error.message });
  redirect("/inicio");
}

export default async function FirstAccess({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { supabase } = await requireUser();
  const memberships = await getMemberships();
  const ids = [...new Set(memberships.map((m) => m.community_id))];
  const { data: communities } = ids.length
    ? await supabase.from("communities").select("id, name, cif, address, privacy_policy").in("id", ids)
    : { data: [] as { id: string; name: string; cif: string | null; address: string | null; privacy_policy: string | null }[] };

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6"><Logo className="text-xl" /></div>
      <Flash error={sp.error} />
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Bienvenido/a. Antes de empezar…</CardTitle>
          <CardDescription>
            Para usar el portal necesitamos que leas y aceptes la política de privacidad. La comunidad de propietarios es la responsable del
            tratamiento de tus datos y el administrador actúa como encargado del tratamiento.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {(communities ?? []).length === 0 ? (
            <div className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-lg border bg-muted/40 p-4 text-sm">
              {defaultPrivacyPolicy({ name: "La comunidad de propietarios que des de alta" })}
            </div>
          ) : (
            (communities ?? []).map((c) => (
              <div key={c.id}>
                <p className="mb-2 text-sm font-medium">{c.name}</p>
                <div className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-lg border bg-muted/40 p-4 text-sm">
                  {c.privacy_policy || defaultPrivacyPolicy(c)}
                </div>
              </div>
            ))
          )}
          <form action={accept} className="grid gap-4">
            <Checkbox name="accept" label="He leído y acepto la política de privacidad." required />
            <SubmitButton>Aceptar y continuar</SubmitButton>
          </form>
        </CardContent>
      </Card>
      <LegalNotice />
    </main>
  );
}
