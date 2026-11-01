// Headless end-to-end tests for the puzzle engine & solvers.
// Bundled with esbuild and run in Node (see scripts/run-tests.sh).
import { engine } from "../src/lib/engine/engine";
import { buildCubePuzzle, buildSkewbPuzzle } from "../src/lib/engine/cube";
import { buildPyraminxPuzzle } from "../src/lib/engine/pyraminx";
import { solveKociemba } from "../src/lib/solvers/twophase";
import { solvePocket, buildPocketTables } from "../src/lib/solvers/pocket";
import { solvePyra, buildPyraTables } from "../src/lib/solvers/pyra";
import { inverseMoves, parseMoves, formatMoves } from "../src/lib/notation";
import Cube from "cubejs";
import type { PieceSnap } from "../src/lib/solvers/protocol";

let failures = 0;
function check(name: string, cond: boolean, extra?: string) {
  if (cond) console.log(`  ok  ${name}${extra ? `  (${extra})` : ""}`);
  else {
    console.error(`FAIL  ${name}${extra ? `  (${extra})` : ""}`);
    failures++;
  }
}

function flush() {
  let guard = 0;
  while (engine.busy) {
    engine.tick(1e9);
    if (++guard > 2000) throw new Error("flush overflow");
  }
}

function snap(): PieceSnap[] {
  return engine.pieces.map((p) => ({
    id: p.id,
    kind: p.kind,
    pos: [...p.pos] as [number, number, number],
    ori: [...p.ori],
    stickers: p.stickers.map((s) => ({ n: [...s.n] as [number, number, number], c: s.c })),
  }));
}

// --- 3x3 + Kociemba -----------------------------------------------------------
console.log("\n== 3x3 + Kociemba ==");
Cube.initSolver();
{
  const def = buildCubePuzzle(3);
  engine.load(def);
  check("3x3 solved at start", engine.isSolved());
  for (let trial = 0; trial < 8; trial++) {
    engine.load(def);
    const scr = engine.scrambleNow();
    flush();
    check(`scramble ${trial} leaves unsolved`, !engine.isSolved());
    const r = solveKociemba(snap());
    engine.applyMany(r.moves, { record: false, dur: 0.01 });
    flush();
    check(`kociemba solves scramble ${trial}`, engine.isSolved(), `${r.moves.length} moves`);
  }
  // move-sequence consistency: R U R' U' x6 returns to start
  engine.load(def);
  const seq = parseMoves(def, "R U R' U'");
  for (let i = 0; i < 6; i++) engine.applyMany(seq, { record: false, dur: 0.01 });
  flush();
  check("(R U R' U') x6 identity", engine.isSolved());
}

// --- 2x2 + IDA* ---------------------------------------------------------------
console.log("\n== 2x2 + optimal IDA* ==");
{
  const t0 = Date.now();
  buildPocketTables();
  const def = buildCubePuzzle(2);
  engine.load(def);
  for (let trial = 0; trial < 10; trial++) {
    engine.load(def);
    engine.scrambleNow(9);
    flush();
    const r = solvePocket(snap());
    engine.applyMany(r.moves, { record: false, dur: 0.01 });
    flush();
    check(`pocket solver solves ${trial}`, engine.isSolved(), `${r.moves.length} moves (optimal)`);
  }
  console.log(`  tables+10 solves in ${Date.now() - t0}ms`);
}

// --- pyraminx + BFS ------------------------------------------------------------
console.log("\n== Pyraminx + optimal BFS ==");
{
  const t0 = Date.now();
  buildPyraTables();
  console.log(`  BFS tables in ${Date.now() - t0}ms`);
  const def = buildPyraminxPuzzle();
  engine.load(def);
  check("pyraminx solved at start", engine.isSolved());
  for (let trial = 0; trial < 10; trial++) {
    engine.load(def);
    engine.scrambleNow(11);
    flush();
    const r = solvePyra(snap());
    engine.applyMany(r.moves, { record: false, dur: 0.01 });
    flush();
    check(`pyra solver solves ${trial}`, engine.isSolved(), `${r.moves.length} moves`);
  }
}

// --- skewb + rewind -------------------------------------------------------------
console.log("\n== Skewb + rewind solver ==");
{
  const def = buildSkewbPuzzle();
  engine.load(def);
  check("skewb solved at start", engine.isSolved());
  for (let trial = 0; trial < 6; trial++) {
    engine.load(def);
    const scr = engine.scrambleNow();
    flush();
    check(`skewb scrambled ${trial}`, !engine.isSolved());
    engine.applyMany(inverseMoves(engine.trail()), { record: false, dur: 0.01 });
    flush();
    check(`rewind solves skewb ${trial}`, engine.isSolved());
    void scr;
  }
  // a skewb axis turn applied 3x is identity
  engine.load(def);
  for (let i = 0; i < 3; i++) engine.apply({ moveId: "R", dir: 1, pow: 1 }, { record: false, dur: 0.01 });
  flush();
  check("skewb R x3 identity", engine.isSolved());
}

// --- 4x4 + 5x5 sanity: wide moves invert ----------------------------------------
console.log("\n== Big cubes ==");
for (const n of [4, 5, 7]) {
  const def = buildCubePuzzle(n);
  engine.load(def);
  check(`${n}x solved at start`, engine.isSolved());
  const scr = engine.scrambleNow(20);
  flush();
  check(`${n}x scrambled`, !engine.isSolved());
  engine.applyMany(inverseMoves(engine.trail()), { record: false, dur: 0.005 });
  flush();
  check(`${n}x rewind solves`, engine.isSolved());
  void scr;
}

// --- undo/redo -------------------------------------------------------------------
console.log("\n== History ==");
{
  const def = buildCubePuzzle(3);
  engine.load(def);
  const scr = engine.scrambleNow(12);
  flush();
  check("scramble not in history (moves since scramble = 0)", engine.movesSinceScramble === 0);
  engine.applyMany(parseMoves(def, "R U F'"), { record: true, dur: 0.01 });
  flush();
  check("history length 3", engine.history.length === 3);
  engine.undo(); flush();
  engine.undo(); flush();
  engine.undo(); flush();
  check("3 undos return to scrambled state", engine.movesSinceScramble === 6);
  engine.undo(); flush();
  engine.applyMany(inverseMoves(engine.trail()), { record: false, dur: 0.01 });
  flush();
  check("full undo trail solves", engine.isSolved(), formatMoves(scr).length > 0 ? "" : "");
}

if (failures) {
  console.error(`\n${failures} FAILURE(S)`);
  process.exit(1);
}
console.log("\nAll engine tests passed.");
