import React, { memo, useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet } from 'react-native';
import { orientationCount } from '../engine/tiles';
import type { Theme } from '../theme/theme';
import { TileSvg } from './TileSvg';
import { useAnimatedValue } from './useAnimatedValue';

interface TileProps {
  index: number;
  mask: number;
  loose: number;
  glowStop: number;
  size: number;
  theme: Theme;
  label: string;
  /** Se dispara en el instante de tocar (no al soltar) para que la respuesta sea inmediata. */
  onTap: (index: number) => void;
}

const ROTATE_MS = 110;

function TileImpl({ index, mask, loose, glowStop, size, theme, label, onTap }: TileProps) {
  const rotation = useAnimatedValue(0);
  const pop = useAnimatedValue(1);
  const lastMask = useRef(mask);
  const lastLit = useRef(mask !== 0 && loose === 0);

  useEffect(() => {
    // Gira desde la orientación anterior (-90°) hasta la nueva. La pieza se dibuja siempre ya
    // en su orientación final: la animación es solo el movimiento.
    if (lastMask.current !== mask) {
      lastMask.current = mask;
      rotation.setValue(-90);
      Animated.timing(rotation, {
        toValue: 0,
        duration: ROTATE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
    const lit = mask !== 0 && loose === 0;
    if (lit && !lastLit.current) {
      pop.setValue(1);
      Animated.sequence([
        Animated.timing(pop, { toValue: 1.18, duration: 70, useNativeDriver: true }),
        Animated.spring(pop, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }),
      ]).start();
    }
    lastLit.current = lit;
  }, [mask, loose, rotation, pop]);

  const rotate = rotation.interpolate({ inputRange: [-90, 0], outputRange: ['-90deg', '0deg'] });
  const rotatable = orientationCount(mask) > 1;

  return (
    <Pressable
      onPressIn={rotatable ? () => onTap(index) : undefined}
      disabled={!rotatable}
      accessibilityRole={rotatable ? 'button' : 'image'}
      accessibilityLabel={label}
      style={{ width: size, height: size }}
    >
      <Animated.View style={[styles.fill, { transform: [{ rotate }, { scale: pop }] }]}>
        <TileSvg mask={mask} loose={loose} glowStop={glowStop} size={size} theme={theme} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

export const Tile = memo(TileImpl);
