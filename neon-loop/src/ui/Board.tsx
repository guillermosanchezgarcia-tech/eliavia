import React, { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Board as BoardModel, looseEnds, neighborIndex } from '../engine/board';
import { tileKind } from '../engine/tiles';
import type { Theme } from '../theme/theme';
import { FONT } from '../theme/theme';
import { Tile } from './Tile';
import { useAnimatedValue } from './useAnimatedValue';

export interface FloatingItem {
  id: number;
  index: number;
  text: string;
  big?: boolean;
}

interface BoardProps {
  board: BoardModel;
  /** Cambia con cada tablero nuevo: remonta las piezas (sin animar el estado inicial). */
  boardKey: number;
  cell: number;
  theme: Theme;
  onTap: (index: number) => void;
  /** Se incrementa al cerrar un tablero para disparar la onda de luz. */
  clearPulse: number;
  floating: readonly FloatingItem[];
  onFloatingDone: (id: number) => void;
}

const KIND_LABEL: Record<string, string> = {
  empty: 'vacía',
  cap: 'terminal',
  line: 'recta',
  corner: 'esquina',
  tee: 'T',
  cross: 'cruce',
};

function FloatingText({
  item,
  x,
  y,
  theme,
  onDone,
}: {
  item: FloatingItem;
  x: number;
  y: number;
  theme: Theme;
  onDone: (id: number) => void;
}) {
  const progress = useAnimatedValue(0);
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: item.big ? 900 : 650,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => onDone(item.id));
  }, [progress, item.id, item.big, onDone]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, item.big ? -46 : -32] });
  const opacity = progress.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 1, 0] });
  return (
    <Animated.Text
      pointerEvents="none"
      style={[
        styles.floating,
        {
          left: x - 60,
          top: y - 14,
          opacity,
          transform: [{ translateY }],
          color: item.big ? theme.accent2 : theme.wireOn,
          fontSize: item.big ? 30 : 20,
          textShadowColor: item.big ? theme.accent2 : theme.wireOn,
        },
      ]}
    >
      {item.text}
    </Animated.Text>
  );
}

function BoardImpl({ board, boardKey, cell, theme, onTap, clearPulse, floating, onFloatingDone }: BoardProps) {
  const width = board.cols * cell;
  const height = board.rows * cell;

  // Entrada de cada tablero nuevo.
  const enter = useAnimatedValue(1);
  const lastKey = useRef(boardKey);
  useEffect(() => {
    if (lastKey.current === boardKey) return;
    lastKey.current = boardKey;
    enter.setValue(0);
    Animated.timing(enter, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [boardKey, enter]);

  // Onda de luz al cerrar el tablero.
  const burst = useAnimatedValue(1);
  const lastPulse = useRef(clearPulse);
  useEffect(() => {
    if (lastPulse.current === clearPulse) return;
    lastPulse.current = clearPulse;
    burst.setValue(0);
    Animated.timing(burst, { toValue: 1, duration: 620, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [clearPulse, burst]);

  const looseMasks = useMemo(() => board.cells.map((_, i) => looseEnds(board, i)), [board]);

  // Para cada pieza, los lados cuyo vecino no está encendido: ahí el halo se detiene antes del borde.
  const glowStops = useMemo(
    () =>
      board.cells.map((mask, i) => {
        if (mask === 0 || looseMasks[i] !== 0) return 0;
        let stop = 0;
        for (let d = 0; d < 4; d++) {
          if (!(mask & (1 << d))) continue;
          const n = neighborIndex(board, i, d);
          if (n < 0 || board.cells[n] === 0 || looseMasks[n] !== 0) stop |= 1 << d;
        }
        return stop;
      }),
    [board, looseMasks]
  );

  const labels = useMemo(
    () =>
      board.cells.map((m, i) => {
        const r = Math.floor(i / board.cols) + 1;
        const c = (i % board.cols) + 1;
        const kind = KIND_LABEL[tileKind(m)];
        if (m === 0) return `Casilla vacía, fila ${r}, columna ${c}`;
        const state = looseMasks[i] === 0 ? 'encendida' : 'apagada';
        return `Pieza ${kind}, fila ${r}, columna ${c}, ${state}. Toca para girar`;
      }),
    [board, looseMasks]
  );

  const ringScale = burst.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1.5] });
  const ringOpacity = burst.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.9, 0] });

  return (
    <View style={{ width, height }}>
      <Animated.View
        style={{
          width,
          height,
          opacity: enter,
          transform: [{ scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
        }}
      >
        <View style={styles.grid}>
          {board.cells.map((mask, i) => (
            <Tile
              key={`${boardKey}:${i}`}
              index={i}
              mask={mask}
              loose={looseMasks[i]}
              glowStop={glowStops[i]}
              size={cell}
              theme={theme}
              label={labels[i]}
              onTap={onTap}
            />
          ))}
        </View>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.ring,
          {
            width: Math.max(width, height) * 0.9,
            height: Math.max(width, height) * 0.9,
            borderRadius: Math.max(width, height),
            left: width / 2 - (Math.max(width, height) * 0.9) / 2,
            top: height / 2 - (Math.max(width, height) * 0.9) / 2,
            borderColor: theme.wireOn,
            opacity: ringOpacity,
            transform: [{ scale: ringScale }],
          },
        ]}
      />

      {floating.map((item) => {
        const col = item.index % board.cols;
        const row = Math.floor(item.index / board.cols);
        const x = item.big ? width / 2 : col * cell + cell / 2;
        const y = item.big ? height / 2 : row * cell + cell / 2;
        return <FloatingText key={item.id} item={item} x={x} y={y} theme={theme} onDone={onFloatingDone} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  ring: { position: 'absolute', borderWidth: 3 },
  floating: {
    position: 'absolute',
    width: 120,
    textAlign: 'center',
    fontFamily: FONT.bold,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
});

export const Board = memo(BoardImpl);
