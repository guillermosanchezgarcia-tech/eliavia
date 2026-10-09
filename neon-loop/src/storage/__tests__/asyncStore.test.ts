jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RunResult } from '../../engine/run';
import { asyncStore } from '../asyncStore';
import { applyRunResult } from '../records';
import { SAVE_KEY, createPersistence, loadSave } from '../repository';
import { defaultSave } from '../types';

const result: RunResult = {
  difficulty: 'easy', mode: 'free', seed: 'x', score: 777, boardsCleared: 3, taps: 30, parTaps: 25,
  tapsOnCleared: 28, perfectBoards: 1, maxCombo: 6, playMs: 50_000, endedBy: 'time',
};

describe('asyncStore (cableado con AsyncStorage)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('guarda y recupera el progreso a través de AsyncStorage', async () => {
    const persistence = createPersistence(asyncStore);
    const { save } = applyRunResult(defaultSave(1), result, 5);
    expect(await persistence.saveGame(save)).toBe(true);
    expect(await AsyncStorage.getItem(SAVE_KEY)).toContain('777');

    const loaded = await loadSave(asyncStore);
    expect(loaded.status).toBe('ok');
    expect(loaded.save.records.easy.bestScore).toBe(777);
  });

  test('sin datos previos arranca de cero', async () => {
    expect((await loadSave(asyncStore)).status).toBe('fresh');
  });
});
