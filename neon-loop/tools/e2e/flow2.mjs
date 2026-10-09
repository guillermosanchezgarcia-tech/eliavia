// Flujo ampliado: dificultad Experto, reinicio con confirmación, salir, ajustes y recuperación de guardado corrupto.
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
const snap = () => page.evaluate(() => { const s = globalThis.__nl.run.snapshot(); return { status: s.status, score: s.score, time: s.timeLeftMs, cells: s.board.cells, target: s.board.target, cols: s.board.cols, rows: s.board.rows, boards: s.boardsCleared, difficulty: s.difficulty, taps: s.taps }; });
const rotate = (m, k) => { let x = m; for (let i = 0; i < k; i++) x = ((x << 1) | (x >> 3)) & 15; return x; };
const stepsTo = (a, b) => { for (let k = 0; k < 4; k++) if (rotate(a, k) === b) return k; return 0; };
const tileSel = (cols, i) => `[aria-label*="fila ${Math.floor(i / cols) + 1}, columna ${(i % cols) + 1},"]`;
const press = async (selector) => { const box = await page.locator(selector).first().boundingBox(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.clock.runFor(70); await page.mouse.up(); await page.clock.runFor(60); };
const solveCurrent = async () => { const s = await snap(); for (let i = 0; i < s.cells.length; i++) for (let k = 0; k < stepsTo(s.cells[i], s.target[i]); k++) await press(tileSel(s.cols, i)); };
const home = async () => { await page.goto(URL, { waitUntil: 'networkidle' }); await page.getByRole('button', { name: 'JUGAR' }).waitFor({ timeout: 15000 }); await page.clock.runFor(800); };
const readSave = () => page.evaluate(() => JSON.parse(localStorage.getItem('nl.save.v1') ?? 'null'));
const endRunByTime = async () => { for (let i = 0; i < 60 && (await snap()).status !== 'over'; i++) await page.clock.runFor(2000); await page.clock.runFor(2500); };

// 1) Dificultad Experto
await home();
await page.getByRole('radio', { name: /EXPERTO/ }).click();
await page.getByRole('button', { name: 'JUGAR' }).click();
await page.waitForFunction(() => !!globalThis.__nl, null, { timeout: 15000 });
await page.clock.runFor(400);
let s = await snap();
check('EXPERTO empieza con 44 s y un tablero de al menos 5x5', s.difficulty === 'expert' && s.time === 44000 && s.cols >= 5 && s.rows >= 5, `(${s.cols}x${s.rows})`);
await page.screenshot({ path: 'shots/10-expert.png' });

// 2) Jugar un poco y REINICIAR con confirmación
await solveCurrent();
await page.clock.runFor(100);
s = await snap();
check('se cierra un tablero Experto', s.boards === 1 && s.score > 0, `(puntos ${s.score})`);
const scoreBeforeRestart = s.score;
await page.getByRole('button', { name: 'Pausar' }).click();
await page.getByRole('button', { name: 'REINICIAR' }).click();
check('REINICIAR pide confirmación antes de actuar', await page.getByText('¿Empezar una partida nueva?').isVisible());
await page.getByRole('button', { name: 'CANCELAR' }).click();
check('CANCELAR vuelve al menú de pausa sin perder la partida', (await page.getByRole('button', { name: 'REANUDAR' }).isVisible()) && (await snap()).score === scoreBeforeRestart);
await page.getByRole('button', { name: 'REINICIAR' }).click();
await page.getByRole('button', { name: 'SÍ, REINICIAR' }).click();
await page.waitForFunction(() => globalThis.__nl.run.snapshot().status === 'ready', null, { timeout: 15000 });
s = await snap();
check('al reiniciar empieza una partida nueva en la misma dificultad', s.score === 0 && s.difficulty === 'expert');
const save1 = await readSave();
check('lo jugado antes de reiniciar queda guardado como récord', save1.records.expert.bestScore === scoreBeforeRestart && save1.totals.runs === 1, `(récord ${save1.records.expert.bestScore})`);

// 3) SALIR AL INICIO
await press(tileSel(s.cols, s.cells.findIndex((m, i) => stepsTo(m, s.target[i]) > 0)));
await page.getByRole('button', { name: 'Pausar' }).click();
await page.getByRole('button', { name: 'SALIR AL INICIO' }).click();
await page.getByRole('button', { name: 'JUGAR' }).waitFor({ timeout: 15000 });
check('SALIR AL INICIO vuelve al menú', true);
check('el menú muestra el récord de Experto', await page.getByText(new RegExp(`Récord ${scoreBeforeRestart.toLocaleString('es-ES')}`)).first().isVisible().catch(() => false) || (await page.getByText(scoreBeforeRestart.toLocaleString('es-ES')).count()) > 0);

// 4) Ajustes de sonido y vibración persistentes
await page.getByRole('button', { name: 'Desactivar sonido' }).click();
await page.getByRole('button', { name: 'Desactivar vibración' }).click();
await page.clock.runFor(200);
const settings = await page.evaluate(() => JSON.parse(localStorage.getItem('nl.settings.v1')));
check('los ajustes de sonido y vibración se guardan', settings.sfx === false && settings.haptics === false && settings.lastDifficulty);

// 5) Recarga: persistencia entre ejecuciones
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'JUGAR' }).waitFor({ timeout: 15000 });
await page.clock.runFor(800);
check('tras recargar, los ajustes siguen desactivados', (await page.getByRole('button', { name: 'Activar sonido' }).count()) === 1 && (await page.getByRole('button', { name: 'Activar vibración' }).count()) === 1);
check('tras recargar, el récord sigue ahí', (await page.getByText(scoreBeforeRestart.toLocaleString('es-ES')).count()) > 0);

// 6) Segunda partida (para que exista copia de seguridad) y recuperación ante corrupción
await page.getByRole('button', { name: 'JUGAR' }).click();
await page.waitForFunction(() => !!globalThis.__nl, null, { timeout: 15000 });
await page.clock.runFor(300);
await solveCurrent();
await endRunByTime();
const save2 = await readSave();
const backup = await page.evaluate(() => localStorage.getItem('nl.save.v1.bak'));
check('existe copia de seguridad tras la segunda partida', !!backup);
await page.evaluate(() => localStorage.setItem('nl.save.v1', '{"records": ¡corrupto'));
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'JUGAR' }).waitFor({ timeout: 15000 });
await page.clock.runFor(800);
check('con el guardado corrupto se restaura la copia y se avisa', await page.getByText('Se restauró tu progreso desde una copia de seguridad.').isVisible());
await page.screenshot({ path: 'shots/11-home-recovered.png' });

console.log(logs.length ? `Errores de consola:\n${logs.join('\n')}` : 'Sin errores de consola');
console.log(`${results.filter((r) => r.ok).length}/${results.length} comprobaciones correctas`);
await browser.close();
process.exit(results.every((r) => r.ok) && logs.length === 0 ? 0 : 1);
