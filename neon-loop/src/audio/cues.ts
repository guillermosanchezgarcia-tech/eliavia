import type { RunEvent } from '../engine/run';

export type SoundId =
  | 'tap'
  | 'lock0'
  | 'lock1'
  | 'lock2'
  | 'lock3'
  | 'lock4'
  | 'lock5'
  | 'lock6'
  | 'lock7'
  | 'clear'
  | 'record'
  | 'over'
  | 'warn'
  | 'ui';

export type HapticId = 'light' | 'medium' | 'success' | 'warning';

export interface Cue {
  sound: SoundId | null;
  haptic: HapticId | null;
}

const LADDER_TOP = 7;

/** Nota de la escalera para una racha: sube con cada encendido seguido hasta el tope. */
export function ladderSound(combo: number): SoundId {
  const i = Math.max(0, Math.min(LADDER_TOP, combo - 1));
  return `lock${i}` as SoundId;
}

/**
 * Traduce los eventos del motor a la respuesta sensorial. Función pura:
 * un toque produce como máximo UN sonido (el más importante) para no saturar.
 * Prioridad: cierre de tablero > encendido > giro simple.
 */
export function cuesFor(events: readonly RunEvent[]): Cue[] {
  const cues: Cue[] = [];
  const has = <T extends RunEvent['type']>(type: T) =>
    events.find((e): e is Extract<RunEvent, { type: T }> => e.type === type);

  const clear = has('clear');
  const lock = has('lock');
  const relock = has('relock');
  const rotate = has('rotate');
  const warn = has('warn');
  const over = has('over');

  if (clear) cues.push({ sound: 'clear', haptic: 'success' });
  else if (lock) cues.push({ sound: ladderSound(lock.combo), haptic: 'medium' });
  else if (relock) cues.push({ sound: 'lock0', haptic: 'light' });
  else if (rotate) cues.push({ sound: 'tap', haptic: 'light' });

  if (warn) cues.push({ sound: 'warn', haptic: null });
  if (over) cues.push({ sound: 'over', haptic: 'warning' });
  return cues;
}
