/**
 * Simulación de equilibrio: jugadores-bot de distinta habilidad juegan partidas
 * completas con el motor REAL. Sirve para ajustar tiempos y bonus con datos en
 * lugar de a ojo. Es un modelo, no una persona: valida el orden de magnitud y la
 * forma de la curva; las cifras reales las dará la telemetría de usuarios.
 *
 * Uso: npm run sim [-- partidas]
 * Explorar parámetros: SIM_OVERRIDES='{"normal":{"startMs":50000}}' npm run sim
 */
import { BOT_SKILLS, playBot } from '../src/engine/bot';
import { DIFFICULTIES, DIFFICULTY_IDS, DifficultyId } from '../src/engine/difficulty';

const SKILLS = [BOT_SKILLS.novice, BOT_SKILLS.medium, BOT_SKILLS.expert];

function pct(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
}

// Para explorar parámetros sin editar código: SIM_OVERRIDES='{"normal":{"startMs":50000}}'
if (process.env.SIM_OVERRIDES) {
  const overrides = JSON.parse(process.env.SIM_OVERRIDES) as Record<string, object>;
  for (const [id, patch] of Object.entries(overrides)) Object.assign(DIFFICULTIES[id as DifficultyId], patch);
}

const runs = Number(process.argv[2] ?? 120);
console.log(`Simulación con ${runs} partidas por celda (tiempo en segundos de juego efectivo)\n`);
console.log('dificultad  habilidad  duración p10 / mediana / p90   tableros (mediana)   puntos (mediana)');
for (const difficulty of DIFFICULTY_IDS) {
  for (const skill of SKILLS) {
    const durations: number[] = [];
    const boards: number[] = [];
    const scores: number[] = [];
    for (let k = 0; k < runs; k++) {
      const r = playBot(difficulty, skill, `${difficulty}-${skill.name}-${k}`);
      durations.push(r.playMs / 1000);
      boards.push(r.boardsCleared);
      scores.push(r.score);
    }
    durations.sort((a, b) => a - b);
    boards.sort((a, b) => a - b);
    scores.sort((a, b) => a - b);
    console.log(
      `${difficulty.padEnd(10)}  ${skill.name.padEnd(9)}  ` +
        `${pct(durations, 0.1).toFixed(0).padStart(4)} / ${pct(durations, 0.5).toFixed(0).padStart(4)} / ${pct(durations, 0.9).toFixed(0).padStart(4)}` +
        `${''.padEnd(14)}${String(pct(boards, 0.5)).padStart(4)}${''.padEnd(17)}${String(pct(scores, 0.5)).padStart(6)}`
    );
  }
}
