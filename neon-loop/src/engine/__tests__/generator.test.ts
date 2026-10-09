import { Board, activeCount, computePar, isClosed, lockedFlags, rotatableCount } from '../board';
import { DIFFICULTIES, DIFFICULTY_IDS } from '../difficulty';
import { StageSpec as StageSpecLike, generateBoard } from '../generator';
import { createRng } from '../rng';
import { popCount, rotateMask, stepsBetween } from '../tiles';

describe('rng', () => {
  test('misma semilla, misma secuencia; semillas distintas, secuencias distintas', () => {
    const a = createRng('2026-10-09');
    const b = createRng('2026-10-09');
    const c = createRng('2026-10-10');
    const sa = Array.from({ length: 8 }, () => a());
    const sb = Array.from({ length: 8 }, () => b());
    const sc = Array.from({ length: 8 }, () => c());
    expect(sa).toEqual(sb);
    expect(sa).not.toEqual(sc);
    for (const x of sa) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe('generateBoard', () => {
  const specs: StageSpecLike[] = [];
  for (const id of DIFFICULTY_IDS) for (const spec of DIFFICULTIES[id].ladder) specs.push(spec);

  function check(board: Board, spec: StageSpecLike) {
    expect(board.cols).toBe(spec.cols);
    expect(board.rows).toBe(spec.rows);
    expect(board.cells).toHaveLength(spec.cols * spec.rows);
    expect(board.target).toHaveLength(spec.cols * spec.rows);

    // El objetivo es una disposición cerrada: el tablero SIEMPRE tiene solución.
    const solved: Board = { ...board, cells: board.target };
    expect(isClosed(solved)).toBe(true);
    expect(lockedFlags(solved).filter(Boolean).length).toBe(activeCount(solved));

    // Cada pieza actual es una rotación de la del objetivo.
    board.cells.forEach((m, i) => expect(stepsBetween(m, board.target[i])).not.toBeNull());

    // Nunca nace resuelto y el par no es trivial.
    expect(isClosed(board)).toBe(false);
    const par = computePar(board);
    expect(par).toBeGreaterThanOrEqual(Math.max(2, Math.ceil(rotatableCount(board) * 0.5)));

    // Sin piezas con extremos sueltos en la solución: nada de terminales (grado 1).
    for (const m of board.target) expect([0, 2, 3, 4]).toContain(popCount(m));
  }

  test('invariantes en 400 semillas por cada escalón de cada dificultad', () => {
    for (const spec of specs) {
      for (let seed = 0; seed < 400; seed++) {
        check(generateBoard(createRng(`t${seed}`), spec), spec);
      }
    }
  });

  test('es determinista respecto a la semilla', () => {
    for (const spec of specs) {
      const a = generateBoard(createRng('daily-2026-10-09#3'), spec);
      const b = generateBoard(createRng('daily-2026-10-09#3'), spec);
      expect(a).toEqual(b);
    }
  });

  test('hay variedad: semillas distintas dan tableros distintos', () => {
    const spec = DIFFICULTIES.normal.ladder[2];
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) seen.add(generateBoard(createRng(`v${i}`), spec).cells.join(','));
    expect(seen.size).toBeGreaterThan(40);
  });

  test('la densidad de piezas es razonable (≥ 45% de casillas con luz) y casi siempre cerca de lo pedido', () => {
    for (const spec of specs) {
      let sum = 0;
      for (let seed = 0; seed < 200; seed++) {
        const b = generateBoard(createRng(`d${seed}`), spec);
        sum += activeCount(b) / (spec.cols * spec.rows);
      }
      expect(sum / 200).toBeGreaterThan(0.45);
    }
  });

  test('las dificultades altas generan T y cruces (puentes)', () => {
    const spec = DIFFICULTIES.expert.ladder[3];
    let tees = 0;
    for (let seed = 0; seed < 100; seed++) {
      const b = generateBoard(createRng(`p${seed}`), spec);
      tees += b.target.filter((m) => [7, 11, 13, 14, 15].includes(m)).length;
    }
    expect(tees).toBeGreaterThan(50);
  });

  test('girar cada pieza los pasos que indica el objetivo resuelve el tablero', () => {
    for (let seed = 0; seed < 100; seed++) {
      const b = generateBoard(createRng(`s${seed}`), DIFFICULTIES.normal.ladder[3]);
      const solved = b.cells.map((m, i) => rotateMask(m, stepsBetween(m, b.target[i]) as number));
      expect(isClosed({ ...b, cells: solved })).toBe(true);
    }
  });
});
