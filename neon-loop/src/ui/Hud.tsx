import React, { memo, useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import type { RunSnapshot } from '../engine/run';
import { formatNumber } from '../strings';
import { FONT } from '../theme/theme';
import { useTheme } from '../theme/ThemeProvider';
import { useAnimatedValue } from './useAnimatedValue';

/** Referencia de la barra de tiempo: a partir de aquí se muestra llena. */
const BAR_FULL_MS = 60_000;

interface HudProps {
  snap: RunSnapshot;
}

function HudImpl({ snap }: HudProps) {
  const theme = useTheme();
  const seconds = Math.ceil(snap.timeLeftMs / 1000);
  const danger = seconds <= 5;
  const warning = seconds <= 10;
  const barColor = danger ? theme.accent : warning ? theme.accent2 : theme.wireOn;
  const fill = Math.max(0, Math.min(1, snap.timeLeftMs / BAR_FULL_MS));

  // Pequeño "latido" del marcador cuando sube.
  const scoreScale = useAnimatedValue(1);
  const lastScore = useRef(snap.score);
  useEffect(() => {
    if (snap.score > lastScore.current) {
      scoreScale.setValue(1.14);
      Animated.spring(scoreScale, { toValue: 1, friction: 5, tension: 180, useNativeDriver: true }).start();
    }
    lastScore.current = snap.score;
  }, [snap.score, scoreScale]);

  // La cuenta atrás de los últimos segundos late: una señal que no depende solo del color.
  const beat = useAnimatedValue(1);
  useEffect(() => {
    if (!danger || snap.status !== 'playing') return;
    beat.setValue(1.25);
    Animated.timing(beat, { toValue: 1, duration: 420, useNativeDriver: true }).start();
  }, [seconds, danger, snap.status, beat]);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.caption, { color: theme.textDim }]}>
        TABLERO {snap.boardNumber}
      </Text>

      <View style={styles.scoreRow}>
        <Animated.Text
          accessibilityLabel={`${formatNumber(snap.score)} puntos`}
          style={[styles.score, { color: theme.text, transform: [{ scale: scoreScale }] }]}
        >
          {formatNumber(snap.score)}
        </Animated.Text>
        <View style={styles.comboSlot} accessibilityLiveRegion="polite">
          {snap.combo >= 2 ? (
            <View style={[styles.combo, { borderColor: theme.accent2 }]}>
              <Text style={[styles.comboMult, { color: theme.accent2 }]}>×{snap.multiplier}</Text>
              <Text style={[styles.comboText, { color: theme.accent2 }]}>RACHA {snap.combo}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.timeRow}>
        <Animated.Text
          accessibilityLabel={`${seconds} segundos`}
          style={[styles.time, { color: barColor, transform: [{ scale: beat }] }]}
        >
          {seconds}
        </Animated.Text>
        <View style={[styles.track, { backgroundColor: 'rgba(120,138,255,0.18)' }]}>
          <View style={[styles.bar, { width: `${fill * 100}%`, backgroundColor: barColor, boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 8, spreadDistance: 0, color: barColor }] }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20 },
  caption: { fontFamily: FONT.semibold, fontSize: 15, letterSpacing: 4, textAlign: 'center' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 64 },
  score: { fontFamily: FONT.bold, fontSize: 54, lineHeight: 60, letterSpacing: 1, textAlign: 'center' },
  comboSlot: { position: 'absolute', right: 0, top: 4 },
  combo: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 2, alignItems: 'center' },
  comboMult: { fontFamily: FONT.bold, fontSize: 24, lineHeight: 26 },
  comboText: { fontFamily: FONT.semibold, fontSize: 12, letterSpacing: 2, marginTop: -2 },
  timeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  time: { fontFamily: FONT.bold, fontSize: 30, width: 54, textAlign: 'left' },
  track: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 5 },
});

export const Hud = memo(HudImpl);
