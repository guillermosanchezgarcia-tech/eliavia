import { useKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { playFeedback } from '../audio/feedback';
import { DIFFICULTY_IDS, DifficultyId } from '../engine/difficulty';
import { GameRun, RunEvent } from '../engine/run';
import { nextGoal } from '../progress/goals';
import { useApp } from '../state/AppState';
import { setFinishedRun } from '../state/resultStore';
import { FONT } from '../theme/theme';
import { useTheme } from '../theme/ThemeProvider';
import { Board, FloatingItem } from '../ui/Board';
import { Hud } from '../ui/Hud';
import { IconButton } from '../ui/IconButton';
import { PauseOverlay } from '../ui/PauseOverlay';
import { ScreenBackground } from '../ui/ScreenBackground';

/** Tiempo que se deja ver el aviso de fin antes de pasar a los resultados. */
const END_DELAY_MS = 1100;
const TICK_MS = 100;
const MAX_FLOATING = 6;
/** Alto reservado fuera del tablero: cabecera + marcador + barra de tiempo + pista inferior. */
const CHROME_HEIGHT = 190;

const isDifficulty = (x: unknown): x is DifficultyId => DIFFICULTY_IDS.includes(x as DifficultyId);

const makeSeed = (): string => `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;

/** Contenedor: permite reiniciar la partida remontando `PlayRun` con una clave nueva. */
export default function PlayScreen() {
  const params = useLocalSearchParams<{ difficulty?: string }>();
  const difficulty: DifficultyId = isDifficulty(params.difficulty) ? params.difficulty : 'normal';
  const [attempt, setAttempt] = useState(0);
  return <PlayRun key={`${difficulty}-${attempt}`} difficulty={difficulty} onRestart={() => setAttempt((a) => a + 1)} />;
}

function PlayRun({ difficulty, onRestart }: { difficulty: DifficultyId; onRestart: () => void }) {
  useKeepAwake();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { settings, updateSettings, commitRun } = useApp();

  const [run] = useState(() => new GameRun({ difficulty, seed: makeSeed() }));
  // Gancho SOLO para pruebas E2E: Metro sustituye la variable en la compilación y, sin ella,
  // esta rama desaparece del paquete de producción.
  useEffect(() => {
    if (process.env.EXPO_PUBLIC_E2E === '1') (globalThis as { __nl?: { run: GameRun } }).__nl = { run };
  }, [run]);

  const [snap, setSnap] = useState(() => run.snapshot());
  const [paused, setPaused] = useState(false);
  const [floating, setFloating] = useState<FloatingItem[]>([]);
  const [clearPulse, setClearPulse] = useState(0);
  const [ended, setEnded] = useState(false);

  const lastTick = useRef(0);
  const finished = useRef(false);
  const floatId = useRef(1);
  const endTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sync = useCallback(() => setSnap(run.snapshot()), [run]);

  const addFloating = useCallback((item: Omit<FloatingItem, 'id'>) => {
    setFloating((list) => [...list.slice(-(MAX_FLOATING - 1)), { ...item, id: floatId.current++ }]);
  }, []);

  const removeFloating = useCallback((id: number) => {
    setFloating((list) => list.filter((f) => f.id !== id));
  }, []);

  /** Cierra la partida: guarda el resultado y, tras una pausa breve, muestra los resultados. */
  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    setEnded(true);
    const result = run.result();
    const summary = commitRun(result);
    setFinishedRun({ result, summary, goal: summary ? nextGoal(result, summary) : null });
    endTimer.current = setTimeout(() => router.replace('/results'), END_DELAY_MS);
  }, [run, commitRun, router]);

  const handleEvents = useCallback(
    (events: RunEvent[]) => {
      playFeedback(events);
      for (const e of events) {
        if (e.type === 'lock' && e.points > 0) {
          addFloating({ index: e.indices[0], text: `+${e.points}` });
        } else if (e.type === 'clear') {
          setClearPulse((n) => n + 1);
          const seconds = (e.info.timeBonusMs / 1000).toFixed(1).replace('.', ',');
          addFloating({ index: 0, big: true, text: `+${e.info.bonusPoints}   +${seconds} s` });
        } else if (e.type === 'over') {
          finish();
        }
      }
    },
    [addFloating, finish]
  );

  const onTap = useCallback(
    (index: number) => {
      const events = run.tap(index);
      if (events.length === 0) return;
      handleEvents(events);
      sync();
    },
    [run, handleEvents, sync]
  );

  // Reloj de la partida. El motor decide qué hacer con el tiempo según su estado.
  useEffect(() => {
    lastTick.current = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const dt = now - lastTick.current;
      lastTick.current = now;
      const events = run.tick(dt);
      if (events.length > 0) handleEvents(events);
      const status = run.currentStatus;
      if (status === 'playing' || status === 'transition' || events.length > 0) sync();
    }, TICK_MS);
    return () => clearInterval(id);
  }, [run, handleEvents, sync]);

  const pause = useCallback(() => {
    if (finished.current || run.currentStatus === 'over') return;
    run.pause();
    setPaused(true);
    sync();
  }, [run, sync]);

  const resume = useCallback(() => {
    run.resume();
    lastTick.current = Date.now();
    setPaused(false);
    sync();
  }, [run, sync]);

  // El botón atrás del sistema pausa (y, estando en pausa, reanuda); nunca expulsa de golpe.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (finished.current) return true;
      if (paused) resume();
      else pause();
      return true;
    });
    return () => sub.remove();
  }, [paused, pause, resume]);

  // Salir de la app o apagar la pantalla pausa la partida: no se pierde tiempo ni se castiga.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') pause();
    });
    return () => sub.remove();
  }, [pause]);

  useEffect(
    () => () => {
      if (endTimer.current) clearTimeout(endTimer.current);
    },
    []
  );

  /** Registra lo jugado hasta ahora (si hubo juego real) antes de reiniciar o salir. */
  const settleAndThen = useCallback(
    (next: () => void) => {
      if (!finished.current) {
        finished.current = true;
        const result = run.abandon();
        if (result) commitRun(result);
      }
      next();
    },
    [run, commitRun]
  );

  const restart = useCallback(() => settleAndThen(onRestart), [settleAndThen, onRestart]);
  const exit = useCallback(() => settleAndThen(() => router.replace('/')), [settleAndThen, router]);

  // Tamaño de celda: lo que quepa en ancho y en alto, sin pasar de un tamaño cómodo de dedo.
  const board = snap.board;
  const availW = Math.min(width, 520) - 28;
  const availH = height - insets.top - insets.bottom - CHROME_HEIGHT;
  const cell = Math.max(36, Math.floor(Math.min(availW / board.cols, availH / board.rows, 92)));

  return (
    <View style={styles.root}>
      <ScreenBackground />
      <View style={[styles.column, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.header}>
          <Hud snap={snap} />
          <View style={[styles.pauseBtn, { top: 2 }]}>
            <IconButton name="pause" label="Pausar" onPress={pause} />
          </View>
        </View>

        <View style={styles.boardArea}>
          <Board
            board={board}
            boardKey={snap.boardNumber}
            cell={cell}
            theme={theme}
            onTap={onTap}
            clearPulse={clearPulse}
            floating={floating}
            onFloatingDone={removeFloating}
          />
        </View>

        <View style={styles.hint} accessibilityLiveRegion="polite">
          {snap.status === 'ready' ? (
            <Text style={[styles.hintText, { color: theme.textDim }]}>
              Toca una pieza para girarla. El tiempo empieza con tu primer toque.
            </Text>
          ) : snap.status === 'transition' ? (
            <Text style={[styles.hintText, { color: theme.accent2 }]}>¡TABLERO CERRADO!</Text>
          ) : null}
        </View>
      </View>

      {paused && !ended && (
        <PauseOverlay
          sfxOn={settings.sfx}
          hapticsOn={settings.haptics}
          onResume={resume}
          onRestart={restart}
          onExit={exit}
          onToggleSfx={() => updateSettings({ sfx: !settings.sfx })}
          onToggleHaptics={() => updateSettings({ haptics: !settings.haptics })}
        />
      )}

      {ended && (
        <View style={styles.endBanner} pointerEvents="none" accessibilityLiveRegion="assertive">
          <Text style={[styles.endText, { color: theme.text, textShadowColor: theme.accent }]}>TIEMPO</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  column: { flex: 1, alignItems: 'stretch' },
  header: { position: 'relative' },
  pauseBtn: { position: 'absolute', left: 14 },
  boardArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hint: { minHeight: 52, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  hintText: { fontFamily: FONT.semibold, fontSize: 18, textAlign: 'center' },
  endBanner: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(3,4,12,0.55)',
  },
  endText: {
    fontFamily: FONT.bold,
    fontSize: 64,
    letterSpacing: 12,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 22,
  },
});
