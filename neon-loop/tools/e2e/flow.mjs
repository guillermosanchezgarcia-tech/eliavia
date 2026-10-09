// Flujo principal: partida completa, pausa, cierre de tablero, fin por tiempo, resultados y récord.
// Requiere la versión web compilada con EXPO_PUBLIC_E2E=1 servida por tools/e2e/server.mjs.
// Variables: E2E_URL (por defecto http://localhost:8099/), CHROMIUM_PATH (opcional). Capturas en ./shots
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

mkdirSync('shots', { recursive: true });

const URL = process.env.E2E_URL ?? 'http://localhost:8099/';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push(`[error] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.clock.install();

const results = [];
const check = (name, ok, extra = '') => { results.push({ name, ok }); console.log(`${ok ? 'OK  ' : 'FALLO'} ${name} ${extra}`); };
const snap = () => page.evaluate(() => {
  const s = globalThis.__nl.run.snapshot();
  return { status: s.status, score: s.score, time: s.timeLeftMs, boards: s.boardsCleared, cells: s.board.cells, target: s.board.target, cols: s.board.cols, rows: s.board.rows, combo: s.combo, taps: s.taps, par: s.par, boardNumber: s.boardNumber };
});
const rotate = (m, k) => { let x = m; for (let i = 0; i < k; i++) x = ((x << 1) | (x >> 3)) & 15; return x; };
const stepsTo = (a, b) => { for (let k = 0; k < 4; k++) if (rotate(a, k) === b) return k; return 0; };
// Una pulsación de dedo dura decenas de ms; RN-web retrasa onPressIn 50 ms, así que se simula ese tiempo.
const press = async (selector) => {
  const box = await page.locator(selector).first().boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.clock.runFor(70);
  await page.mouse.up();
  await page.clock.runFor(60);
};
const tileSel = (cols, i) => `[aria-label*="fila ${Math.floor(i / cols) + 1}, columna ${(i % cols) + 1},"]`;

await page.goto(URL, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'JUGAR' }).waitFor({ timeout: 15000 });
await page.clock.runFor(1000);
await page.screenshot({ path: 'shots/01-home.png' });

// ---- Partida: Normal ----
await page.getByRole('button', { name: 'JUGAR' }).click();
await page.waitForFunction(() => !!globalThis.__nl, null, { timeout: 15000 });
await page.clock.runFor(500);
let s = await snap();
check('la partida empieza lista y sin correr el tiempo', s.status === 'ready' && s.time === 40000, `(${s.cols}x${s.rows}, par ${s.par})`);
await page.screenshot({ path: 'shots/02-play-ready.png' });

// Tiempo no corre antes del primer toque
await page.clock.runFor(3000);
s = await snap();
check('el tiempo no corre antes del primer toque', s.time === 40000);

// Primeros toques: resolver unas pocas piezas
const toTap = [];
s.cells.forEach((m, i) => { for (let k = 0; k < stepsTo(m, s.target[i]); k++) toTap.push(i); });
for (const i of toTap.slice(0, 6)) { await press(tileSel(s.cols, i)); }
s = await snap();
check('tras tocar, la partida está en juego y hay puntos', s.status === 'playing' && s.score > 0, `(puntos ${s.score}, racha ${s.combo})`);
await page.screenshot({ path: 'shots/03-play-midgame.png' });

// Pausa
await page.getByRole('button', { name: 'Pausar' }).click();
await page.clock.runFor(200);
const tPause = (await snap()).time;
await page.screenshot({ path: 'shots/04-pause.png' });
await page.clock.runFor(5000);
check('en pausa el tiempo no corre', (await snap()).time === tPause);
await page.getByRole('button', { name: 'REANUDAR' }).click();
await page.clock.runFor(300);
check('al reanudar vuelve a correr', (await snap()).time < tPause);

// Resolver el resto del tablero
s = await snap();
const rest = [];
s.cells.forEach((m, i) => { for (let k = 0; k < stepsTo(m, s.target[i]); k++) rest.push(i); });
for (const i of rest) { await press(tileSel(s.cols, i)); }
s = await snap();
check('al resolver el tablero se cierra y se suma tiempo', s.boards === 1 && s.time > 38000, `(tableros ${s.boards}, tiempo ${Math.round(s.time)})`);
await page.screenshot({ path: 'shots/05-board-cleared.png' });
await page.clock.runFor(1200);
s = await snap();
check('aparece un tablero nuevo', s.boardNumber === 2 && s.status === 'playing');
await page.screenshot({ path: 'shots/06-board-2.png' });

// Dejar que se acabe el tiempo
for (let i = 0; i < 40 && (await snap()).status !== 'over'; i++) await page.clock.runFor(2000);
check('la partida termina cuando se acaba el tiempo', (await snap()).status === 'over');
await page.clock.runFor(2500);
await page.getByText('PUNTOS', { exact: true }).waitFor({ timeout: 10000 });
await page.clock.runFor(1500);
await page.screenshot({ path: 'shots/07-results.png' });

const save = await page.evaluate(() => JSON.parse(localStorage.getItem('nl.save.v1') ?? 'null'));
check('el récord se guardó en el almacenamiento', save && save.records.normal.bestScore > 0, `(récord ${save?.records.normal.bestScore})`);

// Jugar de nuevo
await page.getByRole('button', { name: 'JUGAR DE NUEVO' }).click();
await page.waitForFunction(() => !!globalThis.__nl && globalThis.__nl.run.snapshot().status === 'ready', null, { timeout: 15000 });
check('JUGAR DE NUEVO empieza una partida nueva', (await snap()).score === 0);

console.log(logs.length ? `Errores de consola:\n${logs.join('\n')}` : 'Sin errores de consola');
console.log(`${results.filter((r) => r.ok).length}/${results.length} comprobaciones correctas`);
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
