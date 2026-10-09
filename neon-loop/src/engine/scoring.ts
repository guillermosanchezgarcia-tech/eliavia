import type { DifficultyConfig } from './difficulty';

/** Puntos base por encender una pieza por primera vez en un tablero. */
export const LOCK_POINTS = 10;
/** Ventana para encadenar encendidos y mantener la racha. */
export const COMBO_WINDOW_MS = 2200;
export const MAX_MULTIPLIER = 6;
/** Bonus fijo al cerrar un tablero con los giros de referencia o menos. */
export const PERFECT_BONUS = 50;
export const CLEAR_POINTS_PER_TILE = 15;

/** Multiplicador por racha: x1 hasta 3 encendidos seguidos, x2 hasta 6, etc., con tope. */
export function multiplierForCombo(combo: number): number {
  if (combo <= 0) return 1;
  return Math.min(MAX_MULTIPLIER, 1 + Math.floor((combo - 1) / 3));
}

/** Eficiencia en (0, 1]: par / toques, limitada a 1 (superar el par no da más). */
export function efficiency(par: number, taps: number): number {
  if (taps <= 0) return 1;
  return Math.min(1, Math.max(1, par) / taps);
}

/** Puntos por cerrar un tablero: base por pieza escalada por eficiencia² y bonus perfecto. */
export function clearBonusPoints(activeTiles: number, par: number, taps: number): number {
  const eff = efficiency(par, taps);
  const perfect = taps <= Math.max(1, par);
  return Math.round(CLEAR_POINTS_PER_TILE * activeTiles * eff * eff) + (perfect ? PERFECT_BONUS : 0);
}

/** Fracción del bonus de tiempo que queda tras `boardsCleared` tableros cerrados. */
export function bonusDecay(config: DifficultyConfig, boardsCleared: number): number {
  return Math.max(config.timeBonusFloor, 1 - config.timeBonusDecayPerBoard * Math.max(0, boardsCleared));
}

/**
 * Tiempo extra al cerrar un tablero. Más piezas y más eficiencia = más tiempo;
 * cada tablero ya cerrado reduce un poco el bonus (ver `timeBonusDecayPerBoard`).
 */
export function timeBonusMs(
  config: DifficultyConfig,
  activeTiles: number,
  par: number,
  taps: number,
  boardsCleared = 0
): number {
  const raw = activeTiles * config.timeBonusPerTileMs;
  const clamped = Math.max(config.timeBonusMinMs, Math.min(config.timeBonusMaxMs, raw));
  return Math.round(clamped * bonusDecay(config, boardsCleared) * (0.7 + 0.3 * efficiency(par, taps)));
}
