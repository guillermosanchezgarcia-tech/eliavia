import { describe, expect, it } from "vitest";
import { formatEuros, parseEuros, pctOf, centsToInput } from "@/lib/money";
import { formatDate, addMonths } from "@/lib/dates";

const NBSP = " ";

describe("formato de importes", () => {
  it("usa punto de miles y coma decimal", () => {
    expect(formatEuros(123456)).toBe(`1.234,56${NBSP}€`);
    expect(formatEuros(5)).toBe(`0,05${NBSP}€`);
    expect(formatEuros(123456789012)).toBe(`1.234.567.890,12${NBSP}€`);
    expect(formatEuros(-150000)).toBe(`-1.500,00${NBSP}€`);
  });
  it("interpreta lo que escribe el usuario", () => {
    expect(parseEuros("1.234,56")).toBe(123456);
    expect(parseEuros("1234,5")).toBe(123450);
    expect(parseEuros("1234.56")).toBe(123456);
    expect(parseEuros("1.234")).toBe(123400);
    expect(parseEuros("1.234.567")).toBe(123456700);
    expect(parseEuros("12 €")).toBe(1200);
    expect(parseEuros("abc")).toBeNull();
    expect(parseEuros("1,234,5")).toBeNull();
    expect(parseEuros("12,345")).toBeNull();
    expect(centsToInput(123456)).toBe("1234,56");
  });
  it("calcula porcentajes con redondeo comercial", () => {
    expect(pctOf(18000, 21)).toBe(3780);
    expect(pctOf(18000, 15)).toBe(2700);
    expect(pctOf(333, 21)).toBe(70); // 69,93 → 70
  });
});

describe("fechas", () => {
  it("formatea en dd/mm/aaaa", () => {
    expect(formatDate("2026-03-05")).toBe("05/03/2026");
  });
  it("suma meses sin pasarse de fin de mes", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-11-15", 3)).toBe("2027-02-15");
  });
});
