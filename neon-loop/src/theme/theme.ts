/**
 * Tokens visuales. Las piezas y la interfaz solo leen de aquí, de modo que los temas
 * desbloqueables (Fase B) son simplemente otro objeto `Theme`.
 */
export interface Theme {
  id: string;
  /** Fondo: color base y color del resplandor superior. */
  bg: string;
  bgGlow: string;
  /** Cable encendido: núcleo y halo. */
  wireOn: string;
  wireOnGlow: string;
  /** Cable apagado. */
  wireOff: string;
  /** Extremo suelto. */
  loose: string;
  /** Acento principal (botón JUGAR, récords) y secundario (racha). */
  accent: string;
  accent2: string;
  text: string;
  textDim: string;
  panel: string;
  panelBorder: string;
  /** Texto sobre un fondo de acento. */
  onAccent: string;
}

export const NEON_THEME: Theme = {
  id: 'neon',
  bg: '#05060F',
  bgGlow: '#1B1F5A',
  wireOn: '#2DF4FF',
  wireOnGlow: '#2DF4FF',
  wireOff: '#56619E',
  loose: '#FFB84D',
  accent: '#FF3FB4',
  accent2: '#FFD24A',
  text: '#EEF2FF',
  textDim: '#98A2D6',
  panel: 'rgba(24, 28, 70, 0.72)',
  panelBorder: 'rgba(120, 138, 255, 0.28)',
  onAccent: '#08091A',
};

export const FONT = {
  semibold: 'Rajdhani_600SemiBold',
  bold: 'Rajdhani_700Bold',
} as const;

/** Si la fuente aún no ha cargado (o falla) se usa la del sistema, nunca se bloquea la app. */
export const FALLBACK_FONT = undefined;
