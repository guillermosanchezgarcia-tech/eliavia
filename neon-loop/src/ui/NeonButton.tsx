import React from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { sfx } from '../audio/sfx';
import { FONT } from '../theme/theme';
import { useTheme } from '../theme/ThemeProvider';
import { useAnimatedValue } from './useAnimatedValue';

interface NeonButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'large' | 'medium';
  icon?: React.ReactNode;
  accessibilityHint?: string;
  disabled?: boolean;
  silent?: boolean;
}

/** Botón grande (≥ 56 dp de alto) con brillo de neón y respuesta táctil inmediata. */
export function NeonButton({
  label,
  onPress,
  variant = 'primary',
  size = 'medium',
  icon,
  accessibilityHint,
  disabled,
  silent,
}: NeonButtonProps) {
  const theme = useTheme();
  const scale = useAnimatedValue(1);
  const large = size === 'large';

  const press = (to: number) =>
    Animated.timing(scale, { toValue: to, duration: 70, useNativeDriver: true }).start();

  const palette = {
    primary: { bg: theme.accent, border: theme.accent, text: theme.onAccent, glow: theme.accent },
    secondary: { bg: 'rgba(45,244,255,0.10)', border: theme.wireOn, text: theme.wireOn, glow: theme.wireOn },
    ghost: { bg: 'transparent', border: theme.panelBorder, text: theme.textDim, glow: 'transparent' },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPressIn={() => press(0.96)}
      onPressOut={() => press(1)}
      onPress={() => {
        if (!silent) sfx.play('ui');
        onPress();
      }}
    >
      <Animated.View
        style={[
          styles.base,
          {
            minHeight: large ? 72 : 56,
            backgroundColor: palette.bg,
            borderColor: palette.border,
            opacity: disabled ? 0.45 : 1,
            transform: [{ scale }],
            boxShadow: variant === 'ghost' ? undefined : [{ offsetX: 0, offsetY: 0, blurRadius: large ? 26 : 16, spreadDistance: 0, color: palette.glow }],
          },
        ]}
      >
        {icon ? <View style={styles.icon}>{icon}</View> : null}
        <Text style={[styles.label, { color: palette.text, fontSize: large ? 32 : 20 }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 18,
    borderWidth: 2,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  icon: { marginRight: 10 },
  label: { fontFamily: FONT.bold, letterSpacing: 3 },
});
