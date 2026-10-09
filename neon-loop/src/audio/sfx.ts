import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { SoundId } from './cues';

const SOURCES: Record<SoundId, number> = {
  tap: require('../../assets/sounds/tap.wav'),
  lock0: require('../../assets/sounds/lock0.wav'),
  lock1: require('../../assets/sounds/lock1.wav'),
  lock2: require('../../assets/sounds/lock2.wav'),
  lock3: require('../../assets/sounds/lock3.wav'),
  lock4: require('../../assets/sounds/lock4.wav'),
  lock5: require('../../assets/sounds/lock5.wav'),
  lock6: require('../../assets/sounds/lock6.wav'),
  lock7: require('../../assets/sounds/lock7.wav'),
  clear: require('../../assets/sounds/clear.wav'),
  record: require('../../assets/sounds/record.wav'),
  over: require('../../assets/sounds/over.wav'),
  warn: require('../../assets/sounds/warn.wav'),
  ui: require('../../assets/sounds/ui.wav'),
};

/** Instancias por sonido: el toque se repite muy rápido y necesita solaparse. */
const POOL_SIZE: Partial<Record<SoundId, number>> = { tap: 2 };

const SOUND_IDS = Object.keys(SOURCES) as SoundId[];

/**
 * Efectos de sonido. Los reproductores se crean al entrar en juego (`prepare`) y no al abrir la
 * app, para no frenar el arranque. Cualquier fallo de audio se traga: el juego sigue en silencio.
 */
class Sfx {
  enabled = true;
  private pools = new Map<SoundId, AudioPlayer[]>();
  private cursor = new Map<SoundId, number>();
  private prepared = false;
  private broken = false;

  prepare(): void {
    if (this.prepared || this.broken) return;
    this.prepared = true;
    try {
      void setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => undefined);
      for (const id of SOUND_IDS) {
        const size = POOL_SIZE[id] ?? 1;
        const players: AudioPlayer[] = [];
        for (let i = 0; i < size; i++) players.push(createAudioPlayer(SOURCES[id]));
        this.pools.set(id, players);
        this.cursor.set(id, 0);
      }
    } catch {
      this.broken = true;
    }
  }

  play(id: SoundId): void {
    if (!this.enabled || this.broken) return;
    if (!this.prepared) this.prepare();
    const pool = this.pools.get(id);
    if (!pool) return;
    const i = this.cursor.get(id) ?? 0;
    this.cursor.set(id, (i + 1) % pool.length);
    try {
      const player = pool[i];
      void player.seekTo(0);
      player.play();
    } catch {
      /* el audio es accesorio: nunca debe romper una partida */
    }
  }

  release(): void {
    for (const pool of this.pools.values()) {
      for (const p of pool) {
        try {
          p.remove();
        } catch {
          /* ya liberado */
        }
      }
    }
    this.pools.clear();
    this.cursor.clear();
    this.prepared = false;
  }
}

export const sfx = new Sfx();
