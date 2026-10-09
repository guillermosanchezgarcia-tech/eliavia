import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';

/** Fondo oscuro con un resplandor superior. Se dibuja una sola vez, sin animación. */
export function ScreenBackground() {
  const theme = useTheme();
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.bg }]} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="top" cx="50%" cy="-5%" rx="95%" ry="62%" fx="50%" fy="-5%">
            <Stop offset="0" stopColor={theme.bgGlow} stopOpacity={0.95} />
            <Stop offset="1" stopColor={theme.bg} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="bottom" cx="50%" cy="108%" rx="80%" ry="40%" fx="50%" fy="108%">
            <Stop offset="0" stopColor={theme.accent} stopOpacity={0.16} />
            <Stop offset="1" stopColor={theme.bg} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#top)" />
        <Rect width="100%" height="100%" fill="url(#bottom)" />
      </Svg>
    </View>
  );
}
