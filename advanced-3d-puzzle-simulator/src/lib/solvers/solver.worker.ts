/// <reference types="vite/client" />
import Cube from "cubejs";
import { inverseMoves } from "../notation";
import type { SolverRequest, SolverResponse } from "./protocol";
import { solvePocket, buildPocketTables } from "./pocket";
import { solvePyra, buildPyraTables } from "./pyra";
import { solveKociemba } from "./twophase";

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<SolverRequest>) => void) | null;
  postMessage: (m: SolverResponse) => void;
};

let ready = false;

function init() {
  const phases: string[] = [];
  Cube.initSolver();
  phases.push("Kociemba two-phase tables");
  buildPocketTables();
  phases.push("Pocket-cube pattern databases");
  buildPyraTables();
  phases.push("Pyraminx God's-number BFS (933k states)");
  ready = true;
  ctx.postMessage({ t: "ready", phases });
}

ctx.onmessage = (e) => {
  const msg = e.data;
  if (msg.t === "init") {
    try {
      init();
    } catch (err) {
      ctx.postMessage({ t: "error", seq: -1, message: String(err) });
    }
    return;
  }
  if (msg.t === "solve") {
    if (!ready) init();
    try {
      if (msg.solver === "kociemba") {
        const r = solveKociemba(msg.pieces);
        ctx.postMessage({
          t: "solved",
          seq: msg.seq,
          moves: r.moves,
          alg: "Kociemba two-phase",
          detail: `Two-phase algorithm found a ${r.length}-move solution (phase 1 reduces to the <U,D,R2,F2,L2,B2> subgroup, phase 2 finishes there).`,
          optimal: false,
        });
      } else if (msg.solver === "pocket") {
        const r = solvePocket(msg.pieces);
        ctx.postMessage({
          t: "solved",
          seq: msg.seq,
          moves: r.moves,
          alg: "IDA* + pattern databases",
          detail: `Optimal solution: ${r.moves.length} moves (anchored-corner IDA* over 7! permutations × 3⁷ twists).`,
          optimal: true,
        });
      } else if (msg.solver === "pyra") {
        const r = solvePyra(msg.pieces);
        ctx.postMessage({
          t: "solved",
          seq: msg.seq,
          moves: r.moves,
          alg: "God's algorithm (full BFS)",
          detail: `Optimal solution: ${r.optimal} layer turns + tip alignment, from a complete breadth-first map of all 933,120 Pyraminx states.`,
          optimal: true,
        });
      } else if (msg.solver === "reverse") {
        const hist = msg.history ?? [];
        const moves = inverseMoves(hist);
        ctx.postMessage({
          t: "solved",
          seq: msg.seq,
          moves,
          alg: "Smart rewind",
          detail: `Replays the exact inverse of the ${hist.length} moves that created this state — always correct for positions reached by legal moves.`,
          optimal: false,
        });
      } else {
        ctx.postMessage({ t: "error", seq: msg.seq, message: "No solver for this puzzle" });
      }
    } catch (err) {
      ctx.postMessage({
        t: "error",
        seq: msg.seq,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
};
