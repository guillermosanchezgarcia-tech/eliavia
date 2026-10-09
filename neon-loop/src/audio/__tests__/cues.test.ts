import type { ClearInfo, RunEvent } from '../../engine/run';
import { cuesFor, ladderSound } from '../cues';

const clearInfo: ClearInfo = {
  boardNumber: 1, tiles: 8, par: 9, taps: 9, efficiency: 1, perfect: true,
  bonusPoints: 170, timeBonusMs: 4000, solveMs: 5000, circuits: 1,
};

describe('escalera de sonidos', () => {
  test('sube una nota por cada encendido seguido y se queda en la más aguda', () => {
    expect(ladderSound(1)).toBe('lock0');
    expect(ladderSound(2)).toBe('lock1');
    expect(ladderSound(8)).toBe('lock7');
    expect(ladderSound(50)).toBe('lock7');
    expect(ladderSound(0)).toBe('lock0');
  });
});

describe('cuesFor', () => {
  test('un giro simple suena a "tap" con vibración ligera', () => {
    expect(cuesFor([{ type: 'rotate', index: 3 }])).toEqual([{ sound: 'tap', haptic: 'light' }]);
  });

  test('un encendido suena a la nota de la racha y no al "tap"', () => {
    const events: RunEvent[] = [
      { type: 'rotate', index: 1 },
      { type: 'lock', indices: [1], combo: 3, multiplier: 1, points: 10 },
    ];
    expect(cuesFor(events)).toEqual([{ sound: 'lock2', haptic: 'medium' }]);
  });

  test('cerrar el tablero tiene prioridad sobre el encendido (un solo sonido por toque)', () => {
    const events: RunEvent[] = [
      { type: 'rotate', index: 1 },
      { type: 'lock', indices: [1], combo: 6, multiplier: 2, points: 20 },
      { type: 'clear', info: clearInfo },
    ];
    const cues = cuesFor(events);
    expect(cues).toEqual([{ sound: 'clear', haptic: 'success' }]);
  });

  test('volver a encender una pieza suena suave y sin puntos', () => {
    expect(cuesFor([{ type: 'rotate', index: 1 }, { type: 'relock', indices: [1] }])).toEqual([
      { sound: 'lock0', haptic: 'light' },
    ]);
  });

  test('el aviso de tiempo y el fin de partida añaden su sonido', () => {
    expect(cuesFor([{ type: 'warn', secondsLeft: 3 }])).toEqual([{ sound: 'warn', haptic: null }]);
    expect(cuesFor([{ type: 'over' }])).toEqual([{ sound: 'over', haptic: 'warning' }]);
  });

  test('un toque sobre una pieza bloqueada o sin eventos no suena', () => {
    expect(cuesFor([{ type: 'blocked', index: 0 }])).toEqual([]);
    expect(cuesFor([])).toEqual([]);
  });
});
