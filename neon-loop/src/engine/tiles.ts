/**
 * Piezas de neón. Cada pieza es una máscara de 4 bits con los lados que
 * tienen un extremo de luz: N=1, E=2, S=4, W=8. Girar 90° en sentido horario
 * desplaza cada bit una posición (N→E→S→W→N).
 */

export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;

/** Desplazamiento de fila/columna por índice de dirección 0..3 (N,E,S,W). */
export const DR = [-1, 0, 1, 0] as const;
export const DC = [0, 1, 0, -1] as const;

export type TileKind = 'empty' | 'cap' | 'line' | 'corner' | 'tee' | 'cross';

export function rotateMask(mask: number, steps = 1): number {
  const k = ((steps % 4) + 4) % 4;
  let m = mask & 15;
  for (let i = 0; i < k; i++) {
    m = ((m << 1) | (m >> 3)) & 15;
  }
  return m;
}

export function popCount(mask: number): number {
  let n = 0;
  for (let m = mask & 15; m; m >>= 1) n += m & 1;
  return n;
}

export function tileKind(mask: number): TileKind {
  switch (popCount(mask)) {
    case 0:
      return 'empty';
    case 1:
      return 'cap';
    case 2:
      return mask === (N | S) || mask === (E | W) ? 'line' : 'corner';
    case 3:
      return 'tee';
    default:
      return 'cross';
  }
}

/** Cuántas orientaciones distintas tiene la pieza (1 = no tiene sentido girarla). */
export function orientationCount(mask: number): 1 | 2 | 4 {
  const kind = tileKind(mask);
  if (kind === 'empty' || kind === 'cross') return 1;
  if (kind === 'line') return 2;
  return 4;
}

/** Giros horarios mínimos (0..3) para pasar de `from` a `to`, o null si no son la misma pieza. */
export function stepsBetween(from: number, to: number): number | null {
  for (let k = 0; k < 4; k++) {
    if (rotateMask(from, k) === (to & 15)) return k;
  }
  return null;
}
