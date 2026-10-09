import type { RunResult } from '../../engine/run';
import type { RunSummary } from '../../storage/records';
import { goalText } from '../../strings';
import { nextGoal, niceAbove } from '../goals';

const result = (p: Partial<RunResult> = {}): RunResult => ({
  difficulty: 'normal', mode: 'free', seed: 's', score: 1000, boardsCleared: 5, taps: 60, parTaps: 50,
  tapsOnCleared: 55, perfectBoards: 1, maxCombo: 8, playMs: 60000, endedBy: 'time', ...p,
});
const summary = (p: Partial<RunSummary> = {}): RunSummary => ({
  difficulty: 'normal', score: 1000, isRecord: false, previousBest: 2000, best: 2000, missing: 1000,
  previousBestBoards: 5, previousBestCombo: 8, ...p,
});

describe('niceAbove', () => {
  test.each([
    [0, 10], [9, 10], [10, 11], [123, 130], [999, 1000], [1234, 1300], [5000, 5100], [98765, 99000],
  ])('niceAbove(%i) = %i', (input, expected) => {
    expect(niceAbove(input)).toBe(expected);
    expect(niceAbove(input)).toBeGreaterThan(input);
  });
});

describe('nextGoal', () => {
  test('primera partida: una cifra redonda por encima', () => {
    const g = nextGoal(result({ score: 400 }), summary({ previousBest: 0, best: 400, isRecord: true, missing: 0 }));
    expect(g.kind).toBe('firstRun');
    if (g.kind === 'firstRun') expect(g.target).toBeGreaterThan(400);
  });

  test('tras un récord, el objetivo es superarlo por poco', () => {
    const g = nextGoal(result({ score: 3000 }), summary({ isRecord: true, best: 3000, previousBest: 2000, missing: 0 }));
    expect(g).toEqual({ kind: 'beatRecord', target: 3400 });
  });

  test('si faltó poco para el récord, se dice cuánto', () => {
    const g = nextGoal(result({ score: 1800 }), summary({ missing: 200 }));
    expect(g).toEqual({ kind: 'almostRecord', missing: 200, target: 2001 });
  });

  test('si quedó lejos, propone más tableros (alcanzable: +2 como máximo)', () => {
    const g = nextGoal(result({ boardsCleared: 3 }), summary({ previousBestBoards: 9 }));
    expect(g).toEqual({ kind: 'boards', target: 5 });
  });

  test('sin tableros perfectos propone uno', () => {
    const g = nextGoal(result({ perfectBoards: 0, boardsCleared: 6 }), summary({ previousBestBoards: 5 }));
    expect(g).toEqual({ kind: 'perfectBoard' });
  });

  test('siempre devuelve un texto no vacío', () => {
    for (const g of [
      nextGoal(result(), summary()),
      nextGoal(result({ score: 0, boardsCleared: 0, perfectBoards: 0, maxCombo: 0, taps: 0 }), summary({ previousBest: 0, best: 0, missing: 0 })),
      nextGoal(result({ maxCombo: 1, perfectBoards: 2 }), summary({ previousBestBoards: 1, previousBestCombo: 10 })),
    ]) {
      expect(goalText(g).length).toBeGreaterThan(5);
    }
  });
});
