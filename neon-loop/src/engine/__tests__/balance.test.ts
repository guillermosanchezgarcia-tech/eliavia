import { BOT_SKILLS, playBot } from '../bot';
import { DIFFICULTIES, DIFFICULTY_IDS } from '../difficulty';
import { bonusDecay, timeBonusMs } from '../scoring';

/**
 * Tests de regresión del RITMO. Usan bots (un modelo de jugador), así que las cotas son
 * generosas: detectan partidas infinitas o absurdamente cortas, no afinan el diseño.
 * El ajuste fino se hace con `npm run sim` y, después, con telemetría real.
 */
const SEEDS = 6;

function medianSeconds(difficulty: (typeof DIFFICULTY_IDS)[number], skill: keyof typeof BOT_SKILLS): number {
  const values: number[] = [];
  for (let k = 0; k < SEEDS; k++) {
    const r = playBot(difficulty, BOT_SKILLS[skill], `bal-${difficulty}-${skill}-${k}`, 400);
    expect(r.boardsCleared).toBeLessThan(400); // ninguna partida es infinita
    values.push(r.playMs / 1000);
  }
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)];
}

describe('ritmo de partida', () => {
  test.each(DIFFICULTY_IDS)('%s: el jugador medio dura entre 45 y 110 s', (difficulty) => {
    const m = medianSeconds(difficulty, 'medium');
    expect(m).toBeGreaterThanOrEqual(45);
    expect(m).toBeLessThanOrEqual(110);
  });

  test.each(DIFFICULTY_IDS)('%s: el novato aguanta al menos 30 s y el experto acaba en menos de 5 min', (difficulty) => {
    expect(medianSeconds(difficulty, 'novice')).toBeGreaterThanOrEqual(30);
    expect(medianSeconds(difficulty, 'expert')).toBeLessThanOrEqual(300);
  });

  test.each(DIFFICULTY_IDS)('%s: ser más hábil rinde más puntos (la habilidad se premia)', (difficulty) => {
    const score = (skill: keyof typeof BOT_SKILLS) => {
      let total = 0;
      for (let k = 0; k < SEEDS; k++) total += playBot(difficulty, BOT_SKILLS[skill], `skill-${difficulty}-${k}`).score;
      return total / SEEDS;
    };
    expect(score('medium')).toBeGreaterThan(score('novice'));
    expect(score('expert')).toBeGreaterThan(score('medium'));
  });
});

describe('bonus de tiempo decreciente', () => {
  test.each(DIFFICULTY_IDS)('%s: baja con los tableros cerrados y nunca baja de su suelo', (difficulty) => {
    const cfg = DIFFICULTIES[difficulty];
    let last = Infinity;
    for (let n = 0; n < 60; n++) {
      const d = bonusDecay(cfg, n);
      expect(d).toBeLessThanOrEqual(last);
      expect(d).toBeGreaterThanOrEqual(cfg.timeBonusFloor);
      last = d;
    }
    expect(bonusDecay(cfg, 0)).toBe(1);
    expect(bonusDecay(cfg, 1000)).toBe(cfg.timeBonusFloor);
    expect(timeBonusMs(cfg, 16, 20, 20, 30)).toBeLessThan(timeBonusMs(cfg, 16, 20, 20, 0));
  });
});
