import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { haptics } from '../haptics/haptics';
import { sfx } from '../audio/sfx';
import { applyRunResult, RunSummary } from '../storage/records';
import { asyncStore } from '../storage/asyncStore';
import { LoadStatus, createPersistence, loadSave, loadSettings } from '../storage/repository';
import { SaveData, Settings, defaultSave, defaultSettings } from '../storage/types';

interface AppContextValue {
  ready: boolean;
  loadStatus: LoadStatus | null;
  save: SaveData;
  settings: Settings;
  /** true si la última escritura en disco falló (se avisa en pantalla de resultados). */
  persistFailed: boolean;
  updateSettings: (patch: Partial<Omit<Settings, 'version'>>) => void;
  /** Aplica una partida terminada al guardado. Devuelve el resumen, o null si la partida no era válida. */
  commitRun: (result: unknown) => RunSummary | null;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const persistence = useMemo(() => createPersistence(asyncStore), []);
  const [ready, setReady] = useState(false);
  const [loadStatus, setLoadStatus] = useState<LoadStatus | null>(null);
  const [save, setSave] = useState<SaveData>(() => defaultSave());
  const [settings, setSettings] = useState<Settings>(() => defaultSettings());
  const [persistFailed, setPersistFailed] = useState(false);

  // Referencias al último valor para que los callbacks nunca trabajen con estado obsoleto.
  const saveRef = useRef(save);
  const settingsRef = useRef(settings);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [loaded, loadedSettings] = await Promise.all([loadSave(asyncStore), loadSettings(asyncStore)]);
      if (cancelled) return;
      persistence.adoptLoaded(loaded.save);
      saveRef.current = loaded.save;
      settingsRef.current = loadedSettings;
      sfx.enabled = loadedSettings.sfx;
      haptics.enabled = loadedSettings.haptics;
      setSave(loaded.save);
      setSettings(loadedSettings);
      setLoadStatus(loaded.status);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [persistence]);

  const updateSettings = useCallback(
    (patch: Partial<Omit<Settings, 'version'>>) => {
      const next = { ...settingsRef.current, ...patch };
      settingsRef.current = next;
      sfx.enabled = next.sfx;
      haptics.enabled = next.haptics;
      setSettings(next);
      void persistence.saveSettings(next).then((ok) => setPersistFailed((prev) => (ok ? prev : true)));
    },
    [persistence]
  );

  const commitRun = useCallback(
    (result: unknown): RunSummary | null => {
      const { save: next, summary } = applyRunResult(saveRef.current, result, Date.now());
      if (!summary) return null;
      saveRef.current = next;
      setSave(next);
      void persistence.saveGame(next).then((ok) => setPersistFailed(!ok));
      return summary;
    },
    [persistence]
  );

  const value = useMemo<AppContextValue>(
    () => ({ ready, loadStatus, save, settings, persistFailed, updateSettings, commitRun }),
    [ready, loadStatus, save, settings, persistFailed, updateSettings, commitRun]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp debe usarse dentro de <AppStateProvider>');
  return ctx;
}
