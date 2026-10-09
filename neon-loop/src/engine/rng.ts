/**
 * Generador pseudoaleatorio con semilla (mulberry32) y utilidades.
 * Determinista: la misma semilla produce siempre la misma secuencia, lo que
 * permite el reto diario reproducible y los tests estables.
 */

export type Rng = () => number;

/** Hash de cadena a entero de 32 bits sin signo (variante xmur3). */
export function hashString(input: string): number {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

export function createRng(seed: number | string): Rng {
  let a = (typeof seed === 'string' ? hashString(seed) : seed) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Entero uniforme en [0, n). */
export function randInt(rng: Rng, n: number): number {
  return Math.floor(rng() * n);
}

export function pickOne<T>(rng: Rng, items: readonly T[]): T {
  return items[randInt(rng, items.length)];
}
