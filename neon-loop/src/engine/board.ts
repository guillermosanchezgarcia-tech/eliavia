import { DC, DR, orientationCount, rotateMask, stepsBetween } from './tiles';

/**
 * Tablero inmutable. `cells` es el estado actual de cada pieza (máscaras) y
 * `target` la disposición con la que el generador construyó el tablero
 * (siempre cerrada). El jugador puede cerrar el tablero con cualquier
 * disposición válida, no solo con `target`; `target` sirve para calcular el
 * "par" (giros de referencia).
 */
export interface Board {
  readonly cols: number;
  readonly rows: number;
  readonly cells: readonly number[];
  readonly target: readonly number[];
}

export function neighborIndex(board: Pick<Board, 'cols' | 'rows'>, index: number, dir: number): number {
  const r = Math.floor(index / board.cols) + DR[dir];
  const c = (index % board.cols) + DC[dir];
  if (r < 0 || r >= board.rows || c < 0 || c >= board.cols) return -1;
  return r * board.cols + c;
}

/**
 * Máscara de los extremos sueltos de una pieza: los lados con luz que apuntan al borde o a una
 * pieza vecina sin extremo enfrentado. Una pieza con luz está encendida cuando no tiene ninguno.
 * Las casillas vacías no tienen extremos.
 */
export function looseEnds(board: Board, index: number): number {
  const mask = board.cells[index];
  let loose = 0;
  for (let d = 0; d < 4; d++) {
    if ((mask & (1 << d)) === 0) continue;
    const n = neighborIndex(board, index, d);
    if (n < 0 || (board.cells[n] & (1 << ((d + 2) % 4))) === 0) loose |= 1 << d;
  }
  return loose;
}

/**
 * Una pieza está encendida si no tiene extremos sueltos: cada lado con luz apunta a una pieza
 * vecina que tiene luz en el lado contrario. Las casillas vacías no están encendidas ni cuentan
 * para cerrar el tablero.
 */
export function isLocked(board: Board, index: number): boolean {
  return board.cells[index] !== 0 && looseEnds(board, index) === 0;
}

export function lockedFlags(board: Board): boolean[] {
  const flags: boolean[] = new Array(board.cells.length);
  for (let i = 0; i < flags.length; i++) flags[i] = isLocked(board, i);
  return flags;
}

export function activeCount(board: Board): number {
  let n = 0;
  for (const m of board.cells) if (m !== 0) n++;
  return n;
}

/** Número de piezas que tiene sentido girar (excluye vacías y cruces). */
export function rotatableCount(board: Board): number {
  let n = 0;
  for (const m of board.cells) if (orientationCount(m) > 1) n++;
  return n;
}

export function isClosed(board: Board): boolean {
  let active = 0;
  for (let i = 0; i < board.cells.length; i++) {
    if (board.cells[i] === 0) continue;
    active++;
    if (!isLocked(board, i)) return false;
  }
  return active > 0;
}

/** Devuelve un tablero nuevo con la pieza girada, o el mismo si no se puede girar. */
export function rotateCell(board: Board, index: number): Board {
  if (index < 0 || index >= board.cells.length) return board;
  if (orientationCount(board.cells[index]) <= 1) return board;
  const cells = board.cells.slice();
  cells[index] = rotateMask(cells[index], 1);
  return { cols: board.cols, rows: board.rows, cells, target: board.target };
}

/** Giros mínimos hacia `target`: referencia ("par") para medir la eficiencia. */
export function computePar(board: Board): number {
  let par = 0;
  for (let i = 0; i < board.cells.length; i++) {
    const steps = stepsBetween(board.cells[i], board.target[i]);
    if (steps === null) {
      throw new Error(`Tablero inconsistente en la casilla ${i}: no es una rotación del objetivo`);
    }
    par += steps;
  }
  return par;
}

/** Número de circuitos independientes (componentes conectadas por extremos que encajan). */
export function countCircuits(board: Board): number {
  const parent = board.cells.map((_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  for (let i = 0; i < board.cells.length; i++) {
    if (board.cells[i] === 0) continue;
    for (const d of [1, 2]) {
      // Solo E y S: cada arista se visita una vez.
      if ((board.cells[i] & (1 << d)) === 0) continue;
      const n = neighborIndex(board, i, d);
      if (n < 0) continue;
      if ((board.cells[n] & (1 << ((d + 2) % 4))) === 0) continue;
      parent[find(i)] = find(n);
    }
  }
  const roots = new Set<number>();
  for (let i = 0; i < board.cells.length; i++) {
    if (board.cells[i] !== 0) roots.add(find(i));
  }
  return roots.size;
}
