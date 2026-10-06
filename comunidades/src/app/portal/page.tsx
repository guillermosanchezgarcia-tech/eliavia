import Link from "next/link";
import { getMemberships } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { Card, CardContent } from "@/components/ui/card";

export default async function PortalHome() {
  const memberships = await getMemberships();
  const communities = [...new Map(memberships.map((m) => [m.community_id, m.communities])).entries()];
  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <Logo className="mb-6 text-lg" />
      <h1 className="mb-4 text-xl font-semibold">Elige tu comunidad</h1>
      <div className="grid gap-3">
        {communities.map(([id, c]) => (
          <Link key={id} href={`/portal/${id}`}>
            <Card className="hover:border-primary"><CardContent className="pt-5"><p className="font-medium">{c?.name}</p><p className="text-sm text-muted-foreground">{c?.city}</p></CardContent></Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
