/**
 * Textos de la interfaz (español). Centralizados para poder traducir más adelante y para
 * poder cambiar el nombre comercial en un solo sitio.
 */
import type { Goal } from './progress/goals';
import type { DifficultyId } from './engine/difficulty';

/** Nombre de trabajo. Ya existen otras apps llamadas "Neon Loop": revisar antes de publicar. */
export const APP_NAME = 'NEON LOOP';

export const DIFFICULTY_LABEL: Record<DifficultyId, string> = {
  easy: 'FÁCIL',
  normal: 'NORMAL',
  expert: 'EXPERTO',
};

export const DIFFICULTY_HINT: Record<DifficultyId, string> = {
  easy: 'Tableros pequeños',
  normal: 'El punto justo',
  expert: 'Tableros grandes',
};

export const formatNumber = (n: number): string => Math.round(n).toLocaleString('es-ES');

export function goalText(goal: Goal): string {
  switch (goal.kind) {
    case 'firstRun':
      return `Consigue ${formatNumber(goal.target)} puntos`;
    case 'beatRecord':
      return `Supera los ${formatNumber(goal.target)} puntos`;
    case 'almostRecord':
      return `Te faltaron ${formatNumber(goal.missing)} puntos para tu récord`;
    case 'boards':
      return `Cierra ${goal.target} tableros`;
    case 'perfectBoard':
      return 'Cierra un tablero sin ningún giro de más';
    case 'combo':
      return `Encadena una racha de ${goal.target} encendidos`;
  }
}
