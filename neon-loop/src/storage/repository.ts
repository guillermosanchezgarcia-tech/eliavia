import type { KeyValueStore } from './kv';
import { sanitizeSave, sanitizeSettings } from './sanitize';
import { SaveData, Settings, defaultSave, defaultSettings } from './types';

export const SAVE_KEY = 'nl.save.v1';
export const SAVE_BACKUP_KEY = 'nl.save.v1.bak';
export const SAVE_CORRUPT_KEY = 'nl.save.v1.corrupt';
export const SETTINGS_KEY = 'nl.settings.v1';

/**
 * - fresh: primera ejecución, no había nada guardado.
 * - ok: se leyó el guardado principal.
 * - recovered: el principal faltaba o estaba dañado y se restauró la copia de seguridad.
 * - reset: ni el principal ni la copia eran legibles; se empieza de cero (el dato dañado se conserva aparte).
 * - unavailable: el almacenamiento falló al leer; se juega con datos en memoria.
 */
export type LoadStatus = 'fresh' | 'ok' | 'recovered' | 'reset' | 'unavailable';

function parse(raw: string | null): SaveData | null {
  if (raw === null) return null;
  try {
    return sanitizeSave(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function loadSave(store: KeyValueStore, now = Date.now()): Promise<{ save: SaveData; status: LoadStatus }> {
  let mainRaw: string | null;
  let backupRaw: string | null;
  try {
    mainRaw = await store.getItem(SAVE_KEY);
    backupRaw = await store.getItem(SAVE_BACKUP_KEY);
  } catch {
    return { save: defaultSave(now), status: 'unavailable' };
  }

  const main = parse(mainRaw);
  if (main) return { save: main, status: 'ok' };

  const backup = parse(backupRaw);
  if (mainRaw === null && backup === null) return { save: defaultSave(now), status: 'fresh' };

  // El principal falta o está dañado. Si estaba dañado, se conserva para diagnóstico.
  if (mainRaw !== null) {
    try {
      await store.setItem(SAVE_CORRUPT_KEY, mainRaw.slice(0, 20_000));
    } catch {
      /* no es crítico */
    }
  }
  if (backup) return { save: backup, status: 'recovered' };
  return { save: defaultSave(now), status: 'reset' };
}

export async function loadSettings(store: KeyValueStore): Promise<Settings> {
  try {
    const raw = await store.getItem(SETTINGS_KEY);
    if (raw === null) return defaultSettings();
    return sanitizeSettings(JSON.parse(raw));
  } catch {
    return defaultSettings();
  }
}

/**
 * Escritor serializado: las escrituras se encadenan para que nunca se intercalen y,
 * antes de sustituir el guardado principal, se copia el anterior a la copia de seguridad.
 * Un fallo de escritura no lanza: se refleja en el resultado para que la UI lo avise.
 */
export function createPersistence(store: KeyValueStore) {
  let chain: Promise<unknown> = Promise.resolve();
  let lastGoodRaw: string | null = null;

  const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    const run = chain.then(task, task);
    chain = run.catch(() => undefined);
    return run;
  };

  return {
    /** Informa del contenido válido actual para poder respaldarlo. */
    adoptLoaded(save: SaveData) {
      lastGoodRaw = JSON.stringify(save);
    },
    saveGame(save: SaveData): Promise<boolean> {
      return enqueue(async () => {
        try {
          const raw = JSON.stringify(save);
          if (lastGoodRaw !== null) await store.setItem(SAVE_BACKUP_KEY, lastGoodRaw);
          await store.setItem(SAVE_KEY, raw);
          lastGoodRaw = raw;
          return true;
        } catch {
          return false;
        }
      });
    },
    saveSettings(settings: Settings): Promise<boolean> {
      return enqueue(async () => {
        try {
          await store.setItem(SETTINGS_KEY, JSON.stringify(settings));
          return true;
        } catch {
          return false;
        }
      });
    },
  };
}

export type Persistence = ReturnType<typeof createPersistence>;
