import { M3, V3, rotFromAxisAngle } from "./math";
import type { AppliedMove, MoveDef, Piece, PuzzleDef } from "./types";

export interface AnimState {
  move: MoveDef;
  dir: 1 | -1;
  pow: 1 | 2;
  t: number; // 0..1
  dur: number; // seconds for one full |angle|
  pieceSet: Set<number>;
  record: boolean;
}

type Listener = () => void;

/** Ease for layer turns (smooth, slight overshoot-free) */
export function easeTurn(t: number): number {
  // cubic in-out
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export class PuzzleEngine {
  def: PuzzleDef | null = null;
  pieces: Piece[] = [];
  private moveMap = new Map<string, MoveDef>();

  queue: { m: AppliedMove; dur?: number; record: boolean }[] = [];
  /** scramble that produced the current state (for the rewind solver) */
  lastScramble: AppliedMove[] = [];
  anim: AnimState | null = null;

  history: AppliedMove[] = [];
  redoStack: AppliedMove[] = [];
  /** moves made by the user since the last scramble/reset (for stats) */
  movesSinceScramble = 0;

  /** seconds per quarter turn (base) */
  turnDuration = 0.22;
  scrambleDuration = 0.05;
  solveDuration = 0.22;

  autoSolving = false;
  paused = false;

  private listeners = new Set<Listener>();
  private version = 0;

  subscribe = (fn: Listener) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = () => this.version;
  private emit() {
    this.version++;
    for (const fn of this.listeners) fn();
  }

  load(def: PuzzleDef) {
    this.def = def;
    this.pieces = def.pieces.map((p) => ({
      ...p,
      pos: [...p.pos] as Piece["pos"],
      ori: p.ori.slice(),
      stickers: p.stickers.map((s) => ({ ...s })),
    }));
    this.moveMap = new Map(def.moves.map((m) => [m.id, m]));
    this.queue = [];
    this.anim = null;
    this.history = [];
    this.redoStack = [];
    this.lastScramble = [];
    this.movesSinceScramble = 0;
    this.autoSolving = false;
    this.paused = false;
    this.emit();
  }

  moveDef(id: string): MoveDef | undefined {
    return this.moveMap.get(id);
  }

  get busy(): boolean {
    return this.anim !== null || this.queue.length > 0;
  }

  /** queue a move; manual moves clear the redo stack */
  apply(m: AppliedMove, opts?: { dur?: number; record?: boolean }) {
    if (!this.moveMap.has(m.moveId)) return false;
    this.queue.push({
      m: { pow: 1, ...m },
      dur: opts?.dur,
      record: opts?.record ?? true,
    });
    if (opts?.record ?? true) this.redoStack = [];
    this.emit();
    return true;
  }

  applyMany(ms: AppliedMove[], opts?: { dur?: number; record?: boolean }) {
    for (const m of ms) this.apply(m, opts);
  }

  scrambleNow(len?: number): AppliedMove[] {
    if (!this.def) return [];
    const s = this.def.scramble(len);
    this.autoSolving = false;
    this.movesSinceScramble = 0;
    this.history = [];
    this.redoStack = [];
    this.lastScramble = s;
    this.applyMany(s, { dur: this.scrambleDuration, record: false });
    return s;
  }

  /** full move trail from the solved state (used by the rewind solver) */
  trail(): AppliedMove[] {
    return [...this.lastScramble, ...this.history];
  }

  /** Begin an automatic solve: the engine animates the given solution. */
  startSolve(ms: AppliedMove[], duration?: number) {
    this.autoSolving = true;
    this.paused = false;
    this.applyMany(ms, {
      dur: (duration ?? this.solveDuration),
      record: false,
    });
  }

  stopSolve() {
    // keep current animation, drop the rest
    this.queue = [];
    this.autoSolving = false;
    this.paused = false;
    this.emit();
  }

  pauseSolve() {
    this.paused = true;
    this.emit();
  }
  resumeSolve() {
    this.paused = false;
    this.emit();
  }

  undo() {
    if (this.anim || this.queue.length) return;
    const last = this.history.pop();
    if (!last) return;
    this.redoStack.push(last);
    const inv: AppliedMove = { moveId: last.moveId, dir: last.dir === 1 ? -1 : 1, pow: last.pow };
    this.apply(inv, { record: false, dur: this.turnDuration });
    this.movesSinceScramble++;
  }

  /** called when an unrecorded inverse finishes to sync history after undo */
  private afterUndoCommit() {}

  redo() {
    if (this.anim || this.queue.length) return;
    const next = this.redoStack.pop();
    if (!next) return;
    this.apply({ ...next }, { record: false, dur: this.turnDuration });
    // record manually without touching redoStack
    this.pendingHistoryPush = next;
    this.movesSinceScramble++;
  }

  private pendingHistoryPush: AppliedMove | null = null;

  reset() {
    if (!this.def) return;
    this.load({ ...this.def });
  }

  /** exact state: apply a rotation to every piece in the layer */
  private commitMove(move: MoveDef, dir: 1 | -1, pow: 1 | 2, ids: Set<number>) {
    const times = pow;
    const R = rotFromAxisAngle(move.axis, move.angle * dir);
    for (let k = 0; k < times; k++) {
      for (const pid of ids) {
        const p = this.pieces[pid];
        p.pos = M3.mulVec(R, p.pos);
        p.ori = M3.mul(R, p.ori);
      }
    }
  }

  /** advance animation; dt in seconds */
  tick(dt: number) {
    if (this.paused) return;
    if (!this.anim) {
      const next = this.queue.shift();
      if (!next) return;
      const def = this.moveMap.get(next.m.moveId);
      if (!def) return;
      const pow = next.m.pow ?? 1;
      const base = next.dur ?? (next.record ? this.turnDuration : this.solveDuration);
      this.anim = {
        move: def,
        dir: next.m.dir,
        pow,
        t: 0,
        dur: Math.max(0.02, base * (pow === 2 ? 1.4 : 1)),
        pieceSet: new Set(def.select(this.pieces)),
        record: next.record,
      };
    }
    const a = this.anim;
    if (!a) return;
    a.t += dt / a.dur;
    if (a.t >= 1) {
      this.commitMove(a.move, a.dir, a.pow, a.pieceSet);
      if (a.record) {
        this.history.push({ moveId: a.move.id, dir: a.dir, pow: a.pow });
        this.movesSinceScramble++;
        if (this.history.length > 600) this.history.shift();
      }
      if (this.pendingHistoryPush) {
        this.history.push(this.pendingHistoryPush);
        this.pendingHistoryPush = null;
      }
      this.anim = null;
      if (this.queue.length === 0 && this.autoSolving) {
        this.autoSolving = false;
      }
      this.afterUndoCommit();
    } else {
      return; // mid-animation: no state change, no emission
    }
    this.emit();
  }

  isSolved(): boolean {
    if (!this.def) return false;
    const faceColor = (n: [number, number, number]) => {
      for (const f of this.def!.faces) if (V3.eq(f.n, n)) return f.color;
      return -1;
    };
    for (const p of this.pieces) {
      for (const s of p.stickers) {
        const w = M3.mulVec(p.ori, s.n);
        if (faceColor(w as [number, number, number]) !== s.c) return false;
      }
    }
    return true;
  }
}

export const engine = new PuzzleEngine();
