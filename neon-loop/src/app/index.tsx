import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sfx } from '../audio/sfx';
import { DIFFICULTY_IDS, DifficultyId } from '../engine/difficulty';
import { useApp } from '../state/AppState';
import { APP_NAME, DIFFICULTY_HINT, DIFFICULTY_LABEL, formatNumber } from '../strings';
import { FONT } from '../theme/theme';
import { useTheme } from '../theme/ThemeProvider';
import { DemoLoop } from '../ui/DemoLoop';
import { IconButton } from '../ui/IconButton';
import { Icon } from '../ui/icons/Icon';
import { Logo } from '../ui/Logo';
import { NeonButton } from '../ui/NeonButton';
import { ScreenBackground } from '../ui/ScreenBackground';

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { save, settings, updateSettings, loadStatus } = useApp();
  const [difficulty, setDifficulty] = useState<DifficultyId>(settings.lastDifficulty);
  const compact = height < 700;

  // Prepara el audio mientras el jugador mira el menú, para que el primer toque ya suene sin retraso.
  useEffect(() => {
    const id = setTimeout(() => sfx.prepare(), 500);
    return () => clearTimeout(id);
  }, []);

  const play = () => {
    updateSettings({ lastDifficulty: difficulty });
    router.push({ pathname: '/play', params: { difficulty } });
  };

  const record = save.records[difficulty].bestScore;
  const notice =
    loadStatus === 'recovered'
      ? 'Se restauró tu progreso desde una copia de seguridad.'
      : loadStatus === 'reset'
        ? 'No se pudo leer el progreso guardado y se ha empezado de cero.'
        : loadStatus === 'unavailable'
          ? 'No se puede guardar en este dispositivo: el progreso no se conservará.'
          : null;

  return (
    <View style={styles.root}>
      <ScreenBackground />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <IconButton
            name={settings.sfx ? 'sound' : 'soundOff'}
            label={settings.sfx ? 'Desactivar sonido' : 'Activar sonido'}
            active={settings.sfx}
            onPress={() => updateSettings({ sfx: !settings.sfx })}
          />
          <IconButton
            name={settings.haptics ? 'vibrate' : 'vibrateOff'}
            label={settings.haptics ? 'Desactivar vibración' : 'Activar vibración'}
            active={settings.haptics}
            onPress={() => updateSettings({ haptics: !settings.haptics })}
          />
        </View>

        <View style={styles.logo}>
          <Logo compact={compact} />
          <Text style={[styles.tagline, { color: theme.textDim }]}>Cierra el circuito</Text>
        </View>

        <View style={styles.demo}>
          <DemoLoop />
        </View>

        <View style={styles.play}>
          <NeonButton
            label="JUGAR"
            size="large"
            icon={<Icon name="play" size={30} color={theme.onAccent} />}
            accessibilityHint={`Empieza una partida en dificultad ${DIFFICULTY_LABEL[difficulty]}`}
            onPress={play}
          />
        </View>

        <View accessibilityRole="radiogroup" style={styles.difficulties}>
          {DIFFICULTY_IDS.map((id) => {
            const selected = id === difficulty;
            const best = save.records[id].bestScore;
            return (
              <Pressable
                key={id}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${DIFFICULTY_LABEL[id]}. ${DIFFICULTY_HINT[id]}. ${
                  best > 0 ? `Récord ${formatNumber(best)}` : 'Sin récord todavía'
                }`}
                onPress={() => setDifficulty(id)}
                style={[
                  styles.diff,
                  {
                    borderColor: selected ? theme.wireOn : theme.panelBorder,
                    backgroundColor: selected ? 'rgba(45,244,255,0.12)' : theme.panel,
                    boxShadow: selected ? [{ offsetX: 0, offsetY: 0, blurRadius: 14, spreadDistance: 0, color: theme.wireOn }] : undefined,
                  },
                ]}
              >
                <Text style={[styles.diffLabel, { color: selected ? theme.wireOn : theme.text }]}>{DIFFICULTY_LABEL[id]}</Text>
                <Text style={[styles.diffBest, { color: theme.textDim }]}>{best > 0 ? formatNumber(best) : '—'}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.recordLine, { color: theme.textDim }]}>
          {DIFFICULTY_HINT[difficulty]}
          {record > 0 ? `  ·  Récord ${formatNumber(record)}` : '  ·  Aún sin récord'}
        </Text>

        {notice ? (
          <View style={[styles.notice, { borderColor: theme.loose }]} accessibilityLiveRegion="polite">
            <Text style={[styles.noticeText, { color: theme.loose }]}>{notice}</Text>
          </View>
        ) : null}

        <Text style={[styles.version, { color: theme.textDim }]}>{APP_NAME} · v0.1</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, alignItems: 'stretch', flexGrow: 1 },
  topRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  logo: { alignItems: 'center', marginTop: 4 },
  tagline: { fontFamily: FONT.semibold, fontSize: 20, letterSpacing: 5, marginTop: 4 },
  demo: { alignItems: 'center', marginTop: 20 },
  play: { marginTop: 24 },
  difficulties: { flexDirection: 'row', gap: 10, marginTop: 22 },
  diff: {
    flex: 1,
    minHeight: 68,
    borderWidth: 1.5,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  diffLabel: { fontFamily: FONT.bold, fontSize: 18, letterSpacing: 2 },
  diffBest: { fontFamily: FONT.semibold, fontSize: 16, marginTop: 1 },
  recordLine: { fontFamily: FONT.semibold, fontSize: 16, textAlign: 'center', marginTop: 12 },
  notice: { borderWidth: 1.5, borderRadius: 12, padding: 10, marginTop: 16 },
  noticeText: { fontFamily: FONT.semibold, fontSize: 15, textAlign: 'center' },
  version: { fontFamily: FONT.semibold, fontSize: 13, textAlign: 'center', marginTop: 'auto', paddingTop: 20, opacity: 0.6 },
});
