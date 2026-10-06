import { describe, expect, it } from "vitest";
import { allocate, buildParticipants, coefficientsSumTo100, decimalToScaled, splitInstallments, type PropertyForAllocation } from "@/lib/reparto";

const props: PropertyForAllocation[] = [
  { id: "a", code: "1ºA", coefficient: "50.0000", sort_order: 1 },
  { id: "b", code: "1ºB", coefficient: "30.0000", sort_order: 2 },
  { id: "c", code: "Garaje 1", coefficient: "20.0000", sort_order: 3 },
];

const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);

describe("reparto por coeficientes", () => {
  it("reparte proporcionalmente al coeficiente", () => {
    const r = allocate(100000, buildParticipants({ method: "coefficient" }, props));
    expect(r.get("a")).toBe(50000);
    expect(r.get("b")).toBe(30000);
    expect(r.get("c")).toBe(20000);
  });

  it("el sobrante del redondeo va al inmueble de mayor coeficiente y la suma cuadra", () => {
    const three = [
      { id: "x", code: "x", coefficient: "33.3333", sort_order: 1 },
      { id: "y", code: "y", coefficient: "33.3334", sort_order: 2 },
      { id: "z", code: "z", coefficient: "33.3333", sort_order: 3 },
    ];
    const r = allocate(100, buildParticipants({ method: "coefficient" }, three));
    expect(sum(r)).toBe(100);
    expect(r.get("y")).toBe(34);
    expect(r.get("x")).toBe(33);
    expect(r.get("z")).toBe(33);
  });

  it("cuadra siempre al céntimo con importes y coeficientes arbitrarios", () => {
    const many: PropertyForAllocation[] = Array.from({ length: 22 }, (_, i) => ({
      id: String(i), code: String(i), coefficient: (i < 2 ? "4.5455" : "4.5454"), sort_order: i,
    }));
    for (const amount of [1, 7, 99, 12345, 999999, 1655999]) {
      const r = allocate(amount, buildParticipants({ method: "coefficient" }, many));
      expect(sum(r)).toBe(amount);
    }
  });

  it("partes iguales", () => {
    const r = allocate(1000, buildParticipants({ method: "equal" }, props));
    expect([...r.values()].sort()).toEqual([333, 333, 334]);
    expect(r.get("a")).toBe(334); // mayor coeficiente se lleva el céntimo
  });

  it("solo los inmuebles del grupo (p. ej. solo garajes)", () => {
    const r = allocate(5000, buildParticipants({ method: "coefficient", group_id: "g" }, props, new Set(["b", "c"])));
    expect(r.has("a")).toBe(false);
    expect(r.get("b")).toBe(3000);
    expect(r.get("c")).toBe(2000);
  });

  it("coeficientes específicos por partida", () => {
    const w = new Map<string, string>([["a", "1"], ["b", "3"]]);
    const r = allocate(400, buildParticipants({ method: "custom" }, props, null, w));
    expect(r.get("a")).toBe(100);
    expect(r.get("b")).toBe(300);
    expect(r.has("c")).toBe(false);
  });

  it("incremento de cuota por uso turístico (art. 17.12, máx. 20 %)", () => {
    const tourist = props.map((p) => (p.id === "b" ? { ...p, tourist_use: true, tourist_surcharge_pct: "20" } : p));
    const r = allocate(100000, buildParticipants({ method: "coefficient" }, tourist));
    expect(sum(r)).toBe(100000);
    // pesos 50 / 36 / 20 → 1ºB paga un 20 % más que con su coeficiente puro en proporción
    expect(r.get("b")).toBe(Math.floor((100000 * 36) / 106));
  });

  it("valida que los coeficientes suman 100 %", () => {
    expect(coefficientsSumTo100(props)).toBe(true);
    expect(coefficientsSumTo100(props.slice(0, 2))).toBe(false);
    expect(decimalToScaled("7,5", 4)).toBe(75000n);
  });

  it("divide en plazos con el sobrante en el primero", () => {
    expect(splitInstallments(1000, 3)).toEqual([334, 333, 333]);
    expect(splitInstallments(1000, 3).reduce((a, b) => a + b)).toBe(1000);
  });
});
