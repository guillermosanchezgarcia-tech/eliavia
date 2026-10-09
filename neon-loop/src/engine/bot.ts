/**
 * Jugadores-bot para la simulación de equilibrio y los tests de regresión del ritmo.
 * Usan el motor real. Son un MODELO de jugador (lectura + toques + errores), no
 * personas: sirven para detectar partidas infinitas o absurdamente cortas, no para
 * predecir métricas reales.
 */
import { DifficultyId } from './difficulty';
import { GameRun, MAX_TICK_MS, RunResult } from './run';
import { createRng } from './rng';
import { orientationCount, stepsBetween } from './tiles';

export interface BotSkill {
  name: string;
  /** Tiempo de lectura del tablero por pieza activa (ms). */
  scanMsPerTile: number;
  /** Tiempo entre toques (ms). */
  tapMs: number;
  /** Fracción de toques de más (errores) respecto al par. */
  waste: number;
}

export const BOT_SKILLS: Record<'novice' | 'medium' | 'expert', BotSkill> = {
  novice: { name: 'novato', scanMsPerTile: 320, tapMs: 650, waste: 0.3 },
  medium: { name: 'medio', scanMsPerTile: 160, tapMs: 400, waste: 0.12 },
  expert: { name: 'experto', scanMsPerTile: 80, tapMs: 250, waste: 0.03 },
};

const canAct = (run: GameRun): boolean => run.currentStatus === 'playing' || run.currentStatus === 'ready';

function advance(run: GameRun, ms: number): void {
  let left = ms;
  while (left > 0 && run.currentStatus !== 'over') {
    const step = Math.min(left, MAX_TICK_MS / 2);
    run.tick(step);
    left -= step;
  }
}

/** Juega una partida completa y devuelve su resultado. `maxBoards` evita bucles infinitos en tests. */
export function playBot(difficulty: DifficultyId, skill: BotSkill, seed: string, maxBoards = 500): RunResult {
  const rng = createRng(`bot-${seed}`);
  const run = new GameRun({ difficulty, seed });
  while (run.currentStatus !== 'over' && run.snapshot().boardsCleared < maxBoards) {
    if (run.currentStatus === 'transition') {
      advance(run, 800);
      continue;
    }
    const board = run.snapshot().board;
    const active = board.cells.filter((m) => m !== 0).length;
    // Lectura del tablero (con la partida en "ready" el reloj aún no corre).
    advance(run, skill.scanMsPerTile * active);
    // Errores: toques sobre piezas girables al azar.
    const rotatable = board.cells.map((m, i) => (orientationCount(m) > 1 ? i : -1)).filter((i) => i >= 0);
    const wasted = Math.round(run.snapshot().par * skill.waste);
    for (let w = 0; w < wasted && canAct(run); w++) {
      advance(run, skill.tapMs);
      run.tap(rotatable[Math.floor(rng() * rotatable.length)]);
    }
    // Camino hacia la solución desde el estado actual.
    const now = run.snapshot().board;
    for (let i = 0; i < now.cells.length && canAct(run); i++) {
      const steps = stepsBetween(now.cells[i], now.target[i]) as number;
      for (let k = 0; k < steps && canAct(run); k++) {
        advance(run, skill.tapMs);
        if (!canAct(run)) break;
        run.tap(i);
      }
    }
  }
  return run.result();
}
