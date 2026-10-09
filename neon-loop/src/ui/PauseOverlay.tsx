import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FONT } from '../theme/theme';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './icons/Icon';
import { IconButton } from './IconButton';
import { NeonButton } from './NeonButton';

interface PauseOverlayProps {
  sfxOn: boolean;
  hapticsOn: boolean;
  onResume: () => void;
  onRestart: () => void;
  onExit: () => void;
  onToggleSfx: () => void;
  onToggleHaptics: () => void;
}

/** Menú de pausa. Reiniciar pide confirmación; salir y reanudar no (abandonar debe ser fácil). */
export function PauseOverlay({
  sfxOn,
  hapticsOn,
  onResume,
  onRestart,
  onExit,
  onToggleSfx,
  onToggleHaptics,
}: PauseOverlayProps) {
  const theme = useTheme();
  const [confirming, setConfirming] = useState(false);

  return (
    <View style={styles.overlay} accessibilityViewIsModal>
      <View style={[styles.panel, { backgroundColor: theme.panel, borderColor: theme.panelBorder }]}>
        <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
          PAUSA
        </Text>

        {confirming ? (
          <>
            <Text style={[styles.copy, { color: theme.textDim }]}>
              ¿Empezar una partida nueva? Esta se cerrará y tu récord está a salvo.
            </Text>
            <View style={styles.gap}>
              <NeonButton label="SÍ, REINICIAR" onPress={onRestart} />
            </View>
            <View style={styles.gap}>
              <NeonButton label="CANCELAR" variant="ghost" onPress={() => setConfirming(false)} />
            </View>
          </>
        ) : (
          <>
            <View style={styles.gap}>
              <NeonButton
                label="REANUDAR"
                size="large"
                icon={<Icon name="play" size={26} color={theme.onAccent} />}
                onPress={onResume}
              />
            </View>
            <View style={styles.gap}>
              <NeonButton
                label="REINICIAR"
                variant="secondary"
                icon={<Icon name="restart" size={22} color={theme.wireOn} />}
                onPress={() => setConfirming(true)}
              />
            </View>
            <View style={styles.gap}>
              <NeonButton
                label="SALIR AL INICIO"
                variant="ghost"
                icon={<Icon name="home" size={22} color={theme.textDim} />}
                onPress={onExit}
              />
            </View>
            <View style={styles.toggles}>
              <IconButton
                name={sfxOn ? 'sound' : 'soundOff'}
                label={sfxOn ? 'Desactivar sonido' : 'Activar sonido'}
                active={sfxOn}
                onPress={onToggleSfx}
              />
              <IconButton
                name={hapticsOn ? 'vibrate' : 'vibrateOff'}
                label={hapticsOn ? 'Desactivar vibración' : 'Activar vibración'}
                active={hapticsOn}
                onPress={onToggleHaptics}
              />
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(3,4,12,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  panel: { width: '100%', maxWidth: 420, borderRadius: 24, borderWidth: 1.5, padding: 22 },
  title: { fontFamily: FONT.bold, fontSize: 36, letterSpacing: 8, textAlign: 'center', marginBottom: 14 },
  copy: { fontFamily: FONT.semibold, fontSize: 18, textAlign: 'center', marginBottom: 10 },
  gap: { marginTop: 12 },
  toggles: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 20 },
});
