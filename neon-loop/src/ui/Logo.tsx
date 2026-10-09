import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';
import { APP_NAME } from '../strings';
import { FONT } from '../theme/theme';
import { useTheme } from '../theme/ThemeProvider';

/** Marca: un circuito cuadrado cerrado con un rombo magenta dentro. Dibujada en SVG, sin imágenes. */
export function LogoMark({ size = 96 }: { size?: number }) {
  const theme = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Rect x={14} y={14} width={92} height={92} rx={28} stroke={theme.wireOn} strokeWidth={20} opacity={0.2} fill="none" />
      <Rect x={14} y={14} width={92} height={92} rx={28} stroke={theme.wireOn} strokeWidth={8} fill="none" />
      <Rect
        x={38}
        y={38}
        width={44}
        height={44}
        rx={12}
        stroke={theme.accent}
        strokeWidth={7}
        fill="none"
        transform="rotate(45 60 60)"
      />
      <Circle cx={30} cy={14} r={8} fill={theme.wireOn} />
      <Circle cx={90} cy={106} r={8} fill={theme.wireOn} />
      <Circle cx={60} cy={60} r={7} fill={theme.accent2} />
    </Svg>
  );
}

export function Logo({ compact }: { compact?: boolean }) {
  const theme = useTheme();
  const [first, second] = APP_NAME.split(' ');
  return (
    <View style={styles.wrap} accessible accessibilityRole="header" accessibilityLabel={APP_NAME}>
      {!compact && <LogoMark size={92} />}
      <Text style={[styles.word, { color: theme.wireOn, textShadowColor: theme.wireOn }]}>{first}</Text>
      <Text style={[styles.word, styles.second, { color: theme.accent, textShadowColor: theme.accent }]}>{second}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  word: {
    fontFamily: FONT.bold,
    fontSize: 54,
    lineHeight: 56,
    letterSpacing: 10,
    paddingLeft: 10,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  second: { marginTop: -6 },
});
