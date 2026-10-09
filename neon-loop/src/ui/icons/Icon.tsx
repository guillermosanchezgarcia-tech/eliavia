import React from 'react';
import Svg, { Path } from 'react-native-svg';

export type IconName =
  | 'pause'
  | 'play'
  | 'sound'
  | 'soundOff'
  | 'vibrate'
  | 'vibrateOff'
  | 'restart'
  | 'home'
  | 'help'
  | 'close';

interface Shape {
  stroke: string[];
  fill?: string[];
}

/** Iconos propios (viewBox 24x24), dibujados con trazos para casar con el estilo de neón. */
const SHAPES: Record<IconName, Shape> = {
  pause: { stroke: ['M8 5v14', 'M16 5v14'] },
  play: { stroke: [], fill: ['M7 4.5v15l12-7.5z'] },
  sound: { stroke: ['M4 9v6h4l5 4V5L8 9H4z', 'M16.5 8.5a5 5 0 010 7', 'M19.2 5.8a8.5 8.5 0 010 12.4'] },
  soundOff: { stroke: ['M4 9v6h4l5 4V5L8 9H4z', 'M17 9.5l5 5', 'M22 9.5l-5 5'] },
  vibrate: {
    stroke: ['M8.5 3h7A1.5 1.5 0 0117 4.5v15a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 017 19.5v-15A1.5 1.5 0 018.5 3z', 'M3.5 8v8', 'M20.5 8v8'],
  },
  vibrateOff: {
    stroke: ['M8.5 3h7A1.5 1.5 0 0117 4.5v15a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 017 19.5v-15A1.5 1.5 0 018.5 3z', 'M3.5 8v8', 'M20.5 8v8', 'M3 3l18 18'],
  },
  restart: { stroke: ['M20 12a8 8 0 11-2.7-6', 'M20 3.5V9h-5.5'] },
  home: { stroke: ['M4 11l8-7 8 7', 'M6.5 9.5V20h11V9.5'] },
  help: { stroke: ['M12 21a9 9 0 100-18 9 9 0 000 18z', 'M9.5 9.4a2.6 2.6 0 115 .9c0 1.7-2.5 2-2.5 3.8', 'M12 17.2v.3'] },
  close: { stroke: ['M6 6l12 12', 'M18 6L6 18'] },
};

interface IconProps {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 24, color, strokeWidth = 2.2 }: IconProps) {
  const shape = SHAPES[name];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {shape.stroke.map((d) => (
        <Path key={d} d={d} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {shape.fill?.map((d) => (
        <Path key={d} d={d} fill={color} stroke={color} strokeWidth={1.2} strokeLinejoin="round" />
      ))}
    </Svg>
  );
}
