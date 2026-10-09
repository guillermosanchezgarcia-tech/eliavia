import { DIFFICULTIES } from '../difficulty';
import {
  CLEAR_POINTS_PER_TILE,
  MAX_MULTIPLIER,
  PERFECT_BONUS,
  clearBonusPoints,
  efficiency,
  multiplierForCombo,
  timeBonusMs,
} from '../scoring';

describe('puntuación', () => {
  test('el multiplicador sube cada 3 encendidos y tiene tope', () => {
    expect(multiplierForCombo(0)).toBe(1);
    expect(multiplierForCombo(1)).toBe(1);
    expect(multiplierForCombo(3)).toBe(1);
    expect(multiplierForCombo(4)).toBe(2);
    expect(multiplierForCombo(7)).toBe(3);
    expect(multiplierForCombo(1000)).toBe(MAX_MULTIPLIER);
  });

  test('la eficiencia es par/toques, limitada a 1', () => {
    expect(efficiency(10, 10)).toBe(1);
    expect(efficiency(10, 5)).toBe(1);
    expect(efficiency(10, 20)).toBe(0.5);
    expect(efficiency(0, 3)).toBeCloseTo(1 / 3);
    expect(efficiency(5, 0)).toBe(1);
  });

  test('cerrar con el par o menos da el bonus perfecto', () => {
    expect(clearBonusPoints(10, 12, 12)).toBe(10 * CLEAR_POINTS_PER_TILE + PERFECT_BONUS);
    expect(clearBonusPoints(10, 12, 9)).toBe(10 * CLEAR_POINTS_PER_TILE + PERFECT_BONUS);
  });

  test('cada toque de más reduce el bonus de forma monótona, sin bajar de 0', () => {
    let last = Infinity;
    for (let taps = 12; taps <= 80; taps++) {
      const p = clearBonusPoints(10, 12, taps);
      expect(p).toBeLessThanOrEqual(last);
      expect(p).toBeGreaterThanOrEqual(0);
      last = p;
    }
  });

  test('el bonus de tiempo está acotado y premia la eficiencia', () => {
    for (const id of ['easy', 'normal', 'expert'] as const) {
      const cfg = DIFFICULTIES[id];
      for (const tiles of [4, 10, 20, 40]) {
        const perfect = timeBonusMs(cfg, tiles, 10, 10);
        const sloppy = timeBonusMs(cfg, tiles, 10, 40);
        expect(perfect).toBeGreaterThanOrEqual(cfg.timeBonusMinMs * 0.7 * 0.99);
        expect(perfect).toBeLessThanOrEqual(cfg.timeBonusMaxMs);
        expect(sloppy).toBeLessThan(perfect);
        expect(sloppy).toBeGreaterThan(0);
      }
    }
  });

  test('todas las cantidades de puntos son enteros', () => {
    for (let taps = 1; taps < 60; taps++) {
      expect(Number.isInteger(clearBonusPoints(13, 17, taps))).toBe(true);
      expect(Number.isInteger(timeBonusMs(DIFFICULTIES.normal, 13, 17, taps))).toBe(true);
    }
  });
});
