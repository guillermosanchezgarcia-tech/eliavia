import { Redirect, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sfx } from '../audio/sfx';
import { haptics } from '../haptics/haptics';
import { useApp } from '../state/AppState';
import { getFinishedRun } from '../state/resultStore';
import { DIFFICULTY_LABEL, formatNumber, goalText } from '../strings';
import { FONT } from '../theme/theme';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from '../ui/icons/Icon';
import { NeonButton } from '../ui/NeonButton';
import { ScreenBackground } from '../ui/ScreenBackground';

/** Cuenta ascendente del marcador. Corta y sin bloquear: tocar no la espera. */
function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target <= 0) return;
    const start = Date.now();
    const id = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t >= 1) clearInterval(id);
    }, 33);
    return () => clearInterval(id);
  }, [target, durationMs]);
  return value;
}

const formatDuration = (ms: number): string => {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export default function ResultsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { persistFailed } = useApp();
  const finished = getFinishedRun();
  const score = finished?.result.score ?? 0;
  const shown = useCountUp(score);
  const celebrated = useRef(false);

  useEffect(() => {
    if (!finished?.summary?.isRecord || celebrated.current) return;
    celebrated.current = true;
    sfx.play('record');
    haptics.fire('success');
  }, [finished]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace('/');
      return true;
    });
    return () => sub.remove();
  }, [router]);

  if (!finished) return <Redirect href="/" />;

  const { result, summary, goal } = finished;
  const isRecord = !!summary?.isRecord;
  const efficiency = result.tapsOnCleared > 0 ? Math.round((result.parTaps / result.tapsOnCleared) * 100) : null;

  const stats: { label: string; value: string }[] = [
    { label: 'TABLEROS', value: String(result.boardsCleared) },
    { label: 'MEJOR RACHA', value: result.maxCombo > 0 ? `×${result.maxCombo}` : '—' },
    { label: 'EFICIENCIA', value: efficiency === null ? '—' : `${Math.min(100, efficiency)}%` },
    { label: 'TIEMPO', value: formatDuration(result.playMs) },
  ];

  return (
    <View style={styles.root}>
      <ScreenBackground />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.kicker, { color: theme.textDim }]} accessibilityRole="header">
          {result.endedBy === 'quit' ? 'PARTIDA ABANDONADA' : 'FIN DE LA PARTIDA'} · {DIFFICULTY_LABEL[result.difficulty]}
        </Text>

        {isRecord && (
          <View
            style={[
              styles.badge,
              {
                borderColor: theme.accent2,
                boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 18, spreadDistance: 0, color: theme.accent2 }],
              },
            ]}
            accessibilityLabel="Nuevo récord"
          >
            <Text style={[styles.badgeText, { color: theme.accent2 }]}>NUEVO RÉCORD</Text>
          </View>
        )}

        <Text
          accessibilityLabel={`${formatNumber(score)} puntos`}
          style={[styles.score, { color: isRecord ? theme.accent2 : theme.text, textShadowColor: isRecord ? theme.accent2 : theme.wireOn }]}
        >
          {formatNumber(shown)}
        </Text>
        <Text style={[styles.scoreLabel, { color: theme.textDim }]}>PUNTOS</Text>

        {summary && (
          <Text style={[styles.recordLine, { color: theme.textDim }]}>
            {isRecord
              ? summary.previousBest > 0
                ? `Superas tu récord anterior de ${formatNumber(summary.previousBest)}`
                : 'Es tu primera marca'
              : `Récord ${formatNumber(summary.best)}  ·  Te faltaron ${formatNumber(summary.missing)}`}
          </Text>
        )}

        <View style={styles.stats}>
          {stats.map((s) => (
            <View key={s.label} style={[styles.stat, { backgroundColor: theme.panel, borderColor: theme.panelBorder }]}>
              <Text style={[styles.statValue, { color: theme.text }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: theme.textDim }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        {goal && (
          <View style={[styles.goal, { borderColor: theme.wireOn }]}>
            <Text style={[styles.goalKicker, { color: theme.wireOn }]}>OBJETIVO PARA LA PRÓXIMA</Text>
            <Text style={[styles.goalText, { color: theme.text }]}>{goalText(goal)}</Text>
          </View>
        )}

        {persistFailed && (
          <Text style={[styles.warn, { color: theme.loose }]} accessibilityLiveRegion="polite">
            No se pudo guardar en el dispositivo. Libera espacio si quieres conservar tu progreso.
          </Text>
        )}

        <View style={styles.actions}>
          <NeonButton
            label="JUGAR DE NUEVO"
            size="large"
            icon={<Icon name="restart" size={26} color={theme.onAccent} />}
            onPress={() => router.replace({ pathname: '/play', params: { difficulty: result.difficulty } })}
          />
          <View style={styles.gap}>
            <NeonButton
              label="CAMBIAR MODO"
              variant="secondary"
              icon={<Icon name="home" size={22} color={theme.wireOn} />}
              onPress={() => router.replace('/')}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, alignItems: 'stretch' },
  kicker: { fontFamily: FONT.semibold, fontSize: 16, letterSpacing: 4, textAlign: 'center' },
  badge: { alignSelf: 'center', borderWidth: 2, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 5, marginTop: 14 },
  badgeText: { fontFamily: FONT.bold, fontSize: 18, letterSpacing: 5 },
  score: {
    fontFamily: FONT.bold,
    fontSize: 88,
    lineHeight: 96,
    textAlign: 'center',
    marginTop: 8,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 22,
  },
  scoreLabel: { fontFamily: FONT.semibold, fontSize: 16, letterSpacing: 8, textAlign: 'center', marginTop: -6 },
  recordLine: { fontFamily: FONT.semibold, fontSize: 18, textAlign: 'center', marginTop: 12 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 },
  stat: { flexGrow: 1, flexBasis: '45%', borderWidth: 1.5, borderRadius: 16, paddingVertical: 10, alignItems: 'center' },
  statValue: { fontFamily: FONT.bold, fontSize: 30, lineHeight: 34 },
  statLabel: { fontFamily: FONT.semibold, fontSize: 13, letterSpacing: 3 },
  goal: { borderWidth: 1.5, borderRadius: 16, padding: 14, marginTop: 18, alignItems: 'center' },
  goalKicker: { fontFamily: FONT.semibold, fontSize: 13, letterSpacing: 3 },
  goalText: { fontFamily: FONT.bold, fontSize: 22, textAlign: 'center', marginTop: 2 },
  warn: { fontFamily: FONT.semibold, fontSize: 15, textAlign: 'center', marginTop: 14 },
  actions: { marginTop: 24 },
  gap: { marginTop: 12 },
});
