import type { StageSpec } from './generator';

export type DifficultyId = 'easy' | 'normal' | 'expert';

export const DIFFICULTY_IDS: readonly DifficultyId[] = ['easy', 'normal', 'expert'];

export interface DifficultyConfig {
  id: DifficultyId;
  /** Tiempo inicial de la partida. */
  startMs: number;
  /** Escalera de tableros: el nivel de tablero (stage) indexa esta lista; el último se repite. */
  ladder: readonly StageSpec[];
  /** Tiempo objetivo por pieza activa; define "rápido" y "lento" para la dificultad adaptativa. */
  targetMsPerTile: number;
  /** Segundos que se ganan al cerrar un tablero: por pieza activa, con mínimo y máximo. */
  timeBonusPerTileMs: number;
  timeBonusMinMs: number;
  timeBonusMaxMs: number;
  /**
   * El bonus de tiempo se reduce un poco con cada tablero cerrado (igual para todos),
   * de modo que ninguna partida es infinita aunque se juegue a la perfección.
   */
  timeBonusDecayPerBoard: number;
  /** Fracción mínima del bonus a la que puede llegar la reducción. */
  timeBonusFloor: number;
}

const s = (cols: number, rows: number, fill: number, bridges: number): StageSpec => ({
  cols,
  rows,
  fill,
  bridges,
});

export const DIFFICULTIES: Record<DifficultyId, DifficultyConfig> = {
  easy: {
    id: 'easy',
    startMs: 34_000,
    ladder: [s(3, 3, 0.55, 0), s(3, 4, 0.55, 0), s(4, 4, 0.55, 0), s(4, 4, 0.6, 1), s(4, 5, 0.6, 1), s(5, 5, 0.6, 1)],
    targetMsPerTile: 1300,
    timeBonusPerTileMs: 480,
    timeBonusMinMs: 3_000,
    timeBonusMaxMs: 9_000,
    timeBonusDecayPerBoard: 0.04,
    timeBonusFloor: 0.35,
  },
  normal: {
    id: 'normal',
    startMs: 40_000,
    ladder: [
      s(4, 4, 0.6, 1),
      s(4, 5, 0.6, 1),
      s(5, 5, 0.6, 2),
      s(5, 5, 0.65, 2),
      s(5, 6, 0.65, 2),
      s(6, 6, 0.65, 3),
      s(6, 6, 0.7, 3),
    ],
    targetMsPerTile: 1100,
    timeBonusPerTileMs: 440,
    timeBonusMinMs: 3_000,
    timeBonusMaxMs: 9_000,
    timeBonusDecayPerBoard: 0.04,
    timeBonusFloor: 0.35,
  },
  expert: {
    id: 'expert',
    startMs: 44_000,
    ladder: [s(5, 5, 0.65, 2), s(5, 6, 0.65, 3), s(6, 6, 0.65, 3), s(6, 7, 0.7, 4), s(6, 7, 0.75, 4)],
    targetMsPerTile: 900,
    timeBonusPerTileMs: 420,
    timeBonusMinMs: 3_000,
    timeBonusMaxMs: 9_000,
    timeBonusDecayPerBoard: 0.04,
    timeBonusFloor: 0.35,
  },
};

export function stageSpec(difficulty: DifficultyId, stage: number): StageSpec {
  const ladder = DIFFICULTIES[difficulty].ladder;
  const i = Math.max(0, Math.min(ladder.length - 1, Math.floor(stage)));
  return ladder[i];
}

/** Ajuste del "rating" del jugador tras cerrar un tablero. Nunca baja de 0. */
export const RATING_FAST = 1;
export const RATING_NORMAL = 0.5;
export const RATING_SLOW = -0.5;

export function nextRating(rating: number, solveMs: number, activeTiles: number, config: DifficultyConfig): number {
  const target = activeTiles * config.targetMsPerTile;
  const delta = solveMs <= target ? RATING_FAST : solveMs <= target * 2 ? RATING_NORMAL : RATING_SLOW;
  return Math.max(0, rating + delta);
}

/** Nivel de tablero del reto diario: depende solo del índice, nunca del jugador, para que todos reciban lo mismo. */
export function dailyStage(boardIndex: number): number {
  return Math.floor(boardIndex * 0.7);
}
