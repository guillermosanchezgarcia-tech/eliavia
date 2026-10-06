import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "./supabase/server";

export type Role = "admin" | "president" | "owner";

export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
});

export async function requireUser() {
  const { supabase, user } = await getSession();
  if (!user) redirect("/login");
  return { supabase, user };
}

export interface MembershipRow {
  community_id: string;
  role: Role;
  communities: { id: string; name: string; city: string | null } | null;
}

export const getMemberships = cache(async () => {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("memberships")
    .select("community_id, role, communities(id, name, city)")
    .eq("user_id", user.id);
  return (data ?? []) as unknown as MembershipRow[];
});

export interface CommunityRow {
  id: string;
  name: string;
  cif: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  province: string | null;
  region: string | null;
  reserve_fund_pct: string;
  fiscal_year_start_month: number;
  secretary_name: string | null;
  privacy_policy: string | null;
}

/** Comprueba que el usuario pertenece a la comunidad y devuelve sus roles en ella. */
export const requireMember = cache(async (communityId: string) => {
  const { supabase, user } = await requireUser();
  const memberships = await getMemberships();
  const roles = new Set(memberships.filter((m) => m.community_id === communityId).map((m) => m.role));
  if (roles.size === 0) notFound();
  const { data: community } = await supabase.from("communities").select("*").eq("id", communityId).single();
  if (!community) notFound();
  const { data: owners } = await supabase.from("owners").select("id, full_name").eq("community_id", communityId).eq("user_id", user.id);
  return {
    supabase,
    user,
    roles,
    community: community as CommunityRow,
    ownerIds: (owners ?? []).map((o) => o.id as string),
    ownerName: owners?.[0]?.full_name as string | undefined,
    isAdmin: roles.has("admin"),
    canViewAccounts: roles.has("admin") || roles.has("president"),
  };
});

/** Solo administradores de la comunidad. */
export async function requireAdmin(communityId: string) {
  const ctx = await requireMember(communityId);
  if (!ctx.isAdmin) redirect(`/portal/${communityId}`);
  return ctx;
}
