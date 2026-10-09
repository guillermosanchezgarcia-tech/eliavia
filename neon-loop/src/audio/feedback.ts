import type { RunEvent } from '../engine/run';
import { haptics } from '../haptics/haptics';
import { cuesFor } from './cues';
import { sfx } from './sfx';

/** Ejecuta la respuesta de sonido y vibración correspondiente a los eventos del motor. */
export function playFeedback(events: readonly RunEvent[]): void {
  for (const cue of cuesFor(events)) {
    if (cue.sound) sfx.play(cue.sound);
    if (cue.haptic) haptics.fire(cue.haptic);
  }
}
