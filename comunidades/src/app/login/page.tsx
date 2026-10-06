import Link from "next/link";
import { Logo } from "@/components/logo";
import { Flash } from "@/components/flash";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { LegalNotice } from "@/components/legal-notice";
import { signIn, sendMagicLink } from "./actions";

export const metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const magic = sp.modo === "enlace";
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 flex justify-center">
        <Logo className="text-xl" />
      </div>
      <Flash ok={sp.ok} error={sp.error} />
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{magic ? "Entrar con un enlace por email" : "Entrar"}</CardTitle>
          <CardDescription>Administración de la comunidad y portal del propietario.</CardDescription>
        </CardHeader>
        <CardContent>
          {magic ? (
            <form action={sendMagicLink} className="grid gap-4">
              <Field label="Email">
                <Input name="email" type="email" autoComplete="email" required />
              </Field>
              <SubmitButton pendingText="Enviando…">Enviarme el enlace</SubmitButton>
              <Link href="/login" className="text-center text-sm text-primary underline-offset-4 hover:underline">Entrar con contraseña</Link>
            </form>
          ) : (
            <form action={signIn} className="grid gap-4">
              <Field label="Email">
                <Input name="email" type="email" autoComplete="email" required />
              </Field>
              <Field label="Contraseña">
                <Input name="password" type="password" autoComplete="current-password" required />
              </Field>
              <SubmitButton pendingText="Entrando…">Entrar</SubmitButton>
              <Link href="/login?modo=enlace" className="text-center text-sm text-primary underline-offset-4 hover:underline">
                ¿Has olvidado la contraseña? Entra con un enlace por email
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        ¿Eres administrador y no tienes cuenta? <Link href="/registro" className="text-primary underline">Crear cuenta de administrador</Link>
      </p>
      <p className="mt-2 text-center text-xs text-muted-foreground">Si eres propietario, pide el acceso al administrador de tu comunidad.</p>
      <LegalNotice />
    </main>
  );
}
