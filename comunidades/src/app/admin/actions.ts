"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { back } from "@/lib/flash";
import { defaultPrivacyPolicy } from "@/lib/privacidad";
import { friendlyError, str } from "@/lib/utils";

export async function createCommunity(fd: FormData) {
  const { supabase } = await requireUser();
  const name = str(fd, "name");
  if (!name) back("/admin", { error: "El nombre es obligatorio." });
  const region = str(fd, "region");
  const { data, error } = await supabase.rpc("create_community", {
    p_name: name,
    p_cif: str(fd, "cif"),
    p_address: str(fd, "address"),
    p_postal_code: str(fd, "postal_code"),
    p_city: str(fd, "city"),
    p_province: str(fd, "province"),
    p_region: region,
    p_reserve_fund_pct: region === "Cataluña" ? 5 : 10,
  });
  if (error) back("/admin", { error: friendlyError(error) });
  await supabase.from("communities").update({ privacy_policy: defaultPrivacyPolicy({ name, cif: str(fd, "cif"), address: str(fd, "address") }) }).eq("id", data);
  redirect(`/admin/${data}/inmuebles?ok=${encodeURIComponent("Comunidad creada. Empieza dando de alta los inmuebles.")}`);
}
