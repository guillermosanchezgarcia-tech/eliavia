import Link from "next/link";
import { redirect } from "next/navigation";
import { getMemberships, requireMember } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { PortalNav } from "@/components/portal-nav";
import { LegalNotice } from "@/components/legal-notice";

export default async function PortalLayout({ children, params }: { children: React.ReactNode; params: Promise<{ cid: string }> }) {
  const { cid } = await params;
  const { supabase, user, community, roles, isAdmin, ownerName } = await requireMember(cid);
  const { data: profile } = await supabase.from("profiles").select("privacy_accepted_at").eq("id", user.id).single();
  if (!profile?.privacy_accepted_at) redirect("/primer-acceso");
  const memberships = await getMemberships();
  const several = new Set(memberships.map((m) => m.community_id)).size > 1;
  return (
    <div className="min-h-dvh pb-20 md:pb-0">
      <header className="no-print border-b border-border bg-card">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <Logo />
          <div className="ml-auto flex items-center gap-3 text-sm">
            {isAdmin ? <Link href={`/admin/${cid}`} className="text-primary underline">Administración</Link> : null}
            {several ? <Link href={isAdmin ? "/admin" : "/portal"} className="hidden text-muted-foreground sm:inline">Cambiar</Link> : null}
            <form action="/auth/salir" method="post"><button className="text-muted-foreground hover:text-foreground">Salir</button></form>
          </div>
        </div>
        <div className="mx-auto max-w-4xl px-4 pb-3">
          <p className="text-sm font-medium">{community.name}</p>
          <p className="text-xs text-muted-foreground">{ownerName ?? user.email}{roles.has("president") ? " · Presidencia" : ""}</p>
        </div>
        <div className="md:pb-3"><PortalNav cid={cid} president={roles.has("president") || isAdmin} /></div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">
        {children}
        <LegalNotice communityId={cid} />
      </main>
    </div>
  );
}
