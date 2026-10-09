import {
  Board,
  computePar,
  countCircuits,
  isClosed,
  isLocked,
  lockedFlags,
  looseEnds,
  neighborIndex,
  rotateCell,
} from '../board';
import { E, N, S, W, orientationCount, popCount, rotateMask, stepsBetween, tileKind } from '../tiles';

/** Construye un tablero a mano; `target` por defecto es el mismo estado. */
function board(cols: number, rows: number, cells: number[], target: number[] = cells): Board {
  return { cols, rows, cells, target };
}

describe('tiles', () => {
  test('rotateMask gira en sentido horario N→E→S→W→N', () => {
    expect(rotateMask(N)).toBe(E);
    expect(rotateMask(E)).toBe(S);
    expect(rotateMask(S)).toBe(W);
    expect(rotateMask(W)).toBe(N);
    expect(rotateMask(N | E)).toBe(E | S);
    expect(rotateMask(N, 4)).toBe(N);
    expect(rotateMask(N, 5)).toBe(E);
    expect(rotateMask(N, -1)).toBe(W);
  });

  test('cuatro giros devuelven siempre la pieza original', () => {
    for (let m = 0; m < 16; m++) expect(rotateMask(m, 4)).toBe(m);
  });

  test('tileKind clasifica las 16 máscaras', () => {
    expect(tileKind(0)).toBe('empty');
    expect(tileKind(N)).toBe('cap');
    expect(tileKind(N | S)).toBe('line');
    expect(tileKind(E | W)).toBe('line');
    expect(tileKind(N | E)).toBe('corner');
    expect(tileKind(S | W)).toBe('corner');
    expect(tileKind(N | E | S)).toBe('tee');
    expect(tileKind(15)).toBe('cross');
  });

  test('orientationCount: vacía y cruz 1, recta 2, resto 4', () => {
    expect(orientationCount(0)).toBe(1);
    expect(orientationCount(15)).toBe(1);
    expect(orientationCount(N | S)).toBe(2);
    expect(orientationCount(N | E)).toBe(4);
    expect(orientationCount(N | E | S)).toBe(4);
    expect(orientationCount(N)).toBe(4);
  });

  test('stepsBetween da los giros horarios mínimos o null', () => {
    expect(stepsBetween(N | E, N | E)).toBe(0);
    expect(stepsBetween(N | E, E | S)).toBe(1);
    expect(stepsBetween(N | E, W | N)).toBe(3);
    expect(stepsBetween(N | S, E | W)).toBe(1);
    expect(stepsBetween(E | W, N | S)).toBe(1);
    expect(stepsBetween(N | E, N | S)).toBeNull();
    expect(popCount(15)).toBe(4);
  });
});

describe('reglas del tablero', () => {
  // Anillo 2x2 de cuatro esquinas: la disposición cerrada más pequeña.
  const ringTarget = [E | S, S | W, N | E, N | W];

  test('el anillo resuelto está cerrado y todas sus piezas encendidas', () => {
    const b = board(2, 2, ringTarget);
    expect(lockedFlags(b)).toEqual([true, true, true, true]);
    expect(isClosed(b)).toBe(true);
    expect(countCircuits(b)).toBe(1);
  });

  test('un extremo que apunta al borde deja la pieza apagada', () => {
    const b = board(2, 2, [N | E, S | W, N | E, N | W], ringTarget);
    expect(isLocked(b, 0)).toBe(false);
    expect(isClosed(b)).toBe(false);
  });

  test('un extremo que apunta a una pieza sin extremo enfrentado deja apagada a la que lo tiene', () => {
    // La pieza 0 mira al este, pero la 1 es una recta vertical (no tiene lado W).
    const b = board(2, 2, [E | S, N | S, N | E, N | W], ringTarget);
    expect(isLocked(b, 0)).toBe(false);
    expect(isLocked(b, 1)).toBe(false); // además su lado N da al borde
  });

  test('una pieza solo se enciende cuando TODOS sus extremos encajan', () => {
    // La 0 encaja al este (con la 1) y al sur (con la 2).
    const ok = board(2, 2, [E | S, S | W, N | E, N | W], ringTarget);
    expect(isLocked(ok, 0)).toBe(true);
    // Si la 2 pierde su lado N, la 0 se apaga aunque su lado E siga encajando.
    const broken = board(2, 2, [E | S, S | W, E | S, N | W], ringTarget);
    expect(isLocked(broken, 0)).toBe(false);
  });

  test('girar una pieza no modifica el tablero original (inmutabilidad)', () => {
    const b = board(2, 2, [N | E, S | W, N | E, N | W], ringTarget);
    const snapshot = [...b.cells];
    const r = rotateCell(b, 0);
    expect(b.cells).toEqual(snapshot);
    expect(r).not.toBe(b);
    expect(r.cells[0]).toBe(E | S);
    expect(r.cells).not.toBe(b.cells);
  });

  test('resolver el anillo girando enciende y cierra el tablero', () => {
    // Desordenado: cada esquina girada una vez de más.
    let b = board(2, 2, ringTarget.map((m) => rotateMask(m, 1)), ringTarget);
    expect(isClosed(b)).toBe(false);
    expect(computePar(b)).toBe(4 * 3);
    for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) b = rotateCell(b, i);
    expect(isClosed(b)).toBe(true);
  });

  test('las piezas no girables (cruz, vacía) no cambian', () => {
    const b = board(2, 2, [15, 0, N, N]);
    expect(rotateCell(b, 0)).toBe(b);
    expect(rotateCell(b, 1)).toBe(b);
    expect(rotateCell(b, 99)).toBe(b);
    expect(rotateCell(b, -1)).toBe(b);
  });

  test('una recta se considera igual tras dos giros', () => {
    expect(computePar(board(1, 1, [E | W], [N | S]))).toBe(1);
    expect(computePar(board(1, 1, [N | S], [N | S]))).toBe(0);
  });

  test('las casillas vacías no cuentan para cerrar; un tablero sin piezas no está cerrado', () => {
    expect(isClosed(board(2, 2, ringTarget))).toBe(true);
    expect(isClosed(board(2, 2, [0, 0, 0, 0]))).toBe(false);
    expect(isClosed(board(3, 2, [E | S, S | W, 0, N | E, N | W, 0]))).toBe(true);
  });

  test('countCircuits cuenta circuitos separados', () => {
    // Dos anillos 2x2 lado a lado (4 columnas, 2 filas).
    const cells = [E | S, S | W, E | S, S | W, N | E, N | W, N | E, N | W];
    const b = board(4, 2, cells);
    expect(isClosed(b)).toBe(true);
    expect(countCircuits(b)).toBe(2);
  });

  test('looseEnds devuelve exactamente los lados sueltos', () => {
    const ring = board(2, 2, [E | S, S | W, N | E, N | W], ringTarget);
    for (let i = 0; i < 4; i++) expect(looseEnds(ring, i)).toBe(0);
    // Pieza 0 girada: apunta al norte (borde) y al este (encaja con la 1).
    const bad = board(2, 2, [N | E, S | W, N | E, N | W], ringTarget);
    expect(looseEnds(bad, 0)).toBe(N); // solo el norte está suelto
    // La pieza 2 (N|E) mira al norte hacia la 0, que ya no tiene lado S: se suelta también.
    expect(looseEnds(bad, 2)).toBe(N);
    // La pieza 1 (S|W) sigue encajando con la 0 (conserva su lado E) y con la 3.
    expect(looseEnds(bad, 1)).toBe(0);
  });

  test('neighborIndex respeta los bordes', () => {
    const b = board(3, 2, new Array(6).fill(0));
    expect(neighborIndex(b, 0, 0)).toBe(-1); // N de la esquina
    expect(neighborIndex(b, 0, 3)).toBe(-1); // W
    expect(neighborIndex(b, 0, 1)).toBe(1); // E
    expect(neighborIndex(b, 0, 2)).toBe(3); // S
    expect(neighborIndex(b, 5, 1)).toBe(-1);
    expect(neighborIndex(b, 5, 2)).toBe(-1);
  });
});
