import {
  Board,
  activeCount,
  computePar,
  countCircuits,
  isClosed,
  lockedFlags,
  rotateCell,
} from './board';
import { DIFFICULTIES, DifficultyConfig, DifficultyId, dailyStage, nextRating, stageSpec } from './difficulty';
import { generateBoard } from './generator';
import { createRng } from './rng';
import {
  COMBO_WINDOW_MS,
  LOCK_POINTS,
  clearBonusPoints,
  efficiency,
  multiplierForCombo,
  timeBonusMs,
} from './scoring';
import { orientationCount } from './tiles';

/** Pausa tras cerrar un tablero para que se vea el efecto. El tiempo no corre durante ella. */
export const TRANSITION_MS = 750;
/** Un tick mayor que esto se recorta: un parón del JS no debe quitarle tiempo al jugador de golpe. */
export const MAX_TICK_MS = 500;
export const WARN_SECONDS = 5;

export type RunMode = 'free' | 'daily';
export type RunStatus = 'ready' | 'playing' | 'paused' | 'transition' | 'over';

export interface ClearInfo {
  boardNumber: number;
  tiles: number;
  par: number;
  taps: number;
  efficiency: number;
  perfect: boolean;
  bonusPoints: number;
  timeBonusMs: number;
  solveMs: number;
  circuits: number;
}

export type RunEvent =
  | { type: 'start' }
  | { type: 'rotate'; index: number }
  | { type: 'blocked'; index: number }
  | { type: 'lock'; indices: number[]; combo: number; multiplier: number; points: number }
  | { type: 'relock'; indices: number[] }
  | { type: 'unlock'; indices: number[] }
  | { type: 'clear'; info: ClearInfo }
  | { type: 'next'; boardNumber: number }
  | { type: 'warn'; secondsLeft: number }
  | { type: 'comboEnd'; combo: number }
  | { type: 'over' };

export interface RunSnapshot {
  status: RunStatus;
  difficulty: DifficultyId;
  mode: RunMode;
  board: Board;
  locked: readonly boolean[];
  /** Número del tablero actual (empieza en 1). */
  boardNumber: number;
  par: number;
  boardTaps: number;
  timeLeftMs: number;
  score: number;
  combo: number;
  multiplier: number;
  maxCombo: number;
  boardsCleared: number;
  taps: number;
  lastClear: ClearInfo | null;
}

export interface RunResult {
  difficulty: DifficultyId;
  mode: RunMode;
  seed: string;
  score: number;
  boardsCleared: number;
  taps: number;
  /** Suma del par de los tableros cerrados. */
  parTaps: number;
  /** Suma de los toques de los tableros cerrados. */
  tapsOnCleared: number;
  perfectBoards: number;
  maxCombo: number;
  /** Tiempo de juego efectivo (sin pausas), en ms. */
  playMs: number;
  endedBy: 'time' | 'quit';
}

export interface RunOptions {
  difficulty: DifficultyId;
  seed: string;
  mode?: RunMode;
  /** Tiempo inicial; por defecto el de la dificultad. */
  startMs?: number;
}

export class GameRun {
  readonly difficulty: DifficultyId;
  readonly mode: RunMode;
  readonly seed: string;
  private readonly config: DifficultyConfig;

  private status: RunStatus = 'ready';
  private resumeStatus: RunStatus = 'ready';
  private endedBy: 'time' | 'quit' = 'time';

  private board!: Board;
  private locked: boolean[] = [];
  private everLocked: boolean[] = [];
  private par = 0;
  private boardIndex = 0;
  private boardTaps = 0;
  private boardElapsedMs = 0;
  private rating = 0;

  private timeLeftMs: number;
  private score = 0;
  private combo = 0;
  private comboLeftMs = 0;
  private maxCombo = 0;
  private boardsCleared = 0;
  private taps = 0;
  private parTaps = 0;
  private tapsOnCleared = 0;
  private perfectBoards = 0;
  private playMs = 0;
  private transitionLeftMs = 0;
  private lastWarn = Infinity;
  private lastClear: ClearInfo | null = null;

  constructor(options: RunOptions) {
    this.difficulty = options.difficulty;
    this.mode = options.mode ?? 'free';
    this.seed = options.seed;
    this.config = DIFFICULTIES[options.difficulty];
    this.timeLeftMs = options.startMs ?? this.config.startMs;
    this.loadBoard();
  }

  get currentStatus(): RunStatus {
    return this.status;
  }

  snapshot(): RunSnapshot {
    return {
      status: this.status,
      difficulty: this.difficulty,
      mode: this.mode,
      board: this.board,
      locked: this.locked,
      boardNumber: this.boardIndex + 1,
      par: this.par,
      boardTaps: this.boardTaps,
      timeLeftMs: this.timeLeftMs,
      score: this.score,
      combo: this.combo,
      multiplier: multiplierForCombo(this.combo),
      maxCombo: this.maxCombo,
      boardsCleared: this.boardsCleared,
      taps: this.taps,
      lastClear: this.lastClear,
    };
  }

  result(): RunResult {
    return {
      difficulty: this.difficulty,
      mode: this.mode,
      seed: this.seed,
      score: this.score,
      boardsCleared: this.boardsCleared,
      taps: this.taps,
      parTaps: this.parTaps,
      tapsOnCleared: this.tapsOnCleared,
      perfectBoards: this.perfectBoards,
      maxCombo: this.maxCombo,
      playMs: Math.round(this.playMs),
      endedBy: this.endedBy,
    };
  }

  /** Giro de una pieza. Solo se admite con la partida lista o en juego. */
  tap(index: number): RunEvent[] {
    if (this.status !== 'ready' && this.status !== 'playing') return [];
    if (!Number.isInteger(index) || index < 0 || index >= this.board.cells.length) return [];
    if (orientationCount(this.board.cells[index]) <= 1) return [{ type: 'blocked', index }];

    const events: RunEvent[] = [];
    if (this.status === 'ready') {
      this.status = 'playing';
      events.push({ type: 'start' });
    }

    const before = this.locked;
    this.board = rotateCell(this.board, index);
    this.locked = lockedFlags(this.board);
    this.taps++;
    this.boardTaps++;
    events.push({ type: 'rotate', index });

    const newlyLocked: number[] = [];
    const unlocked: number[] = [];
    for (let i = 0; i < this.locked.length; i++) {
      if (!before[i] && this.locked[i]) newlyLocked.push(i);
      else if (before[i] && !this.locked[i]) unlocked.push(i);
    }
    if (unlocked.length > 0) events.push({ type: 'unlock', indices: unlocked });

    const firstTime = newlyLocked.filter((i) => !this.everLocked[i]);
    const again = newlyLocked.filter((i) => this.everLocked[i]);
    for (const i of newlyLocked) this.everLocked[i] = true;

    if (firstTime.length > 0) {
      let points = 0;
      for (let k = 0; k < firstTime.length; k++) {
        this.combo++;
        points += LOCK_POINTS * multiplierForCombo(this.combo);
      }
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.comboLeftMs = COMBO_WINDOW_MS;
      this.score += points;
      events.push({
        type: 'lock',
        indices: firstTime,
        combo: this.combo,
        multiplier: multiplierForCombo(this.combo),
        points,
      });
    }
    if (again.length > 0) events.push({ type: 'relock', indices: again });

    if (isClosed(this.board)) events.push(this.clearBoard());
    return events;
  }

  /** Avanza el reloj. `dtMs` se recorta a MAX_TICK_MS. */
  tick(dtMs: number): RunEvent[] {
    if (!(dtMs > 0)) return [];
    const dt = Math.min(dtMs, MAX_TICK_MS);
    const events: RunEvent[] = [];

    if (this.status === 'transition') {
      this.playMs += dt;
      this.transitionLeftMs -= dt;
      if (this.transitionLeftMs <= 0) {
        this.boardIndex++;
        this.loadBoard();
        this.status = 'playing';
        events.push({ type: 'next', boardNumber: this.boardIndex + 1 });
      }
      return events;
    }

    if (this.status !== 'playing') return events;

    this.playMs += dt;
    this.boardElapsedMs += dt;
    this.timeLeftMs -= dt;

    if (this.combo > 0) {
      this.comboLeftMs -= dt;
      if (this.comboLeftMs <= 0) {
        events.push({ type: 'comboEnd', combo: this.combo });
        this.combo = 0;
        this.comboLeftMs = 0;
      }
    }

    if (this.timeLeftMs <= 0) {
      this.timeLeftMs = 0;
      this.status = 'over';
      this.endedBy = 'time';
      events.push({ type: 'over' });
      return events;
    }

    const secondsLeft = Math.ceil(this.timeLeftMs / 1000);
    if (secondsLeft <= WARN_SECONDS && secondsLeft < this.lastWarn) {
      this.lastWarn = secondsLeft;
      events.push({ type: 'warn', secondsLeft });
    }
    return events;
  }

  pause(): void {
    if (this.status === 'playing' || this.status === 'ready' || this.status === 'transition') {
      this.resumeStatus = this.status;
      this.status = 'paused';
    }
  }

  resume(): void {
    if (this.status === 'paused') this.status = this.resumeStatus;
  }

  /** Abandona la partida. Devuelve el resultado solo si hubo juego real. */
  abandon(): RunResult | null {
    if (this.status === 'over') return this.result();
    const played = this.taps > 0;
    this.status = 'over';
    this.endedBy = 'quit';
    return played ? this.result() : null;
  }

  private clearBoard(): RunEvent {
    const tiles = activeCount(this.board);
    const eff = efficiency(this.par, this.boardTaps);
    const perfect = this.boardTaps <= Math.max(1, this.par);
    const bonusPoints = clearBonusPoints(tiles, this.par, this.boardTaps);
    const timeBonus = timeBonusMs(this.config, tiles, this.par, this.boardTaps, this.boardsCleared);
    const info: ClearInfo = {
      boardNumber: this.boardIndex + 1,
      tiles,
      par: this.par,
      taps: this.boardTaps,
      efficiency: eff,
      perfect,
      bonusPoints,
      timeBonusMs: timeBonus,
      solveMs: Math.round(this.boardElapsedMs),
      circuits: countCircuits(this.board),
    };

    this.score += bonusPoints;
    this.timeLeftMs += timeBonus;
    this.boardsCleared++;
    this.parTaps += this.par;
    this.tapsOnCleared += this.boardTaps;
    if (perfect) this.perfectBoards++;
    this.rating = nextRating(this.rating, this.boardElapsedMs, tiles, this.config);
    this.lastClear = info;
    this.status = 'transition';
    this.transitionLeftMs = TRANSITION_MS;
    // Tras superar los 5 s de aviso, permite volver a avisar en el siguiente tablero.
    this.lastWarn = Math.ceil(this.timeLeftMs / 1000) > WARN_SECONDS ? Infinity : this.lastWarn;
    return { type: 'clear', info };
  }

  private loadBoard(): void {
    const stage = this.mode === 'daily' ? dailyStage(this.boardIndex) : Math.floor(this.rating);
    const rng = createRng(`${this.seed}#${this.boardIndex}`);
    this.board = generateBoard(rng, stageSpec(this.difficulty, stage));
    this.par = computePar(this.board);
    this.locked = lockedFlags(this.board);
    // Las piezas que ya empiezan encendidas no puntúan hasta que se vuelvan a encender
    // por una acción del jugador: se marcan como ya vistas.
    this.everLocked = this.locked.slice();
    this.boardTaps = 0;
    this.boardElapsedMs = 0;
  }
}
