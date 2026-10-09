/**
 * Genera los efectos de sonido de NEON LOOP como archivos WAV (16 bit, mono, 22,05 kHz).
 * Son 100 % originales (síntesis aditiva), sin licencias de terceros, y deterministas.
 *
 * Uso: npm run sounds
 */
import { Buffer } from 'node:buffer';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 22050;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sounds');
mkdirSync(OUT, { recursive: true });

/** Buffer de `seconds` segundos. */
const buffer = (seconds) => new Float32Array(Math.ceil(seconds * RATE));

/** Suma una nota (fundamental + armónicos) con ataque corto y caída exponencial. */
function note(buf, { freq, start = 0, dur = 0.2, gain = 0.5, decay = 0.07, harmonics = [1, 0.28, 0.1], slide = 0 }) {
  const first = Math.floor(start * RATE);
  const len = Math.min(buf.length - first, Math.floor(dur * RATE));
  for (let i = 0; i < len; i++) {
    const t = i / RATE;
    const attack = Math.min(1, t / 0.004);
    const env = attack * Math.exp(-t / decay);
    const f = freq * (1 + slide * t);
    let s = 0;
    harmonics.forEach((h, k) => {
      s += h * Math.sin(2 * Math.PI * f * (k + 1) * t);
    });
    buf[first + i] += gain * env * s;
  }
}

/** Ruido determinista (LCG) para el "clic" del toque. */
function click(buf, { start = 0, dur = 0.01, gain = 0.3 }) {
  let seed = 12345;
  const first = Math.floor(start * RATE);
  const len = Math.min(buf.length - first, Math.floor(dur * RATE));
  for (let i = 0; i < len; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const n = seed / 4294967296 - 0.5;
    buf[first + i] += gain * n * Math.exp(-i / (len * 0.35));
  }
}

/** Normaliza a un pico seguro y escribe el WAV. */
function save(name, buf, peak = 0.8) {
  let max = 0;
  for (const v of buf) max = Math.max(max, Math.abs(v));
  const scale = max > 0 ? peak / max : 1;
  // Fundido de salida de 5 ms para evitar clics al cortar.
  const fade = Math.floor(0.005 * RATE);
  const data = Buffer.alloc(44 + buf.length * 2);
  data.write('RIFF', 0);
  data.writeUInt32LE(36 + buf.length * 2, 4);
  data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20); // PCM
  data.writeUInt16LE(1, 22); // mono
  data.writeUInt32LE(RATE, 24);
  data.writeUInt32LE(RATE * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write('data', 36);
  data.writeUInt32LE(buf.length * 2, 40);
  for (let i = 0; i < buf.length; i++) {
    const tail = Math.min(1, (buf.length - i) / fade);
    const v = Math.max(-1, Math.min(1, buf[i] * scale * tail));
    data.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  writeFileSync(join(OUT, `${name}.wav`), data);
  console.log(`${name}.wav  ${(buf.length / RATE).toFixed(2)} s  ${(data.length / 1024).toFixed(1)} KB`);
}

// --- Toque: clic seco y breve con un tono corto -------------------------------------------
{
  const b = buffer(0.06);
  click(b, { gain: 0.5 });
  note(b, { freq: 420, dur: 0.06, gain: 0.5, decay: 0.014, harmonics: [1, 0.2] });
  save('tap', b, 0.55);
}

// --- Escalera de racha: pentatónica mayor desde Do5. Cada encendido seguido sube una nota ---
const LADDER = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51];
LADDER.forEach((freq, i) => {
  const b = buffer(0.3);
  note(b, { freq, dur: 0.3, gain: 0.5, decay: 0.085 });
  note(b, { freq: freq * 1.004, dur: 0.3, gain: 0.25, decay: 0.07, harmonics: [1, 0.1] });
  save(`lock${i}`, b, 0.75);
});

// --- Tablero cerrado: arpegio ascendente con acorde final ------------------------------------
{
  const b = buffer(0.75);
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => note(b, { freq, start: i * 0.075, dur: 0.5, gain: 0.45, decay: 0.12 }));
  [523.25, 659.25, 783.99, 1046.5].forEach((freq) => note(b, { freq, start: 0.32, dur: 0.43, gain: 0.22, decay: 0.16 }));
  save('clear', b, 0.8);
}

// --- Nuevo récord: arpegio largo y brillante ------------------------------------------------
{
  const b = buffer(1.1);
  [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98].forEach((freq, i) =>
    note(b, { freq, start: i * 0.085, dur: 0.6, gain: 0.4, decay: 0.15 })
  );
  [1046.5, 1318.51, 1567.98].forEach((freq) => note(b, { freq, start: 0.55, dur: 0.55, gain: 0.25, decay: 0.2 }));
  save('record', b, 0.8);
}

// --- Fin de partida: tres notas descendentes y suaves ----------------------------------------
{
  const b = buffer(0.9);
  [392.0, 329.63, 261.63].forEach((freq, i) =>
    note(b, { freq, start: i * 0.16, dur: 0.6, gain: 0.5, decay: 0.2, harmonics: [1, 0.15] })
  );
  save('over', b, 0.7);
}

// --- Aviso de tiempo: tic discreto ------------------------------------------------------------
{
  const b = buffer(0.08);
  note(b, { freq: 1480, dur: 0.08, gain: 0.5, decay: 0.02, harmonics: [1] });
  save('warn', b, 0.4);
}

// --- Botón de interfaz -----------------------------------------------------------------------
{
  const b = buffer(0.09);
  note(b, { freq: 740, dur: 0.09, gain: 0.5, decay: 0.025, harmonics: [1, 0.2] });
  note(b, { freq: 1110, start: 0.02, dur: 0.07, gain: 0.3, decay: 0.02, harmonics: [1] });
  save('ui', b, 0.5);
}
