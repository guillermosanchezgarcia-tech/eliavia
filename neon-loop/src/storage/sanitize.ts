import { DIFFICULTY_IDS, DifficultyId } from '../engine/difficulty';
import {
  DifficultyRecord,
  LIMITS,
  LastRun,
  SAVE_VERSION,
  SETTINGS_VERSION,
  SaveData,
  Settings,
  Totals,
  defaultSave,
  defaultSettings,
  emptyRecord,
} from './types';

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Entero en [0, max]; cualquier otra cosa (NaN, Infinity, texto, negativo...) se descarta como 0. */
export function toCount(x: unknown, max: number): number {
  if (typeof x !== 'number' || !Number.isFinite(x)) return 0;
  const n = Math.floor(x);
  return n < 0 ? 0 : n > max ? max : n;
}

const isDifficulty = (x: unknown): x is DifficultyId => DIFFICULTY_IDS.includes(x as DifficultyId);

function sanitizeRecord(raw: unknown): DifficultyRecord {
  if (!isObject(raw)) return emptyRecord();
  return {
    bestScore: toCount(raw.bestScore, LIMITS.score),
    bestBoards: toCount(raw.bestBoards, LIMITS.boards),
    bestCombo: toCount(raw.bestCombo, LIMITS.combo),
    runs: toCount(raw.runs, LIMITS.totalRuns),
  };
}

function sanitizeTotals(raw: unknown): Totals {
  if (!isObject(raw)) return { runs: 0, boards: 0, taps: 0, playMs: 0 };
  return {
    runs: toCount(raw.runs, LIMITS.totalRuns),
    boards: toCount(raw.boards, LIMITS.totalBoards),
    taps: toCount(raw.taps, LIMITS.totalTaps),
    playMs: toCount(raw.playMs, LIMITS.totalPlayMs),
  };
}

function sanitizeLastRun(raw: unknown): LastRun | null {
  if (!isObject(raw) || !isDifficulty(raw.difficulty)) return null;
  return {
    difficulty: raw.difficulty,
    score: toCount(raw.score, LIMITS.score),
    boardsCleared: toCount(raw.boardsCleared, LIMITS.boards),
    at: toCount(raw.at, Number.MAX_SAFE_INTEGER),
  };
}

/**
 * Reconstruye un guardado válido a partir de datos desconocidos, conservando lo que sea
 * válido campo a campo. Devuelve null solo si `raw` no es siquiera un objeto.
 * Esta función es la única puerta de entrada de datos persistidos a la app.
 */
export function sanitizeSave(raw: unknown): SaveData | null {
  if (!isObject(raw)) return null;
  const save = defaultSave(0);
  const records = isObject(raw.records) ? raw.records : {};
  for (const id of DIFFICULTY_IDS) save.records[id] = sanitizeRecord(records[id]);
  save.totals = sanitizeTotals(raw.totals);
  save.lastRun = sanitizeLastRun(raw.lastRun);
  save.updatedAt = toCount(raw.updatedAt, Number.MAX_SAFE_INTEGER);
  save.version = SAVE_VERSION;
  return save;
}

export function sanitizeSettings(raw: unknown): Settings {
  const defaults = defaultSettings();
  if (!isObject(raw)) return defaults;
  return {
    version: SETTINGS_VERSION,
    sfx: typeof raw.sfx === 'boolean' ? raw.sfx : defaults.sfx,
    haptics: typeof raw.haptics === 'boolean' ? raw.haptics : defaults.haptics,
    lastDifficulty: isDifficulty(raw.lastDifficulty) ? raw.lastDifficulty : defaults.lastDifficulty,
  };
}
