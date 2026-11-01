import SolverWorker from "./solvers/solver.worker.ts?worker&inline";
import type { AppliedMove } from "./engine/types";
import type { PieceSnap, SolverRequest, SolverResponse } from "./solvers/protocol";

export interface SolveResult {
  moves: AppliedMove[];
  alg: string;
  detail: string;
  optimal: boolean;
}

type Listener = (ready: boolean) => void;

class SolverClient {
  private worker: Worker | null = null;
  private seq = 0;
  private pending = new Map<
    number,
    { resolve: (r: SolveResult) => void; reject: (e: Error) => void }
  >();
  isReady = false;
  initFailed = false;
  private readyListeners = new Set<Listener>();

  onReady(fn: Listener) {
    this.readyListeners.add(fn);
    return () => {
      this.readyListeners.delete(fn);
    };
  }

  init() {
    if (this.worker) return;
    try {
      this.worker = new SolverWorker();
    } catch {
      this.initFailed = true;
      return;
    }
    this.worker.onmessage = (e: MessageEvent<SolverResponse>) => {
      const m = e.data;
      if (m.t === "ready") {
        this.isReady = true;
        this.readyListeners.forEach((f) => f(true));
      } else if (m.t === "solved" || m.t === "error") {
        const p = this.pending.get(m.seq);
        if (!p) return;
        this.pending.delete(m.seq);
        if (m.t === "solved")
          p.resolve({ moves: m.moves, alg: m.alg, detail: m.detail, optimal: m.optimal });
        else p.reject(new Error(m.message));
      }
    };
    this.worker.onerror = () => {
      this.initFailed = true;
      this.readyListeners.forEach((f) => f(false));
    };
    const req: SolverRequest = { t: "init" };
    this.worker.postMessage(req);
  }

  solve(
    solver: "kociemba" | "pocket" | "pyra" | "reverse",
    pieces: PieceSnap[],
    history?: AppliedMove[],
  ): Promise<SolveResult> {
    if (!this.worker) throw new Error("Solver worker unavailable");
    const seq = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(seq, { resolve, reject });
      const req: SolverRequest = { t: "solve", seq, solver, pieces, history };
      this.worker!.postMessage(req);
      // hard timeout guard
      setTimeout(() => {
        if (this.pending.has(seq)) {
          this.pending.delete(seq);
          reject(new Error("Solver timed out"));
        }
      }, 30000);
    });
  }
}

export const solverClient = new SolverClient();
