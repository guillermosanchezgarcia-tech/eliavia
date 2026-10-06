/**
 * Reparto de importes entre inmuebles (art. 5 y 9.1.e LPH).
 *
 * Reglas:
 *  - Se trabaja con céntimos enteros y pesos enteros (BigInt), sin decimales flotantes.
 *  - Cada inmueble recibe la parte entera (redondeo hacia abajo) de importe × peso / suma de pesos.
 *  - Los céntimos sobrantes del redondeo se asignan al inmueble de MAYOR coeficiente
 *    (en caso de empate, al primero según el orden de la lista).
 */

export type AllocationMethod = "coefficient" | "equal" | "custom";

export interface PropertyForAllocation {
  id: string;
  code: string;
  coefficient: string | number; // porcentaje, p. ej. "7.0000"
  tourist_use?: boolean;
  tourist_surcharge_pct?: string | number; // art. 17.12: incremento máximo 20 %
  sort_order?: number;
}

export interface AllocationKeyForAllocation {
  method: AllocationMethod;
  group_id?: string | null;
}

export interface Participant {
  id: string;
  weight: bigint; // peso entero
  coefficient: bigint; // coeficiente escalado (×10.000), para decidir quién se lleva el redondeo
}

/** "7.1234" → 71234n con scale=4. Admite números y cadenas, sin pasar por coma flotante. */
export function decimalToScaled(value: string | number, scale: number): bigint {
  const s = typeof value === "number" ? value.toFixed(scale) : String(value).trim().replace(",", ".");
  const m = /^(-?)(\d*)(?:\.(\d*))?$/.exec(s);
  if (!m) throw new Error(`Número no válido: ${value}`);
  const frac = (m[3] ?? "").padEnd(scale, "0");
  const roundUp = frac.length > scale && Number(frac[scale]) >= 5;
  let n = BigInt((m[2] || "0") + frac.slice(0, scale));
  if (roundUp) n += 1n;
  return m[1] === "-" ? -n : n;
}

/** Suma de coeficientes en céntimos de punto (×10.000) → 100 % = 1.000.000 */
export function coefficientsTotal(properties: { coefficient: string | number }[]): bigint {
  return properties.reduce((acc, p) => acc + decimalToScaled(p.coefficient, 4), 0n);
}

export function coefficientsSumTo100(properties: { coefficient: string | number }[]): boolean {
  return coefficientsTotal(properties) === 1_000_000n;
}

/**
 * Construye los participantes de un reparto.
 *  - coefficient: peso = coeficiente
 *  - equal: partes iguales
 *  - custom: pesos específicos de la partida (customWeights)
 * Si el reparto tiene grupo, solo participan los inmuebles del grupo.
 * Los inmuebles de uso turístico multiplican su peso por (1 + incremento %).
 */
export function buildParticipants(
  key: AllocationKeyForAllocation,
  properties: PropertyForAllocation[],
  groupMemberIds?: Set<string> | null,
  customWeights?: Map<string, string | number> | null
): Participant[] {
  const ordered = [...properties].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const result: Participant[] = [];
  for (const p of ordered) {
    if (key.group_id && groupMemberIds && !groupMemberIds.has(p.id)) continue;
    let base: bigint;
    if (key.method === "coefficient") base = decimalToScaled(p.coefficient, 4);
    else if (key.method === "equal") base = 10_000n;
    else base = decimalToScaled(customWeights?.get(p.id) ?? 0, 4);
    const surcharge = p.tourist_use ? decimalToScaled(p.tourist_surcharge_pct ?? 0, 2) : 0n; // 20 % → 2000
    const weight = base * (10_000n + surcharge);
    if (weight > 0n) result.push({ id: p.id, weight, coefficient: decimalToScaled(p.coefficient, 4) });
  }
  return result;
}

/** Reparte amountCents entre los participantes. Devuelve id → céntimos. La suma siempre cuadra exactamente. */
export function allocate(amountCents: number, participants: Participant[]): Map<string, number> {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) throw new Error("Importe no válido");
  const out = new Map<string, number>();
  if (amountCents === 0) {
    participants.forEach((p) => out.set(p.id, 0));
    return out;
  }
  const total = participants.reduce((a, p) => a + p.weight, 0n);
  if (participants.length === 0 || total === 0n) throw new Error("El reparto no tiene inmuebles con peso");

  const amount = BigInt(amountCents);
  let assigned = 0n;
  for (const p of participants) {
    const share = (amount * p.weight) / total;
    out.set(p.id, Number(share));
    assigned += share;
  }
  const leftover = amount - assigned;
  if (leftover > 0n) {
    let top = participants[0];
    for (const p of participants) if (p.coefficient > top.coefficient) top = p;
    out.set(top.id, out.get(top.id)! + Number(leftover));
  }
  return out;
}

/** Divide un importe en n plazos; el sobrante del redondeo va al primer plazo. */
export function splitInstallments(amountCents: number, n: number): number[] {
  const base = Math.floor(amountCents / n);
  const parts = Array.from({ length: n }, () => base);
  parts[0] += amountCents - base * n;
  return parts;
}
