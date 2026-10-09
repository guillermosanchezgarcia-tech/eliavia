import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Icon, IconName } from './icons/Icon';

interface IconButtonProps {
  name: IconName;
  label: string;
  onPress: () => void;
  active?: boolean;
  size?: number;
}

/** Botón cuadrado de icono con área táctil de 48 dp. */
export function IconButton({ name, label, onPress, active = true, size = 24 }: IconButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.base,
        { borderColor: theme.panelBorder, backgroundColor: pressed ? 'rgba(120,138,255,0.22)' : theme.panel },
      ]}
    >
      <Icon name={name} size={size} color={active ? theme.text : theme.textDim} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
