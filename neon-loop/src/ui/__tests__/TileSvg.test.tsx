import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { E, N, S, W } from '../../engine/tiles';
import { NEON_THEME } from '../../theme/theme';
import { TileSvg, wirePath } from '../TileSvg';

describe('wirePath', () => {
  test('una recta N-S es un único segmento vertical que cruza el centro', () => {
    expect(wirePath(N | S, 0)).toBe('M50 0 L50 100');
  });

  test('una recta E-O es un único segmento horizontal', () => {
    expect(wirePath(E | W, 0)).toBe('M100 50 L0 50');
  });

  test('un extremo suelto se queda corto, el conectado llega al borde', () => {
    expect(wirePath(N | S, N)).toBe('M50 19 L50 100');
    expect(wirePath(N | S, N | S)).toBe('M50 19 L50 81');
  });

  test('una esquina pasa por una curva cuadrática con control en el centro', () => {
    const d = wirePath(N | E, 0);
    expect(d).toContain('Q50 50');
    expect(d.startsWith('M50 0')).toBe(true);
    expect(d.endsWith('L100 50')).toBe(true);
  });

  test('el alcance largo permite solaparse con la vecina', () => {
    expect(wirePath(N | S, 0, 31, 53)).toBe('M50 -3 L50 103');
  });

  test('una T y un cruce dibujan un brazo por lado, todos desde el centro', () => {
    expect(wirePath(N | E | S, 0).split('M').filter(Boolean)).toHaveLength(3);
    expect(wirePath(15, 0).split('M').filter(Boolean)).toHaveLength(4);
    expect(wirePath(15, 0).split('M').filter(Boolean).every((p) => p.startsWith('50 50'))).toBe(true);
  });

  test('para las 16 máscaras y todas las combinaciones de extremos sueltos devuelve un trazo sin NaN', () => {
    for (let mask = 1; mask < 16; mask++) {
      for (let loose = 0; loose < 16; loose++) {
        const d = wirePath(mask & 15, loose & mask);
        expect(d).not.toMatch(/NaN|undefined/);
        expect(d.length).toBeGreaterThan(5);
      }
    }
  });
});

describe('TileSvg (renderizado)', () => {
  test('se renderiza sin errores para cada pieza, encendida y apagada', () => {
    for (let mask = 0; mask < 16; mask++) {
      for (const loose of [0, mask]) {
        let tree: TestRenderer.ReactTestRenderer | undefined;
        act(() => {
          tree = TestRenderer.create(<TileSvg mask={mask} loose={loose} glowStop={0} size={64} theme={NEON_THEME} />);
        });
        expect(tree?.toJSON()).not.toBeNull();
        act(() => tree?.unmount());
      }
    }
  });
});
