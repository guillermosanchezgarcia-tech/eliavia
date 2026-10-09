// Se importa cada peso por separado: el índice del paquete arrastra los cinco y engorda la app.
import { Rajdhani_600SemiBold } from '@expo-google-fonts/rajdhani/600SemiBold';
import { Rajdhani_700Bold } from '@expo-google-fonts/rajdhani/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { AppStateProvider, useApp } from '../state/AppState';
import { NEON_THEME } from '../theme/theme';
import { ThemeProvider } from '../theme/ThemeProvider';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** Mantiene la pantalla de arranque hasta que el guardado y la tipografía estén listos. */
function Gate() {
  const { ready } = useApp();
  const [fontsLoaded, fontError] = useFonts({ Rajdhani_600SemiBold, Rajdhani_700Bold });
  // Si la fuente falla, se sigue con la del sistema: nunca se bloquea la app por un adorno.
  const fontsDone = fontsLoaded || !!fontError;

  useEffect(() => {
    if (ready && fontsDone) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready, fontsDone]);

  if (!ready || !fontsDone) return null;

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          contentStyle: { backgroundColor: NEON_THEME.bg },
        }}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <AppStateProvider>
      <ThemeProvider>
        <Gate />
      </ThemeProvider>
    </AppStateProvider>
  );
}
