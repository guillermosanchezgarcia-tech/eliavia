import { DIFFICULTY_IDS } from '../engine/difficulty';
import type { RunResult } from '../engine/run';
import { LIMITS, SaveData } from './types';

export interface RunSummary {
  difficulty: RunResult['difficulty'];
  score: number;
  isRecord: boolean;
  /** Récord anterior en esa dificultad (0 si no había). */
  previousBest: number;
  /** Récord vigente tras esta partida. */
  best: number;
  /** Cuánto falta para igualar el récord (0 si se ha batido o igualado). */
  missing: number;
  /** Tableros del mejor registro anterior (para proponer un objetivo). */
  previousBestBoards: number;
  previousBestCombo: number;
}

const isInt = (x: unknown, min: number, max: number): x is number =>
  typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max;

/**
 * Comprueba que un resultado es coherente antes de dejarlo tocar el guardado. Un resultado
 * defectuoso (bug, dato manipulado, NaN) se rechaza entero y los récords no se modifican.
 */
export function validateRunResult(r: unknown): r is RunResult {
  if (typeof r !== 'object' || r === null) return false;
  const x = r as Record<string, unknown>;
  if (!DIFFICULTY_IDS.includes(x.difficulty as never)) return false;
  if (x.mode !== 'free' && x.mode !== 'daily') return false;
  if (x.endedBy !== 'time' && x.endedBy !== 'quit') return false;
  if (!isInt(x.score, 0, LIMITS.score)) return false;
  if (!isInt(x.boardsCleared, 0, LIMITS.boards)) return false;
  if (!isInt(x.taps, 0, LIMITS.taps)) return false;
  if (!isInt(x.parTaps, 0, LIMITS.taps)) return false;
  if (!isInt(x.tapsOnCleared, 0, LIMITS.taps)) return false;
  if (!isInt(x.perfectBoards, 0, LIMITS.boards)) return false;
  if (!isInt(x.maxCombo, 0, LIMITS.combo)) return false;
  if (!isInt(x.playMs, 0, LIMITS.playMs)) return false;
  // Coherencia interna.
  if (x.tapsOnCleared > x.taps) return false;
  if (x.perfectBoards > x.boardsCleared) return false;
  if (x.score > 0 && x.taps === 0) return false;
  if (x.boardsCleared > 0 && x.taps === 0) return false;
  return true;
}

const sat = (a: number, b: number, max: number): number => Math.min(max, a + b);

/**
 * Aplica una partida al guardado. Función pura: no muta `save`. Si el resultado no es válido
 * devuelve el guardado intacto y `summary: null`. Los récords solo pueden subir.
 */
export function applyRunResult(
  save: SaveData,
  result: unknown,
  now: number
): { save: SaveData; summary: RunSummary | null } {
  if (!validateRunResult(result)) return { save, summary: null };

  const prev = save.records[result.difficulty];
  const isFree = result.mode === 'free';
  const isRecord = isFree && result.score > prev.bestScore;
  const best = isFree ? Math.max(prev.bestScore, result.score) : prev.bestScore;

  const next: SaveData = {
    ...save,
    records: { ...save.records },
    totals: {
      runs: sat(save.totals.runs, 1, LIMITS.totalRuns),
      boards: sat(save.totals.boards, result.boardsCleared, LIMITS.totalBoards),
      taps: sat(save.totals.taps, result.taps, LIMITS.totalTaps),
      playMs: sat(save.totals.playMs, result.playMs, LIMITS.totalPlayMs),
    },
    lastRun: {
      difficulty: result.difficulty,
      score: result.score,
      boardsCleared: result.boardsCleared,
      at: now,
    },
    updatedAt: now,
  };

  if (isFree) {
    next.records[result.difficulty] = {
      bestScore: best,
      bestBoards: Math.max(prev.bestBoards, result.boardsCleared),
      bestCombo: Math.max(prev.bestCombo, result.maxCombo),
      runs: sat(prev.runs, 1, LIMITS.totalRuns),
    };
  }

  return {
    save: next,
    summary: {
      difficulty: result.difficulty,
      score: result.score,
      isRecord,
      previousBest: prev.bestScore,
      best,
      missing: Math.max(0, best - result.score),
      previousBestBoards: prev.bestBoards,
      previousBestCombo: prev.bestCombo,
    },
  };
}
