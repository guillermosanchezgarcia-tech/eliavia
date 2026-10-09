import React, { createContext, useContext } from 'react';
import { NEON_THEME, Theme } from './theme';

const ThemeContext = createContext<Theme>(NEON_THEME);

/** Permite cambiar de tema (Fase B) sin tocar los componentes. */
export function ThemeProvider({ theme = NEON_THEME, children }: { theme?: Theme; children: React.ReactNode }) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export const useTheme = (): Theme => useContext(ThemeContext);
