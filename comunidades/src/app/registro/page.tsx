import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { Flash } from "@/components/flash";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { createClient } from "@/lib/supabase/server";
import { back } from "@/lib/flash";
import { str } from "@/lib/utils";

export const metadata = { title: "Crear cuenta" };

async function register(formData: FormData) {
  "use server";
  const name = str(formData, "name");
  const email = str(formData, "email");
  const password = str(formData, "password");
  if (!name || !email || !password) back("/registro", { error: "Rellena todos los campos." });
  if (password.length < 8) back("/registro", { error: "La contraseña debe tener al menos 8 caracteres." });
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
  if (error) back("/registro", { error: error.message });
  if (!data.session) back("/login", { ok: "Cuenta creada. Revisa tu email para confirmarla y después entra." });
  redirect("/inicio");
}

export default async function RegisterPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 flex justify-center"><Logo className="text-xl" /></div>
      <Flash ok={sp.ok} error={sp.error} />
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Crear cuenta de administrador</CardTitle>
          <CardDescription>Para administradores de fincas o propietarios que administran su comunidad. Después podrás dar de alta tus comunidades.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={register} className="grid gap-4">
            <Field label="Nombre y apellidos"><Input name="name" required /></Field>
            <Field label="Email"><Input name="email" type="email" required /></Field>
            <Field label="Contraseña" hint="Mínimo 8 caracteres."><Input name="password" type="password" minLength={8} required /></Field>
            <SubmitButton>Crear cuenta</SubmitButton>
          </form>
        </CardContent>
      </Card>
      <p className="mt-6 text-center text-sm"><Link href="/login" className="text-primary underline">Ya tengo cuenta</Link></p>
    </main>
  );
}
