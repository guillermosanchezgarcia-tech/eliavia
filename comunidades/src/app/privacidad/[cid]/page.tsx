import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { defaultPrivacyPolicy } from "@/lib/privacidad";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Política de privacidad" };

export default async function Privacy({ params }: { params: Promise<{ cid: string }> }) {
  const { cid } = await params;
  const { community } = await requireMember(cid);
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/inicio" className="text-sm text-primary underline">← Volver</Link>
      <Card className="mt-4">
        <CardHeader><CardTitle>Política de privacidad · {community.name}</CardTitle></CardHeader>
        <CardContent className="whitespace-pre-wrap text-sm leading-relaxed">{community.privacy_policy || defaultPrivacyPolicy(community)}</CardContent>
      </Card>
    </main>
  );
}
