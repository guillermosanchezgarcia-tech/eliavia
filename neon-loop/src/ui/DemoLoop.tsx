import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { N, E, S, W, rotateMask } from '../engine/tiles';
import { FONT } from '../theme/theme';
import { useTheme } from '../theme/ThemeProvider';
import { Tile } from './Tile';

/** Anillo de 2x2 esquinas: la disposición cerrada más pequeña. */
const SOLVED = [E | S, S | W, N | E, N | W];
const CELL = 64;

const looseOf = (cells: readonly number[], i: number, cols = 2): number => {
  let loose = 0;
  for (let d = 0; d < 4; d++) {
    if (!(cells[i] & (1 << d))) continue;
    const r = Math.floor(i / cols) + [-1, 0, 1, 0][d];
    const c = (i % cols) + [0, 1, 0, -1][d];
    const inside = r >= 0 && r < 2 && c >= 0 && c < cols;
    if (!inside || !(cells[r * cols + c] & (1 << ((d + 2) % 4)))) loose |= 1 << d;
  }
  return loose;
};

const glowStopOf = (cells: readonly number[], i: number, cols = 2): number => {
  if (cells[i] === 0 || looseOf(cells, i) !== 0) return 0;
  let stop = 0;
  for (let d = 0; d < 4; d++) {
    if (!(cells[i] & (1 << d))) continue;
    const r = Math.floor(i / cols) + [-1, 0, 1, 0][d];
    const c = (i % cols) + [0, 1, 0, -1][d];
    const n = r * cols + c;
    if (r < 0 || r >= 2 || c < 0 || c >= cols || looseOf(cells, n) !== 0) stop |= 1 << d;
  }
  return stop;
};

/**
 * Mini demostración en bucle de la regla, con las mismas piezas del juego: una pieza mal girada
 * deja extremos sueltos (anillos ámbar); al girarla, todo se enciende. Sustituye a un tutorial.
 */
export function DemoLoop() {
  const theme = useTheme();
  // 0 = ruptura de la pieza `broken`; 1 = resuelto.
  const [step, setStep] = useState(0);
  const [broken, setBroken] = useState(3);

  useEffect(() => {
    const id = setTimeout(
      () => {
        if (step === 0) {
          setStep(1);
        } else {
          setBroken((b) => (b + 1) % 4);
          setStep(0);
        }
      },
      step === 0 ? 1500 : 1300
    );
    return () => clearTimeout(id);
  }, [step]);

  const cells = SOLVED.map((m, i) => (i === broken && step === 0 ? rotateMask(m, 1) : m));

  return (
    <View style={styles.wrap} accessible accessibilityLabel="Demostración: gira las piezas hasta que no quede ninguna luz suelta">
      <View style={{ width: CELL * 2, height: CELL * 2, flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((mask, i) => (
          <Tile
            key={i}
            index={i}
            mask={mask}
            loose={looseOf(cells, i)}
            glowStop={glowStopOf(cells, i)}
            size={CELL}
            theme={theme}
            label=""
            onTap={() => undefined}
          />
        ))}
      </View>
      <Text style={[styles.caption, { color: theme.textDim }]}>
        Toca para girar. No dejes ninguna luz suelta.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  caption: { fontFamily: FONT.semibold, fontSize: 17, marginTop: 8, textAlign: 'center' },
});
