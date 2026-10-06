/**
 * Cálculo de cuotas y recibos a partir de un presupuesto (ordinario) o una derrama (extraordinario).
 */
import { addMonths, monthLabel } from "./dates";
import { allocate, buildParticipants, splitInstallments, type AllocationMethod, type PropertyForAllocation } from "./reparto";

export interface BudgetForQuotas {
  id: string;
  name: string;
  kind: "ordinary" | "extraordinary";
  installments: number;
  interval_months: number;
  first_due_date: string;
}

export interface BudgetLineForQuotas {
  id: string;
  category_id: string;
  category_kind: "expense" | "income" | "reserve";
  allocation_key_id: string;
  amount_cents: number;
}

export interface KeyForQuotas {
  id: string;
  method: AllocationMethod;
  group_id: string | null;
}

export interface QuotaContext {
  properties: PropertyForAllocation[];
  keys: KeyForQuotas[];
  groupMembers: Map<string, Set<string>>; // group_id → ids de inmuebles
  customWeights: Map<string, Map<string, string | number>>; // key_id → (property_id → peso)
  incomeCategoryId: string; // "Cuotas ordinarias" o "Derramas"
}

export interface PlannedReceipt {
  budget_id: string;
  installment: number;
  property_id: string;
  concept: string;
  issue_date: string;
  due_date: string;
  lines: { category_id: string; amount_cents: number }[];
  amount_cents: number;
}

/** Reparto anual (total del presupuesto) por inmueble: property_id → céntimos */
export function annualQuotaByProperty(budget: BudgetForQuotas, lines: BudgetLineForQuotas[], ctx: QuotaContext): Map<string, number> {
  const totals = new Map<string, number>();
  for (const r of planReceipts(budget, lines, ctx)) {
    totals.set(r.property_id, (totals.get(r.property_id) ?? 0) + r.amount_cents);
  }
  return totals;
}

export function installmentDueDate(budget: BudgetForQuotas, installment: number): string {
  return addMonths(budget.first_due_date, (installment - 1) * budget.interval_months);
}

/**
 * Genera los recibos de los plazos indicados (por defecto, todos).
 * Cada partida se divide en plazos y cada plazo se reparte entre los inmuebles según su reparto.
 * Las partidas de gasto se cobran como "Cuotas ordinarias"/"Derramas" y la aportación al fondo de reserva aparte.
 */
export function planReceipts(
  budget: BudgetForQuotas,
  lines: BudgetLineForQuotas[],
  ctx: QuotaContext,
  onlyInstallments?: number[]
): PlannedReceipt[] {
  const keys = new Map(ctx.keys.map((k) => [k.id, k]));
  const n = budget.installments;
  const wanted = onlyInstallments ?? Array.from({ length: n }, (_, i) => i + 1);

  const participantsByKey = new Map<string, ReturnType<typeof buildParticipants>>();
  const participantsFor = (keyId: string) => {
    if (!participantsByKey.has(keyId)) {
      const key = keys.get(keyId);
      if (!key) throw new Error("Reparto no encontrado");
      participantsByKey.set(
        keyId,
        buildParticipants(key, ctx.properties, key.group_id ? ctx.groupMembers.get(key.group_id) ?? new Set() : null, ctx.customWeights.get(keyId))
      );
    }
    return participantsByKey.get(keyId)!;
  };

  const out: PlannedReceipt[] = [];
  for (const inst of wanted) {
    const due = installmentDueDate(budget, inst);
    // property → category → cents
    const acc = new Map<string, Map<string, number>>();
    for (const line of lines) {
      const instAmount = splitInstallments(line.amount_cents, n)[inst - 1];
      if (instAmount === 0) continue;
      const shares = allocate(instAmount, participantsFor(line.allocation_key_id));
      const categoryId = line.category_kind === "reserve" ? line.category_id : ctx.incomeCategoryId;
      for (const [propertyId, cents] of shares) {
        if (cents === 0) continue;
        const m = acc.get(propertyId) ?? new Map<string, number>();
        m.set(categoryId, (m.get(categoryId) ?? 0) + cents);
        acc.set(propertyId, m);
      }
    }
    for (const p of [...ctx.properties].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))) {
      const m = acc.get(p.id);
      if (!m) continue;
      const recLines = [...m.entries()].map(([category_id, amount_cents]) => ({ category_id, amount_cents }));
      out.push({
        budget_id: budget.id,
        installment: inst,
        property_id: p.id,
        concept: `${budget.name} · ${n > 1 ? `Cuota ${inst}/${n} · ` : ""}${monthLabel(due)} · ${p.code}`,
        issue_date: due,
        due_date: due,
        lines: recLines,
        amount_cents: recLines.reduce((a, l) => a + l.amount_cents, 0),
      });
    }
  }
  return out;
}

/** Mínimo del fondo de reserva: % del presupuesto ordinario (sin la propia aportación al fondo), redondeado al céntimo. */
export function reserveFundMinimum(budgetExpenseCents: number, pct: number | string): number {
  const p = BigInt(Math.round(Number(pct) * 100)); // 10 % → 1000
  const num = BigInt(budgetExpenseCents) * p;
  const q = num / 10000n;
  const r = num % 10000n;
  return Number(r * 2n >= 10000n ? q + 1n : q);
}

export interface ReserveFundCheck {
  minimumCents: number;
  balanceCents: number;
  belowMinimum: boolean;
  replenishmentCents: number; // reposición propuesta para el inicio del siguiente ejercicio
}

export function checkReserveFund(balanceCents: number, budgetExpenseCents: number, pct: number | string): ReserveFundCheck {
  const minimumCents = reserveFundMinimum(budgetExpenseCents, pct);
  return {
    minimumCents,
    balanceCents,
    belowMinimum: balanceCents < minimumCents,
    replenishmentCents: Math.max(0, minimumCents - balanceCents),
  };
}
