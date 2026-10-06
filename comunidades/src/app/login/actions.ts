"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { back } from "@/lib/flash";
import { str } from "@/lib/utils";

export async function signIn(formData: FormData) {
  const email = str(formData, "email");
  const password = str(formData, "password");
  if (!email || !password) back("/login", { error: "Escribe tu email y tu contraseña." });
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) back("/login", { error: "Email o contraseña incorrectos." });
  redirect("/inicio");
}

export async function sendMagicLink(formData: FormData) {
  const email = str(formData, "email");
  if (!email) back("/login?modo=enlace", { error: "Escribe tu email." });
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: `${origin}/auth/callback?next=/inicio` },
  });
  if (error) back("/login?modo=enlace", { error: "No se pudo enviar el enlace. Comprueba el email o inténtalo más tarde." });
  back("/login", { ok: "Te hemos enviado un enlace de acceso por email. Ábrelo desde este mismo navegador." });
}
