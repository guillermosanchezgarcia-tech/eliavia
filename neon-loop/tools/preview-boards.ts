/** Imprime tableros de ejemplo en ASCII para revisar su calidad visualmente. Uso: npm run preview */
import { DIFFICULTIES, DifficultyId } from '../src/engine/difficulty';
import { generateBoard } from '../src/engine/generator';
import { createRng } from '../src/engine/rng';
import { computePar } from '../src/engine/board';
import { E, N, S, W } from '../src/engine/tiles';

const GLYPH: Record<number, string> = {
  0: '  ', [N | S]: '│ ', [E | W]: '──', [N | E]: '└─', [E | S]: '┌─', [S | W]: '┐ ', [N | W]: '┘ ',
  [N | E | S]: '├─', [E | S | W]: '┬─', [N | S | W]: '┤ ', [N | E | W]: '┴─', 15: '┼─',
  [N]: '╵ ', [E]: '╶─', [S]: '╷ ', [W]: '╴ ',
};

const [difficulty = 'normal', stageArg = '2', countArg = '3'] = process.argv.slice(2);
const spec = DIFFICULTIES[difficulty as DifficultyId].ladder[Number(stageArg)];
for (let k = 0; k < Number(countArg); k++) {
  const b = generateBoard(createRng(`preview${k}`), spec);
  console.log(`\n${difficulty} etapa ${stageArg} ${b.cols}x${b.rows} par=${computePar(b)}   (solución | mezclado)`);
  for (let r = 0; r < b.rows; r++) {
    let sol = '', mix = '';
    for (let c = 0; c < b.cols; c++) {
      sol += GLYPH[b.target[r * b.cols + c]];
      mix += GLYPH[b.cells[r * b.cols + c]];
    }
    console.log('  ' + sol + '      ' + mix);
  }
}
