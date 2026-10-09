import { Board, computePar, isClosed, rotatableCount } from './board';
import { Rng, randInt } from './rng';
import { E, N, S, W, orientationCount, popCount, rotateMask } from './tiles';

/** Parámetros de un tablero. `fill` es la fracción mínima de casillas con luz que se busca. */
export interface StageSpec {
  cols: number;
  rows: number;
  fill: number;
  /** Conexiones extra entre piezas vecinas (crean T y cruces). */
  bridges: number;
}

const MAX_ATTEMPTS = 24;

/**
 * Construye una disposición CERRADA: la frontera de un conjunto de "caras"
 * (cuadrados formados por 4 casillas vecinas). La frontera de cualquier
 * conjunto de caras es una unión de ciclos, así que ninguna pieza tiene un
 * extremo suelto y todos los tableros tienen solución por construcción.
 */
function buildTarget(rng: Rng, spec: StageSpec): number[] {
  const { cols, rows } = spec;
  const fcols = cols - 1;
  const frows = rows - 1;
  const total = cols * rows;

  // h[r][c] une (r,c)-(r,c+1); v[r][c] une (r,c)-(r+1,c).
  const h: boolean[][] = Array.from({ length: rows }, () => new Array<boolean>(cols - 1).fill(false));
  const v: boolean[][] = Array.from({ length: rows - 1 }, () => new Array<boolean>(cols).fill(false));
  const chosen: boolean[] = new Array(fcols * frows).fill(false);
  let chosenCount = 0;

  const masks = (): number[] => {
    const out: number[] = new Array(total).fill(0);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let m = 0;
        if (r > 0 && v[r - 1][c]) m |= N;
        if (c < cols - 1 && h[r][c]) m |= E;
        if (r < rows - 1 && v[r][c]) m |= S;
        if (c > 0 && h[r][c - 1]) m |= W;
        out[r * cols + c] = m;
      }
    }
    return out;
  };

  const toggleFace = (fr: number, fc: number) => {
    h[fr][fc] = !h[fr][fc];
    h[fr + 1][fc] = !h[fr + 1][fc];
    v[fr][fc] = !v[fr][fc];
    v[fr][fc + 1] = !v[fr][fc + 1];
    chosen[fr * fcols + fc] = true;
    chosenCount++;
  };

  const wanted = Math.ceil(spec.fill * total);
  let current = masks();
  while (activeOf(current) < wanted && chosenCount < chosen.length) {
    const frontier: number[] = [];
    const anyFree: number[] = [];
    for (let f = 0; f < chosen.length; f++) {
      if (chosen[f]) continue;
      anyFree.push(f);
      const fr = Math.floor(f / fcols);
      const fc = f % fcols;
      if (
        (fr > 0 && chosen[(fr - 1) * fcols + fc]) ||
        (fr < frows - 1 && chosen[(fr + 1) * fcols + fc]) ||
        (fc > 0 && chosen[fr * fcols + fc - 1]) ||
        (fc < fcols - 1 && chosen[fr * fcols + fc + 1])
      ) {
        frontier.push(f);
      }
    }
    const pool = frontier.length > 0 && rng() > 0.2 ? frontier : anyFree;
    const face = pool[randInt(rng, pool.length)];
    toggleFace(Math.floor(face / fcols), face % fcols);
    current = masks();
  }

  // Puentes: conexiones entre casillas vecinas ya activas (generan T y cruces).
  for (let b = 0; b < spec.bridges; b++) {
    const m = masks();
    const options: { horizontal: boolean; r: number; c: number }[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (m[i] === 0 || popCount(m[i]) >= 4) continue;
        if (c < cols - 1 && !h[r][c] && m[i + 1] !== 0 && popCount(m[i + 1]) < 4) {
          options.push({ horizontal: true, r, c });
        }
        if (r < rows - 1 && !v[r][c] && m[i + cols] !== 0 && popCount(m[i + cols]) < 4) {
          options.push({ horizontal: false, r, c });
        }
      }
    }
    if (options.length === 0) break;
    const pick = options[randInt(rng, options.length)];
    if (pick.horizontal) h[pick.r][pick.c] = true;
    else v[pick.r][pick.c] = true;
  }

  return masks();
}

/** Gira cada pieza a una orientación aleatoria (uniforme entre sus orientaciones distintas). */
function scramble(rng: Rng, target: readonly number[]): number[] {
  return target.map((m) => {
    const orientations = orientationCount(m);
    return orientations > 1 ? rotateMask(m, randInt(rng, orientations)) : m;
  });
}

/**
 * Genera un tablero resoluble y mezclado. Es determinista respecto a `rng`.
 * Garantías (verificadas por tests): `target` está cerrado, `cells` es una
 * rotación de `target` en cada casilla, `cells` no está cerrado y el par es
 * al menos la mitad del número de piezas girables.
 */
export function generateBoard(rng: Rng, spec: StageSpec): Board {
  const total = spec.cols * spec.rows;
  const minActive = Math.min(total, Math.max(4, Math.ceil(spec.fill * total * 0.85)));

  let bestTarget: number[] | null = null;
  let bestActive = -1;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = buildTarget(rng, spec);
    const active = activeOf(candidate);
    if (active > bestActive) {
      bestActive = active;
      bestTarget = candidate;
    }
    if (active >= minActive) break;
  }
  const target = bestTarget as number[];
  const base: Board = { cols: spec.cols, rows: spec.rows, cells: target, target };
  const minPar = Math.max(2, Math.ceil(rotatableCount(base) * 0.5));

  for (let attempt = 0; attempt < 60; attempt++) {
    const cells = scramble(rng, target);
    const board: Board = { cols: spec.cols, rows: spec.rows, cells, target };
    if (!isClosed(board) && computePar(board) >= minPar) return board;
  }

  // Salvaguarda determinista: gira todas las piezas girables al menos una vez.
  const forced = target.map((m) => {
    const orientations = orientationCount(m);
    return orientations > 1 ? rotateMask(m, 1 + randInt(rng, orientations - 1)) : m;
  });
  return { cols: spec.cols, rows: spec.rows, cells: forced, target };
}

function activeOf(masks: readonly number[]): number {
  let n = 0;
  for (const m of masks) if (m !== 0) n++;
  return n;
}
