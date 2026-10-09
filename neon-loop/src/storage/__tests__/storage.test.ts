import type { RunResult } from '../../engine/run';
import { createMemoryStore, KeyValueStore } from '../kv';
import { applyRunResult, validateRunResult } from '../records';
import {
  SAVE_BACKUP_KEY,
  SAVE_CORRUPT_KEY,
  SAVE_KEY,
  SETTINGS_KEY,
  createPersistence,
  loadSave,
  loadSettings,
} from '../repository';
import { sanitizeSave, sanitizeSettings, toCount } from '../sanitize';
import { LIMITS, SaveData, defaultSave, defaultSettings } from '../types';

const result = (patch: Partial<RunResult> = {}): RunResult => ({
  difficulty: 'normal',
  mode: 'free',
  seed: 's',
  score: 1200,
  boardsCleared: 5,
  taps: 80,
  parTaps: 60,
  tapsOnCleared: 70,
  perfectBoards: 2,
  maxCombo: 9,
  playMs: 61_000,
  endedBy: 'time',
  ...patch,
});

describe('sanitize', () => {
  test('toCount descarta NaN, Infinity, texto y negativos, y recorta al máximo', () => {
    expect(toCount(NaN, 100)).toBe(0);
    expect(toCount(Infinity, 100)).toBe(0);
    expect(toCount(-Infinity, 100)).toBe(0);
    expect(toCount('50', 100)).toBe(0);
    expect(toCount(null, 100)).toBe(0);
    expect(toCount(-3, 100)).toBe(0);
    expect(toCount(12.9, 100)).toBe(12);
    expect(toCount(1e12, 100)).toBe(100);
  });

  test('sanitizeSave devuelve null si no es un objeto', () => {
    for (const bad of [null, undefined, 3, 'x', [], true]) expect(sanitizeSave(bad)).toBeNull();
  });

  test('sanitizeSave conserva lo válido y reinicia solo lo corrupto', () => {
    const s = sanitizeSave({
      version: 99,
      records: {
        easy: { bestScore: 4000, bestBoards: 9, bestCombo: 14, runs: 3 },
        normal: { bestScore: 'mucho', bestBoards: -4, bestCombo: NaN, runs: 1e99 },
        expert: 'roto',
      },
      totals: { runs: 7, boards: 30, taps: 'x', playMs: 5000 },
      lastRun: { difficulty: 'tripleextreme', score: 5 },
    }) as SaveData;
    expect(s.records.easy).toEqual({ bestScore: 4000, bestBoards: 9, bestCombo: 14, runs: 3 });
    expect(s.records.normal).toEqual({ bestScore: 0, bestBoards: 0, bestCombo: 0, runs: LIMITS.totalRuns });
    expect(s.records.expert).toEqual({ bestScore: 0, bestBoards: 0, bestCombo: 0, runs: 0 });
    expect(s.totals).toEqual({ runs: 7, boards: 30, taps: 0, playMs: 5000 });
    expect(s.lastRun).toBeNull();
  });

  test('sanitizeSettings rellena lo que falta y rechaza tipos incorrectos', () => {
    expect(sanitizeSettings(null)).toEqual(defaultSettings());
    expect(sanitizeSettings({ sfx: false })).toEqual({ ...defaultSettings(), sfx: false });
    expect(sanitizeSettings({ sfx: 'no', haptics: 1, lastDifficulty: 'x' })).toEqual(defaultSettings());
    expect(sanitizeSettings({ lastDifficulty: 'expert' }).lastDifficulty).toBe('expert');
  });
});

describe('validateRunResult', () => {
  test('acepta una partida normal', () => {
    expect(validateRunResult(result())).toBe(true);
    expect(validateRunResult(result({ score: 0, taps: 0, boardsCleared: 0, perfectBoards: 0, tapsOnCleared: 0 }))).toBe(true);
  });

  test.each([
    ['puntuación NaN', { score: NaN }],
    ['puntuación Infinity', { score: Infinity }],
    ['puntuación negativa', { score: -1 }],
    ['puntuación decimal', { score: 10.5 }],
    ['puntuación absurda', { score: LIMITS.score + 1 }],
    ['dificultad desconocida', { difficulty: 'dios' as never }],
    ['modo desconocido', { mode: 'x' as never }],
    ['tableros > toques imposibles', { tapsOnCleared: 999, taps: 80 }],
    ['perfectos > tableros', { perfectBoards: 6, boardsCleared: 5 }],
    ['puntos sin toques', { score: 100, taps: 0, tapsOnCleared: 0, parTaps: 0 }],
    ['tableros sin toques', { boardsCleared: 3, taps: 0, tapsOnCleared: 0, parTaps: 0, score: 0, perfectBoards: 0 }],
    ['duración absurda', { playMs: LIMITS.playMs + 1 }],
  ])('rechaza: %s', (_name, patch) => {
    expect(validateRunResult(result(patch as Partial<RunResult>))).toBe(false);
  });

  test('rechaza valores que no son objetos', () => {
    for (const bad of [null, undefined, 5, 'x', []]) expect(validateRunResult(bad)).toBe(false);
  });
});

describe('applyRunResult', () => {
  const base = defaultSave(1);

  test('la primera partida marca récord y suma totales', () => {
    const { save, summary } = applyRunResult(base, result(), 1000);
    expect(summary).toMatchObject({ isRecord: true, previousBest: 0, best: 1200, missing: 0 });
    expect(save.records.normal).toEqual({ bestScore: 1200, bestBoards: 5, bestCombo: 9, runs: 1 });
    expect(save.totals).toEqual({ runs: 1, boards: 5, taps: 80, playMs: 61_000 });
    expect(save.lastRun).toEqual({ difficulty: 'normal', score: 1200, boardsCleared: 5, at: 1000 });
  });

  test('no muta el guardado original', () => {
    const frozen = JSON.stringify(base);
    applyRunResult(base, result(), 1000);
    expect(JSON.stringify(base)).toBe(frozen);
  });

  test('una partida peor NO baja el récord y dice cuánto faltó', () => {
    const first = applyRunResult(base, result({ score: 2000, maxCombo: 12, boardsCleared: 7 }), 1).save;
    const { save, summary } = applyRunResult(first, result({ score: 1500, maxCombo: 3, boardsCleared: 2 }), 2);
    expect(summary).toMatchObject({ isRecord: false, previousBest: 2000, best: 2000, missing: 500 });
    expect(save.records.normal.bestScore).toBe(2000);
    expect(save.records.normal.bestCombo).toBe(12);
    expect(save.records.normal.bestBoards).toBe(7);
    expect(save.records.normal.runs).toBe(2);
  });

  test('igualar el récord no cuenta como nuevo récord', () => {
    const first = applyRunResult(base, result({ score: 900 }), 1).save;
    expect(applyRunResult(first, result({ score: 900 }), 2).summary?.isRecord).toBe(false);
  });

  test('los récords de cada dificultad son independientes', () => {
    const a = applyRunResult(base, result({ difficulty: 'easy', score: 5000 }), 1).save;
    const b = applyRunResult(a, result({ difficulty: 'expert', score: 300 }), 2).save;
    expect(b.records.easy.bestScore).toBe(5000);
    expect(b.records.expert.bestScore).toBe(300);
    expect(b.records.normal.bestScore).toBe(0);
  });

  test('una partida inválida NO toca nada (ni récords ni totales)', () => {
    const good = applyRunResult(base, result({ score: 3000 }), 1).save;
    for (const bad of [result({ score: NaN }), result({ score: 9e9 }), { basura: true }, null]) {
      const out = applyRunResult(good, bad, 2);
      expect(out.summary).toBeNull();
      expect(out.save).toBe(good);
    }
  });

  test('una partida del reto diario suma totales pero no toca los récords libres', () => {
    const { save, summary } = applyRunResult(base, result({ mode: 'daily', score: 8000 }), 5);
    expect(save.records.normal.bestScore).toBe(0);
    expect(summary?.isRecord).toBe(false);
    expect(save.totals.runs).toBe(1);
  });

  test('los totales saturan en lugar de desbordar', () => {
    const near = { ...base, totals: { ...base.totals, runs: LIMITS.totalRuns } };
    expect(applyRunResult(near, result(), 1).save.totals.runs).toBe(LIMITS.totalRuns);
  });
});

describe('repositorio', () => {
  const memory = () => createMemoryStore();
  const savedWith = (score: number): SaveData => applyRunResult(defaultSave(1), result({ score }), 1).save;

  test('primera ejecución: guardado vacío y estado "fresh"', async () => {
    const { save, status } = await loadSave(memory(), 7);
    expect(status).toBe('fresh');
    expect(save).toEqual(defaultSave(7));
  });

  test('lo guardado se recupera igual (ida y vuelta)', async () => {
    const store = memory();
    const p = createPersistence(store);
    const saved = savedWith(1234);
    expect(await p.saveGame(saved)).toBe(true);
    const { save, status } = await loadSave(store);
    expect(status).toBe('ok');
    expect(save.records.normal.bestScore).toBe(1234);
  });

  test('si el principal está dañado se restaura la copia de seguridad y se conserva el dato roto', async () => {
    const store = memory();
    const p = createPersistence(store);
    p.adoptLoaded(defaultSave(0));
    await p.saveGame(savedWith(1000)); // principal=1000, copia=vacío
    await p.saveGame(savedWith(2000)); // principal=2000, copia=1000
    await store.setItem(SAVE_KEY, '{"records": ¡¡corrupto');
    const { save, status } = await loadSave(store);
    expect(status).toBe('recovered');
    expect(save.records.normal.bestScore).toBe(1000);
    expect(await store.getItem(SAVE_CORRUPT_KEY)).toContain('corrupto');
  });

  test('si principal y copia están dañados se empieza de cero sin romper', async () => {
    const store = createMemoryStore({ [SAVE_KEY]: 'zzz', [SAVE_BACKUP_KEY]: '[1,2,3]' });
    const { save, status } = await loadSave(store, 9);
    expect(status).toBe('reset');
    expect(save).toEqual(defaultSave(9));
  });

  test('si falta el principal pero hay copia, se recupera', async () => {
    const store = createMemoryStore({ [SAVE_BACKUP_KEY]: JSON.stringify(savedWith(777)) });
    const { save, status } = await loadSave(store);
    expect(status).toBe('recovered');
    expect(save.records.normal.bestScore).toBe(777);
  });

  test('un JSON válido con campos basura se sanea en lugar de romper la app', async () => {
    const store = createMemoryStore({
      [SAVE_KEY]: JSON.stringify({ records: { normal: { bestScore: 'x' }, easy: { bestScore: 55 } } }),
    });
    const { save, status } = await loadSave(store);
    expect(status).toBe('ok');
    expect(save.records.easy.bestScore).toBe(55);
    expect(save.records.normal.bestScore).toBe(0);
  });

  test('si leer falla, se juega en memoria con estado "unavailable"', async () => {
    const broken: KeyValueStore = {
      getItem: () => Promise.reject(new Error('disco')),
      setItem: () => Promise.reject(new Error('disco')),
      removeItem: () => Promise.reject(new Error('disco')),
    };
    const { save, status } = await loadSave(broken);
    expect(status).toBe('unavailable');
    expect(save.records.normal.bestScore).toBe(0);
    expect(await loadSettings(broken)).toEqual(defaultSettings());
  });

  test('si escribir falla no lanza: devuelve false para que la UI lo avise', async () => {
    const broken: KeyValueStore = {
      getItem: async () => null,
      setItem: () => Promise.reject(new Error('lleno')),
      removeItem: async () => undefined,
    };
    const p = createPersistence(broken);
    await expect(p.saveGame(savedWith(1))).resolves.toBe(false);
    await expect(p.saveSettings(defaultSettings())).resolves.toBe(false);
  });

  test('una escritura fallida no impide que las siguientes funcionen', async () => {
    let fail = true;
    const inner = createMemoryStore();
    const flaky: KeyValueStore = {
      getItem: (k) => inner.getItem(k),
      removeItem: (k) => inner.removeItem(k),
      setItem: (k, v) => (fail ? Promise.reject(new Error('x')) : inner.setItem(k, v)),
    };
    const p = createPersistence(flaky);
    expect(await p.saveGame(savedWith(10))).toBe(false);
    fail = false;
    expect(await p.saveGame(savedWith(20))).toBe(true);
    expect((await loadSave(inner)).save.records.normal.bestScore).toBe(20);
  });

  test('las escrituras concurrentes se serializan y gana la última', async () => {
    const store = memory();
    const p = createPersistence(store);
    const writes = [10, 20, 30, 40, 50].map((s) => p.saveGame(savedWith(s)));
    await Promise.all(writes);
    expect((await loadSave(store)).save.records.normal.bestScore).toBe(50);
    // La copia de seguridad es siempre la versión inmediatamente anterior.
    const backup = JSON.parse((await store.getItem(SAVE_BACKUP_KEY)) as string) as SaveData;
    expect(backup.records.normal.bestScore).toBe(40);
  });

  test('ajustes: ida y vuelta y valores corruptos', async () => {
    const store = memory();
    const p = createPersistence(store);
    await p.saveSettings({ ...defaultSettings(), sfx: false, lastDifficulty: 'expert' });
    expect(await loadSettings(store)).toMatchObject({ sfx: false, haptics: true, lastDifficulty: 'expert' });
    await store.setItem(SETTINGS_KEY, '{{{');
    expect(await loadSettings(store)).toEqual(defaultSettings());
  });
});
