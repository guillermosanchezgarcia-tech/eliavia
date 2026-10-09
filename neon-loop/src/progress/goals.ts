import type { RunResult } from '../engine/run';
import type { RunSummary } from '../storage/records';

/** Objetivo concreto y alcanzable para la siguiente partida. */
export type Goal =
  | { kind: 'firstRun'; target: number }
  | { kind: 'beatRecord'; target: number }
  | { kind: 'almostRecord'; missing: number; target: number }
  | { kind: 'boards'; target: number }
  | { kind: 'perfectBoard' }
  | { kind: 'combo'; target: number };

/** Siguiente cifra "redonda" (2 cifras significativas) por encima de `value`. */
export function niceAbove(value: number): number {
  if (value < 10) return 10;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)) - 1);
  return (Math.floor(value / magnitude) + 1) * magnitude;
}

/**
 * Elige el objetivo de la siguiente partida. Siempre es algo que el jugador acaba de rozar,
 * nunca una meta lejana: pequeñas victorias alcanzables sostienen la motivación.
 */
export function nextGoal(result: RunResult, summary: RunSummary): Goal {
  if (summary.previousBest === 0) {
    return { kind: 'firstRun', target: niceAbove(Math.max(result.score * 1.25, 100)) };
  }
  if (summary.isRecord) {
    return { kind: 'beatRecord', target: niceAbove(result.score * 1.1) };
  }
  if (summary.missing <= summary.best * 0.15) {
    return { kind: 'almostRecord', missing: summary.missing, target: summary.best + 1 };
  }
  if (result.boardsCleared < summary.previousBestBoards) {
    return { kind: 'boards', target: Math.min(summary.previousBestBoards, result.boardsCleared + 2) };
  }
  if (result.perfectBoards === 0 && result.boardsCleared > 0) {
    return { kind: 'perfectBoard' };
  }
  if (result.maxCombo < summary.previousBestCombo) {
    return { kind: 'combo', target: Math.min(summary.previousBestCombo, result.maxCombo + 3) };
  }
  return { kind: 'beatRecord', target: summary.best + 1 };
}
