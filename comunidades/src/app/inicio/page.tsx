import { redirect } from "next/navigation";
import { getMemberships, requireUser } from "@/lib/auth";

/** Reparte a cada usuario a su sitio: administración o portal del propietario. */
export default async function Inicio() {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase.from("profiles").select("privacy_accepted_at").eq("id", user.id).single();
  if (!profile?.privacy_accepted_at) redirect("/primer-acceso");

  const memberships = await getMemberships();
  if (memberships.length === 0 || memberships.some((m) => m.role === "admin")) redirect("/admin");
  const communities = [...new Set(memberships.map((m) => m.community_id))];
  if (communities.length === 1) redirect(`/portal/${communities[0]}`);
  redirect("/portal");
}
