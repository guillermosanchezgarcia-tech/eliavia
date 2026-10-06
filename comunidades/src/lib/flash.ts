import { redirect } from "next/navigation";

/** Vuelve a una página mostrando un mensaje de éxito o de error. */
export function back(path: string, msg: { ok?: string; error?: string }): never {
  const [base, query] = path.split("?");
  const params = new URLSearchParams(query);
  params.delete("ok");
  params.delete("error");
  if (msg.ok) params.set("ok", msg.ok);
  if (msg.error) params.set("error", msg.error);
  const qs = params.toString();
  redirect(qs ? `${base}?${qs}` : base);
}
