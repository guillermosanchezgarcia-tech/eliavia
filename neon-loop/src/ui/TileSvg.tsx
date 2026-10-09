import React, { memo } from 'react';
import Svg, { ClipPath, Defs, G, Circle, Path, Rect } from 'react-native-svg';
import { tileKind } from '../engine/tiles';
import type { Theme } from '../theme/theme';

const C = 50;
const EDGE = 50;
/** Hasta dónde llega un cable con el extremo suelto: se queda corto y termina en un anillo. */
const LOOSE_REACH = 31;
const RING_AT = 40;
const DIRS = [
  { dx: 0, dy: -1 }, // N
  { dx: 1, dy: 0 }, // E
  { dx: 0, dy: 1 }, // S
  { dx: -1, dy: 0 }, // W
] as const;

/** El halo se detiene a esta distancia del centro cuando la vecina no está encendida. */
const GLOW_STOP_REACH = 33;
/** Cada pieza se dibuja 2 px más grande por lado y se solapa con sus vecinas: sin costuras. */
const OVERLAP_PX = 2;
const OVERLAP_UNITS_OF = (size: number) => (OVERLAP_PX / size) * 100;
const OVERLAP_UNITS = 3;

/** Atributos del <Svg>: ligeramente mayor que la casilla y desplazado para quedar centrado. */
function overlapProps(size: number) {
  const pad = OVERLAP_UNITS_OF(size);
  return {
    width: size + OVERLAP_PX * 2,
    height: size + OVERLAP_PX * 2,
    viewBox: `${-pad} ${-pad} ${100 + pad * 2} ${100 + pad * 2}`,
    style: { position: 'absolute' as const, left: -OVERLAP_PX, top: -OVERLAP_PX },
  };
}

const pt = (d: number, reach: number): string => `${C + DIRS[d].dx * reach} ${C + DIRS[d].dy * reach}`;

/**
 * Trazo del cable de la pieza. Los lados de `shortMask` se quedan cortos (`shortReach`); el resto
 * llega a `longReach` (algo más allá del borde, para solaparse con la pieza vecina y no dejar costuras).
 * Función pura: se prueba sin renderizar.
 */
export function wirePath(mask: number, shortMask: number, shortReach = LOOSE_REACH, longReach = EDGE): string {
  const arms: number[] = [];
  for (let d = 0; d < 4; d++) if (mask & (1 << d)) arms.push(d);
  const reach = (d: number) => (shortMask & (1 << d) ? shortReach : longReach);
  const kind = tileKind(mask);

  if (kind === 'line') {
    return `M${pt(arms[0], reach(arms[0]))} L${pt(arms[1], reach(arms[1]))}`;
  }
  if (kind === 'corner') {
    // Dos tramos rectos unidos por una curva suave que pasa cerca del centro.
    const [a, b] = arms;
    return `M${pt(a, reach(a))} L${pt(a, 17)} Q${C} ${C} ${pt(b, 17)} L${pt(b, reach(b))}`;
  }
  return arms.map((d) => `M${C} ${C} L${pt(d, reach(d))}`).join(' ');
}

interface TileSvgProps {
  mask: number;
  /** Máscara de extremos sueltos. 0 con mask != 0 significa "encendida". */
  loose: number;
  /** Lados cuyo vecino NO está encendido: el halo se detiene antes del borde para no cortarse en seco. */
  glowStop?: number;
  size: number;
  theme: Theme;
}

function TileSvgImpl({ mask, loose, glowStop = 0, size, theme }: TileSvgProps) {
  if (mask === 0) {
    return (
      <Svg {...overlapProps(size)}>
        <Circle cx={C} cy={C} r={2.6} fill={theme.wireOff} opacity={0.4} />
      </Svg>
    );
  }

  const lit = loose === 0;
  const kind = tileKind(mask);
  const d = wirePath(mask, loose, LOOSE_REACH, EDGE + OVERLAP_UNITS);
  const glowD = wirePath(mask, glowStop, GLOW_STOP_REACH, EDGE);
  const core = lit ? theme.wireOn : theme.wireOff;
  const hubRadius = kind === 'cap' ? 11 : 7.5;

  const rings: React.ReactNode[] = [];
  for (let dir = 0; dir < 4; dir++) {
    if (loose & (1 << dir)) {
      rings.push(
        <Circle
          key={dir}
          cx={C + DIRS[dir].dx * RING_AT}
          cy={C + DIRS[dir].dy * RING_AT}
          r={6}
          fill="none"
          stroke={theme.loose}
          strokeWidth={3.2}
        />
      );
    }
  }

  return (
    <Svg {...overlapProps(size)}>
      {lit && (
        <>
          {/* El halo se confina al cuadrado exacto de la casilla: al solaparse con la vecina sumaría opacidad. */}
          <Defs>
            <ClipPath id="tile">
              <Rect x={0} y={0} width={100} height={100} />
            </ClipPath>
          </Defs>
          <G clipPath="url(#tile)">
            <Path d={glowD} stroke={theme.wireOnGlow} strokeWidth={28} opacity={0.08} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <Path d={glowD} stroke={theme.wireOnGlow} strokeWidth={19} opacity={0.14} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <Circle cx={C} cy={C} r={hubRadius + 9} fill={theme.wireOnGlow} opacity={0.1} />
            <Circle cx={C} cy={C} r={hubRadius + 4} fill={theme.wireOnGlow} opacity={0.2} />
          </G>
        </>
      )}
      <Path
        d={d}
        stroke={core}
        strokeWidth={lit ? 9 : 6.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {lit ? (
        <Circle cx={C} cy={C} r={hubRadius} fill={theme.wireOn} />
      ) : (
        <Circle cx={C} cy={C} r={hubRadius - 1} fill={theme.bg} stroke={theme.wireOff} strokeWidth={3} />
      )}
      {rings}
    </Svg>
  );
}

export const TileSvg = memo(TileSvgImpl);
