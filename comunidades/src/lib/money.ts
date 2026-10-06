/**
 * Importes: SIEMPRE en céntimos (enteros). Nunca se usan decimales flotantes para dinero.
 */

const NBSP = " ";

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** 123456 → "1.234,56 €" */
export function formatEuros(cents: number | bigint | string | null | undefined, opts: { symbol?: boolean } = {}): string {
  const symbol = opts.symbol ?? true;
  let value = BigInt(cents ?? 0);
  const negative = value < 0n;
  if (negative) value = -value;
  const euros = value / 100n;
  const rest = (value % 100n).toString().padStart(2, "0");
  const text = `${negative ? "-" : ""}${groupThousands(euros.toString())},${rest}`;
  return symbol ? `${text}${NBSP}€` : text;
}

/**
 * Convierte lo que escribe el usuario en céntimos.
 * Acepta "1.234,56", "1234,56", "1234.56", "1234", "12,5", "1.234 €".
 * Devuelve null si no es un importe válido.
 */
export function parseEuros(input: string | null | undefined): number | null {
  if (input == null) return null;
  let s = String(input).replace(/[\s €]/g, "");
  if (!s) return null;
  let negative = false;
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  }
  let intPart: string;
  let decPart = "";
  if (s.includes(",")) {
    const parts = s.split(",");
    if (parts.length !== 2) return null;
    intPart = parts[0].replace(/\./g, "");
    if (parts[0].includes(".") && !/^\d{1,3}(\.\d{3})+$/.test(parts[0])) return null;
    decPart = parts[1];
  } else if (/^\d+\.\d{1,2}$/.test(s)) {
    [intPart, decPart] = s.split(".");
  } else {
    if (s.includes(".") && !/^\d{1,3}(\.\d{3})+$/.test(s)) return null;
    intPart = s.replace(/\./g, "");
  }
  if (!/^\d*$/.test(intPart) || !/^\d{0,2}$/.test(decPart)) return null;
  if (!intPart && !decPart) return null;
  const cents = Number(intPart || "0") * 100 + Number(decPart.padEnd(2, "0") || "0");
  if (!Number.isSafeInteger(cents)) return null;
  return negative ? -cents : cents;
}

/** Céntimos → texto para un campo de formulario: 123456 → "1234,56" */
export function centsToInput(cents: number | null | undefined): string {
  if (cents == null) return "";
  return formatEuros(cents, { symbol: false }).replace(/\./g, "");
}

/** Porcentaje en formato español: "7.5" → "7,50 %" */
export function formatPct(value: number | string | null | undefined, decimals = 2): string {
  const n = Number(value ?? 0);
  return `${n.toLocaleString("es-ES", { minimumFractionDigits: decimals, maximumFractionDigits: Math.max(decimals, 4) })}${NBSP}%`;
}

/** Aplica un porcentaje (con hasta 2 decimales) a un importe en céntimos, con redondeo comercial. */
export function pctOf(cents: number, pct: number | string): number {
  const p = Math.round(Number(pct) * 100); // 21,00 % → 2100
  const num = BigInt(cents) * BigInt(p);
  const den = 10000n;
  const q = num / den;
  const r = num % den;
  return Number(r * 2n >= den ? q + 1n : q);
}
