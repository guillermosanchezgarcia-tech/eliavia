import { DIFFICULTY_IDS, DifficultyId } from '../engine/difficulty';

export const SAVE_VERSION = 1;
export const SETTINGS_VERSION = 1;

/** Cotas de cordura: cualquier valor fuera de ellas se considera dato corrupto o partida inválida. */
export const LIMITS = {
  score: 5_000_000,
  boards: 5_000,
  taps: 200_000,
  combo: 5_000,
  playMs: 6 * 60 * 60 * 1000,
  totalRuns: 10_000_000,
  totalBoards: 100_000_000,
  totalTaps: 1_000_000_000,
  totalPlayMs: 10_000 * 60 * 60 * 1000,
} as const;

export interface DifficultyRecord {
  bestScore: number;
  bestBoards: number;
  bestCombo: number;
  runs: number;
}

export interface Totals {
  runs: number;
  boards: number;
  taps: number;
  playMs: number;
}

export interface LastRun {
  difficulty: DifficultyId;
  score: number;
  boardsCleared: number;
  at: number;
}

export interface SaveData {
  version: number;
  records: Record<DifficultyId, DifficultyRecord>;
  totals: Totals;
  lastRun: LastRun | null;
  updatedAt: number;
}

export interface Settings {
  version: number;
  sfx: boolean;
  haptics: boolean;
  lastDifficulty: DifficultyId;
}

export const emptyRecord = (): DifficultyRecord => ({ bestScore: 0, bestBoards: 0, bestCombo: 0, runs: 0 });

export function defaultSave(now = 0): SaveData {
  const records = {} as Record<DifficultyId, DifficultyRecord>;
  for (const id of DIFFICULTY_IDS) records[id] = emptyRecord();
  return {
    version: SAVE_VERSION,
    records,
    totals: { runs: 0, boards: 0, taps: 0, playMs: 0 },
    lastRun: null,
    updatedAt: now,
  };
}

export const defaultSettings = (): Settings => ({
  version: SETTINGS_VERSION,
  sfx: true,
  haptics: true,
  lastDifficulty: 'normal',
});
