import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface Property {
  id: string;
  community_id: string;
  kind: "vivienda" | "local" | "garaje" | "trastero" | "otro";
  code: string;
  description: string | null;
  coefficient: string;
  tourist_use: boolean;
  tourist_surcharge_pct: string;
  sort_order: number;
}

export interface Owner {
  id: string;
  full_name: string;
  nif: string | null;
  email: string | null;
  phone: string | null;
  iban: string | null;
  address: string | null;
  notes: string | null;
  user_id: string | null;
}

export interface Ownership {
  id: string;
  property_id: string;
  owner_id: string;
  start_date: string;
  end_date: string | null;
}

export interface Category {
  id: string;
  code: string;
  name: string;
  kind: "expense" | "income" | "reserve";
  is_system: boolean;
  active: boolean;
  sort_order: number;
}

export interface AllocationKey {
  id: string;
  name: string;
  method: "coefficient" | "equal" | "custom";
  group_id: string | null;
  is_default: boolean;
}

export interface BankAccount {
  id: string;
  name: string;
  iban: string | null;
  is_cash: boolean;
  is_default: boolean;
}

export const PROPERTY_KINDS: Record<Property["kind"], string> = {
  vivienda: "Vivienda",
  local: "Local",
  garaje: "Garaje",
  trastero: "Trastero",
  otro: "Otro",
};

export const PAYMENT_METHODS: Record<string, string> = {
  transferencia: "Transferencia",
  domiciliacion: "Domiciliación",
  efectivo: "Efectivo",
  bizum: "Bizum",
  otro: "Otro",
};

export const DOC_KINDS: Record<string, string> = {
  factura: "Factura",
  acta: "Acta",
  estatutos: "Estatutos",
  seguro: "Seguro",
  contrato: "Contrato",
  presupuesto: "Presupuesto",
  cuentas: "Cuentas",
  aviso: "Aviso",
  otro: "Otro",
};

export const METHOD_LABELS: Record<AllocationKey["method"], string> = {
  coefficient: "Por coeficiente",
  equal: "Partes iguales",
  custom: "Coeficientes específicos",
};

export async function getProperties(supabase: SupabaseClient, cid: string): Promise<Property[]> {
  const { data } = await supabase.from("properties").select("*").eq("community_id", cid).order("sort_order").order("code");
  return (data ?? []) as Property[];
}

export async function getOwners(supabase: SupabaseClient, cid: string): Promise<Owner[]> {
  const { data } = await supabase.from("owners").select("*").eq("community_id", cid).order("full_name");
  return (data ?? []) as Owner[];
}

export async function getOwnerships(supabase: SupabaseClient, cid: string): Promise<Ownership[]> {
  const { data } = await supabase.from("ownerships").select("*").eq("community_id", cid).order("start_date");
  return (data ?? []) as Ownership[];
}

/** Titular de cada inmueble en una fecha. */
export function ownerAt(ownerships: Ownership[], propertyId: string, date: string): string | null {
  const o = ownerships.find((x) => x.property_id === propertyId && x.start_date <= date && (!x.end_date || x.end_date >= date));
  return o?.owner_id ?? null;
}

export async function getCategories(supabase: SupabaseClient, cid: string): Promise<Category[]> {
  const { data } = await supabase.from("categories").select("*").eq("community_id", cid).order("sort_order").order("code");
  return (data ?? []) as Category[];
}

export async function getAllocationKeys(supabase: SupabaseClient, cid: string): Promise<AllocationKey[]> {
  const { data } = await supabase.from("allocation_keys").select("*").eq("community_id", cid).order("is_default", { ascending: false }).order("name");
  return (data ?? []) as AllocationKey[];
}

export async function getBankAccounts(supabase: SupabaseClient, cid: string): Promise<BankAccount[]> {
  const { data } = await supabase.from("bank_accounts").select("*").eq("community_id", cid).order("is_cash").order("name");
  return (data ?? []) as BankAccount[];
}

export interface ReserveStatus {
  balance_cents: number;
  minimum_cents: number;
  base_budget_cents: number;
  pct: string;
  budget_id: string | null;
  budget_name: string | null;
  shortfall_cents: number;
}

export async function getReserveStatus(supabase: SupabaseClient, cid: string): Promise<ReserveStatus | null> {
  const { data } = await supabase.rpc("reserve_fund_status", { p_community: cid });
  const r = (data as ReserveStatus[] | null)?.[0];
  if (!r) return null;
  return {
    ...r,
    balance_cents: Number(r.balance_cents),
    minimum_cents: Number(r.minimum_cents),
    base_budget_cents: Number(r.base_budget_cents),
    shortfall_cents: Number(r.shortfall_cents),
  };
}

export interface ReceiptView {
  id: string;
  code: string;
  concept: string;
  issue_date: string;
  due_date: string;
  amount_cents: number;
  paid_cents: number;
  status: "issued" | "cancelled";
  owner_id: string;
  property_id: string;
  budget_id: string | null;
  installment: number | null;
}

export function receiptState(r: Pick<ReceiptView, "amount_cents" | "paid_cents" | "status" | "due_date">, today: string) {
  if (r.status === "cancelled") return { label: "Anulado", variant: "muted" as const };
  const paid = Number(r.paid_cents);
  const amount = Number(r.amount_cents);
  if (paid >= amount) return { label: "Pagado", variant: "success" as const };
  if (r.due_date < today) return { label: paid > 0 ? "Pago parcial · vencido" : "Vencido", variant: "danger" as const };
  return { label: paid > 0 ? "Pago parcial" : "Pendiente", variant: "warning" as const };
}
