import type { Goal } from '../progress/goals';
import type { RunResult } from '../engine/run';
import type { RunSummary } from '../storage/records';

/**
 * Traspaso en memoria entre la pantalla de partida y la de resultados. Evita pasar números por
 * parámetros de ruta (frágil) y no se persiste: el histórico real vive en el guardado.
 */
export interface FinishedRun {
  result: RunResult;
  /** null si la partida no superó la validación (no se tocó el guardado). */
  summary: RunSummary | null;
  goal: Goal | null;
}

let current: FinishedRun | null = null;

export const setFinishedRun = (run: FinishedRun | null): void => {
  current = run;
};

export const getFinishedRun = (): FinishedRun | null => current;
