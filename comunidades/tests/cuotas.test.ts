import { describe, expect, it } from "vitest";
import { annualQuotaByProperty, checkReserveFund, planReceipts, reserveFundMinimum, type QuotaContext } from "@/lib/cuotas";

const ctx: QuotaContext = {
  properties: [
    { id: "a", code: "1ºA", coefficient: "60", sort_order: 1 },
    { id: "g", code: "Garaje 1", coefficient: "40", sort_order: 2 },
  ],
  keys: [
    { id: "general", method: "coefficient", group_id: null },
    { id: "garajes", method: "coefficient", group_id: "grp-garajes" },
  ],
  groupMembers: new Map([["grp-garajes", new Set(["g"])]]),
  customWeights: new Map(),
  incomeCategoryId: "cuotas",
};

const budget = { id: "b1", name: "Presupuesto 2026", kind: "ordinary" as const, installments: 4, interval_months: 3, first_due_date: "2026-01-05" };

describe("cuotas a partir del presupuesto", () => {
  const lines = [
    { id: "l1", category_id: "limpieza", category_kind: "expense" as const, allocation_key_id: "general", amount_cents: 100001 },
    { id: "l2", category_id: "puerta", category_kind: "expense" as const, allocation_key_id: "garajes", amount_cents: 40000 },
    { id: "l3", category_id: "fondo", category_kind: "reserve" as const, allocation_key_id: "general", amount_cents: 10000 },
  ];

  it("los recibos suman exactamente el presupuesto", () => {
    const receipts = planReceipts(budget, lines, ctx);
    expect(receipts).toHaveLength(8);
    const total = receipts.reduce((a, r) => a + r.amount_cents, 0);
    expect(total).toBe(150001);
    const annual = annualQuotaByProperty(budget, lines, ctx);
    expect(annual.get("g")).toBe(40000 + 40000 + 4000); // 40 % general + todo garajes + 40 % fondo
  });

  it("separa la aportación al fondo de reserva y fija los vencimientos", () => {
    const receipts = planReceipts(budget, lines, ctx, [2]);
    expect(receipts.map((r) => r.due_date)).toEqual(["2026-04-05", "2026-04-05"]);
    const a = receipts.find((r) => r.property_id === "a")!;
    expect(a.lines.find((l) => l.category_id === "fondo")!.amount_cents).toBe(1500);
    expect(a.lines.find((l) => l.category_id === "cuotas")!.amount_cents).toBe(15000);
  });
});

describe("fondo de reserva", () => {
  it("mínimo = 10 % del presupuesto ordinario", () => {
    expect(reserveFundMinimum(1656000, 10)).toBe(165600);
    expect(reserveFundMinimum(1656000, 5)).toBe(82800); // Cataluña
    expect(reserveFundMinimum(999, 10)).toBe(100);
  });
  it("avisa si baja del mínimo y propone la reposición", () => {
    const c = checkReserveFund(140000, 1656000, 10);
    expect(c.belowMinimum).toBe(true);
    expect(c.replenishmentCents).toBe(25600);
    expect(checkReserveFund(200000, 1656000, 10).belowMinimum).toBe(false);
  });
});
