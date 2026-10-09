import * as Haptics from 'expo-haptics';
import type { HapticId } from '../audio/cues';

const MIN_GAP_MS = 35;

/** Vibración opcional. Limitada en frecuencia y sin lanzar nunca. */
class HapticsService {
  enabled = true;
  private last = 0;

  fire(id: HapticId): void {
    if (!this.enabled) return;
    const now = Date.now();
    if (now - this.last < MIN_GAP_MS) return;
    this.last = now;
    try {
      switch (id) {
        case 'light':
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
          break;
        case 'medium':
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
          break;
        case 'success':
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
          break;
        case 'warning':
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
          break;
      }
    } catch {
      /* dispositivo sin motor háptico */
    }
  }
}

export const haptics = new HapticsService();
