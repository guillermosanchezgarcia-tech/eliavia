import { Board, computePar, isClosed } from '../board';
import { DIFFICULTIES } from '../difficulty';
import { COMBO_WINDOW_MS } from '../scoring';
import { GameRun, MAX_TICK_MS, RunEvent, TRANSITION_MS } from '../run';
import { orientationCount, stepsBetween } from '../tiles';

/** Índices a tocar, con repeticiones, para llevar el tablero actual a su objetivo. */
function solutionTaps(board: Board): number[] {
  const taps: number[] = [];
  board.cells.forEach((m, i) => {
    const steps = stepsBetween(m, board.target[i]) as number;
    for (let k = 0; k < steps; k++) taps.push(i);
  });
  return taps;
}

/** Resuelve el tablero actual del run por el camino del objetivo; devuelve todos los eventos. */
function solveBoard(run: GameRun): RunEvent[] {
  const events: RunEvent[] = [];
  for (const i of solutionTaps(run.snapshot().board)) events.push(...run.tap(i));
  return events;
}

function finishTransition(run: GameRun): RunEvent[] {
  const events: RunEvent[] = [];
  for (let t = 0; t <= TRANSITION_MS && run.currentStatus === 'transition'; t += 50) events.push(...run.tick(50));
  return events;
}

const newRun = (seed = 'test', difficulty: 'easy' | 'normal' | 'expert' = 'normal') =>
  new GameRun({ difficulty, seed });

describe('estado inicial', () => {
  test('empieza lista, con el tiempo de la dificultad y sin puntos', () => {
    const run = newRun();
    const s = run.snapshot();
    expect(s.status).toBe('ready');
    expect(s.timeLeftMs).toBe(DIFFICULTIES.normal.startMs);
    expect(s.score).toBe(0);
    expect(s.boardNumber).toBe(1);
    expect(isClosed(s.board)).toBe(false);
    expect(s.par).toBe(computePar(s.board));
  });

  test('el tiempo NO corre hasta el primer toque', () => {
    const run = newRun();
    run.tick(400);
    run.tick(400);
    expect(run.snapshot().timeLeftMs).toBe(DIFFICULTIES.normal.startMs);
    expect(run.snapshot().status).toBe('ready');
  });

  test('el primer toque válido arranca la partida', () => {
    const run = newRun();
    const first = solutionTaps(run.snapshot().board)[0];
    const events = run.tap(first);
    expect(events[0]).toEqual({ type: 'start' });
    expect(run.snapshot().status).toBe('playing');
    run.tick(100);
    expect(run.snapshot().timeLeftMs).toBe(DIFFICULTIES.normal.startMs - 100);
  });
});

describe('toques', () => {
  test('tocar una pieza no girable no arranca la partida ni cuenta como toque', () => {
    // Busca un tablero con alguna pieza vacía o cruz.
    for (let k = 0; k < 50; k++) {
      const run = newRun(`blocked${k}`);
      const idx = run.snapshot().board.cells.findIndex((m) => orientationCount(m) <= 1);
      if (idx < 0) continue;
      const events = run.tap(idx);
      expect(events).toEqual([{ type: 'blocked', index: idx }]);
      expect(run.snapshot().taps).toBe(0);
      expect(run.snapshot().status).toBe('ready');
      return;
    }
    throw new Error('no se encontró ningún tablero con casillas no girables');
  });

  test('índices inválidos se ignoran sin romper nada', () => {
    const run = newRun();
    for (const bad of [-1, 9999, 1.5, NaN]) expect(run.tap(bad)).toEqual([]);
    expect(run.snapshot().taps).toBe(0);
  });

  test('cuatro toques sobre una pieza la devuelven a su estado', () => {
    const run = newRun();
    const s0 = run.snapshot();
    const idx = s0.board.cells.findIndex((m) => orientationCount(m) === 4);
    for (let k = 0; k < 4; k++) run.tap(idx);
    expect(run.snapshot().board.cells[idx]).toBe(s0.board.cells[idx]);
    expect(run.snapshot().taps).toBe(4);
  });
});

describe('encendido, racha y puntos', () => {
  test('encender una pieza por primera vez da 10 puntos x multiplicador', () => {
    const run = newRun('lock1');
    let total = 0;
    let lockEvents = 0;
    for (const i of solutionTaps(run.snapshot().board)) {
      for (const e of run.tap(i)) {
        if (e.type === 'lock') {
          total += e.points;
          lockEvents++;
          expect(e.points % 10).toBe(0);
          expect(e.multiplier).toBeGreaterThanOrEqual(1);
        }
      }
      if (run.currentStatus === 'transition') break;
    }
    expect(lockEvents).toBeGreaterThan(0);
    // Los puntos de encendido están dentro del marcador (más el bonus de cierre).
    expect(run.snapshot().score).toBeGreaterThanOrEqual(total);
  });

  test('anti-exploit: volver a encender una pieza ya encendida no da puntos', () => {
    const run = newRun('antiexploit');
    const taps = solutionTaps(run.snapshot().board);
    // Resolver todo menos el último toque, para quedarnos sin cerrar el tablero.
    for (const i of taps.slice(0, -1)) run.tap(i);
    const scoreBefore = run.snapshot().score;
    const lockedBefore = run.snapshot().locked.filter(Boolean).length;
    // Girar 4 veces una pieza ya encendida y de 4 orientaciones: se apaga y se vuelve a encender.
    const s = run.snapshot();
    const idx = s.board.cells.findIndex((m, i) => s.locked[i] && orientationCount(m) === 4);
    expect(idx).toBeGreaterThanOrEqual(0);
    for (let k = 0; k < 4; k++) run.tap(idx);
    expect(run.snapshot().score).toBe(scoreBefore);
    expect(run.snapshot().locked.filter(Boolean).length).toBe(lockedBefore);
  });

  test('anti-exploit: las piezas que nacen encendidas no puntúan', () => {
    for (let k = 0; k < 40; k++) {
      const run = newRun(`prelit${k}`);
      const s = run.snapshot();
      const pre = s.locked.findIndex((l, i) => l && orientationCount(s.board.cells[i]) === 4);
      if (pre < 0) continue;
      for (let j = 0; j < 4; j++) run.tap(pre);
      expect(run.snapshot().score).toBe(0);
      return;
    }
  });

  test('la racha se mantiene si encadenas dentro de la ventana y se rompe al pasarse', () => {
    const run = newRun('combo');
    // Busca un primer toque que encienda algo.
    const taps = solutionTaps(run.snapshot().board);
    let combo = 0;
    for (const i of taps) {
      const ev = run.tap(i);
      const lock = ev.find((e) => e.type === 'lock');
      if (lock && lock.type === 'lock') {
        combo = lock.combo;
        break;
      }
    }
    expect(combo).toBeGreaterThan(0);
    for (let t = 0; t < COMBO_WINDOW_MS - 100; t += 100) run.tick(100);
    expect(run.snapshot().combo).toBe(combo);
    const events: RunEvent[] = [];
    for (let t = 0; t < 300; t += 100) events.push(...run.tick(100));
    expect(events.some((e) => e.type === 'comboEnd')).toBe(true);
    expect(run.snapshot().combo).toBe(0);
    expect(run.snapshot().maxCombo).toBe(combo);
  });
});

describe('cerrar un tablero', () => {
  test('resolver el tablero lo cierra, suma puntos y tiempo y pasa a transición', () => {
    const run = newRun('clear');
    const par = run.snapshot().par;
    const events = solveBoard(run);
    const clear = events.find((e) => e.type === 'clear');
    expect(clear).toBeDefined();
    if (!clear || clear.type !== 'clear') return;
    const s = run.snapshot();
    expect(s.status).toBe('transition');
    expect(s.boardsCleared).toBe(1);
    expect(clear.info.par).toBe(par);
    expect(clear.info.taps).toBe(par); // camino del objetivo: justo el par
    expect(clear.info.perfect).toBe(true);
    expect(clear.info.efficiency).toBe(1);
    expect(clear.info.timeBonusMs).toBeGreaterThan(0);
    expect(s.timeLeftMs).toBe(DIFFICULTIES.normal.startMs + clear.info.timeBonusMs);
    expect(s.score).toBeGreaterThan(clear.info.bonusPoints);
    expect(clear.info.circuits).toBeGreaterThanOrEqual(1);
  });

  test('durante la transición el tiempo no corre y los toques se ignoran', () => {
    const run = newRun('transition');
    solveBoard(run);
    const t0 = run.snapshot().timeLeftMs;
    expect(run.tap(0)).toEqual([]);
    run.tick(300);
    expect(run.snapshot().timeLeftMs).toBe(t0);
    const events = finishTransition(run);
    expect(events.some((e) => e.type === 'next')).toBe(true);
    expect(run.snapshot().status).toBe('playing');
    expect(run.snapshot().boardNumber).toBe(2);
    expect(run.snapshot().boardTaps).toBe(0);
  });

  test('tras la transición hay un tablero nuevo, resoluble y sin cerrar', () => {
    const run = newRun('next');
    solveBoard(run);
    finishTransition(run);
    const b = run.snapshot().board;
    expect(isClosed(b)).toBe(false);
    expect(solutionTaps(b).length).toBe(run.snapshot().par);
  });

  test('cerrar con toques de sobra baja la eficiencia, los puntos y el tiempo', () => {
    const a = newRun('eff');
    const b = newRun('eff'); // mismo tablero
    expect(a.snapshot().board).toEqual(b.snapshot().board);
    const evA = solveBoard(a);
    // En b, antes de resolver, desperdicia 8 vueltas completas a una pieza.
    const idx = b.snapshot().board.cells.findIndex((m) => orientationCount(m) === 4);
    for (let k = 0; k < 8; k++) b.tap(idx);
    const evB = solveBoard(b);
    const ca = evA.find((e) => e.type === 'clear');
    const cb = evB.find((e) => e.type === 'clear');
    if (!ca || ca.type !== 'clear' || !cb || cb.type !== 'clear') throw new Error('sin cierre');
    expect(cb.info.efficiency).toBeLessThan(ca.info.efficiency);
    expect(cb.info.bonusPoints).toBeLessThan(ca.info.bonusPoints);
    expect(cb.info.timeBonusMs).toBeLessThan(ca.info.timeBonusMs);
    expect(cb.info.perfect).toBe(false);
  });

  test('la dificultad adaptativa sube el tablero si cierras rápido', () => {
    const run = newRun('adaptive', 'easy');
    const sizes: number[] = [];
    for (let n = 0; n < 6; n++) {
      sizes.push(run.snapshot().board.cells.length);
      solveBoard(run); // sin tick: tiempo de resolución 0 ms = "rápido"
      finishTransition(run);
    }
    expect(sizes[sizes.length - 1]).toBeGreaterThan(sizes[0]);
  });

  test('la dificultad adaptativa nunca baja del primer escalón', () => {
    const run = newRun('slowplayer', 'easy');
    const first = run.snapshot().board.cells.length;
    for (let n = 0; n < 4; n++) {
      for (let t = 0; t < 60_000 && run.currentStatus !== 'playing'; t += 100) run.tick(100);
      run.tap(solutionTaps(run.snapshot().board)[0]);
      for (let t = 0; t < 9_000; t++) {
        run.tick(MAX_TICK_MS);
        if (run.currentStatus === 'over') break;
      }
    }
    expect(run.snapshot().board.cells.length).toBeGreaterThanOrEqual(first);
  });
});

describe('tiempo y fin de partida', () => {
  test('la partida termina exactamente cuando el tiempo llega a 0', () => {
    const run = newRun('timeout');
    run.tap(solutionTaps(run.snapshot().board)[0]);
    let over = false;
    let elapsed = 0;
    while (!over && elapsed < 200_000) {
      const events = run.tick(100);
      elapsed += 100;
      over = events.some((e) => e.type === 'over');
    }
    expect(over).toBe(true);
    expect(run.snapshot().status).toBe('over');
    expect(run.snapshot().timeLeftMs).toBe(0);
    expect(elapsed).toBe(DIFFICULTIES.normal.startMs);
    expect(run.result().endedBy).toBe('time');
  });

  test('tras terminar, ni los toques ni el reloj cambian nada', () => {
    const run = newRun('after-over');
    run.tap(solutionTaps(run.snapshot().board)[0]);
    for (let t = 0; t < 41_000; t += 500) run.tick(500);
    const before = JSON.stringify(run.result());
    expect(run.tap(0)).toEqual([]);
    expect(run.tick(500)).toEqual([]);
    expect(JSON.stringify(run.result())).toBe(before);
  });

  test('avisa una vez por cada uno de los últimos 5 segundos', () => {
    const run = newRun('warn');
    run.tap(solutionTaps(run.snapshot().board)[0]);
    const warns: number[] = [];
    for (let t = 0; t < 41_000; t += 100) {
      for (const e of run.tick(100)) if (e.type === 'warn') warns.push(e.secondsLeft);
    }
    expect(warns).toEqual([5, 4, 3, 2, 1]);
  });

  test('un tick enorme (JS bloqueado) se recorta y no se traga la partida', () => {
    const run = newRun('bigtick');
    run.tap(solutionTaps(run.snapshot().board)[0]);
    run.tick(60_000);
    expect(run.snapshot().timeLeftMs).toBe(DIFFICULTIES.normal.startMs - MAX_TICK_MS);
    expect(run.snapshot().status).toBe('playing');
  });

  test('ticks inválidos se ignoran', () => {
    const run = newRun('badtick');
    run.tap(solutionTaps(run.snapshot().board)[0]);
    const t = run.snapshot().timeLeftMs;
    for (const bad of [0, -5, NaN]) run.tick(bad);
    expect(run.snapshot().timeLeftMs).toBe(t);
  });
});

describe('pausa y abandono', () => {
  test('en pausa no corre el tiempo y no se puede jugar; al reanudar sigue igual', () => {
    const run = newRun('pause');
    run.tap(solutionTaps(run.snapshot().board)[0]);
    run.tick(1000);
    const t = run.snapshot().timeLeftMs;
    run.pause();
    expect(run.snapshot().status).toBe('paused');
    run.tick(10_000);
    expect(run.tap(0)).toEqual([]);
    expect(run.snapshot().timeLeftMs).toBe(t);
    run.resume();
    expect(run.snapshot().status).toBe('playing');
    run.tick(100);
    expect(run.snapshot().timeLeftMs).toBe(t - 100);
  });

  test('pausar durante la transición reanuda en la transición', () => {
    const run = newRun('pause-transition');
    solveBoard(run);
    run.pause();
    run.tick(5_000);
    expect(run.snapshot().status).toBe('paused');
    run.resume();
    expect(run.snapshot().status).toBe('transition');
  });

  test('pausar antes de empezar conserva el estado "ready"', () => {
    const run = newRun('pause-ready');
    run.pause();
    run.resume();
    expect(run.snapshot().status).toBe('ready');
  });

  test('pausar es idempotente y resume sin pausa no hace nada', () => {
    const run = newRun('pause-idem');
    run.tap(solutionTaps(run.snapshot().board)[0]);
    run.resume();
    expect(run.snapshot().status).toBe('playing');
    run.pause();
    run.pause();
    run.resume();
    expect(run.snapshot().status).toBe('playing');
  });

  test('abandonar sin haber jugado no genera resultado; con juego, sí', () => {
    expect(newRun('quit0').abandon()).toBeNull();
    const run = newRun('quit1');
    run.tap(solutionTaps(run.snapshot().board)[0]);
    const r = run.abandon();
    expect(r).not.toBeNull();
    expect(r?.endedBy).toBe('quit');
    expect(run.snapshot().status).toBe('over');
  });
});

describe('determinismo y reto diario', () => {
  test('misma semilla, mismo primer tablero', () => {
    expect(newRun('abc').snapshot().board).toEqual(newRun('abc').snapshot().board);
    expect(newRun('abc').snapshot().board).not.toEqual(newRun('abd').snapshot().board);
  });

  test('en modo diario la secuencia de tableros no depende del jugador', () => {
    const mk = () => new GameRun({ difficulty: 'normal', seed: 'daily-2026-10-09', mode: 'daily', startMs: 60_000 });
    const fast = mk();
    const slow = mk();
    const fastBoards: number[][] = [];
    const slowBoards: number[][] = [];
    for (let n = 0; n < 5; n++) {
      fastBoards.push([...fast.snapshot().board.cells]);
      solveBoard(fast);
      finishTransition(fast);

      slowBoards.push([...slow.snapshot().board.cells]);
      // El lento tarda mucho más y desperdicia toques.
      const idx = slow.snapshot().board.cells.findIndex((m) => orientationCount(m) === 4);
      slow.tap(idx);
      for (let t = 0; t < 8_000; t += 100) slow.tick(100);
      for (let k = 0; k < 3; k++) slow.tap(idx);
      solveBoard(slow);
      finishTransition(slow);
    }
    expect(fastBoards).toEqual(slowBoards);
  });
});

describe('resultado', () => {
  test('result() refleja el estado de la partida', () => {
    const run = newRun('result');
    const par = run.snapshot().par;
    solveBoard(run);
    const r = run.result();
    expect(r.boardsCleared).toBe(1);
    expect(r.taps).toBe(par);
    expect(r.parTaps).toBe(par);
    expect(r.tapsOnCleared).toBe(par);
    expect(r.perfectBoards).toBe(1);
    expect(r.score).toBe(run.snapshot().score);
    expect(r.difficulty).toBe('normal');
    expect(r.mode).toBe('free');
    expect(r.seed).toBe('result');
    expect(Number.isInteger(r.score)).toBe(true);
  });
});
