// ---------------------------------------------------------------------------
// Optimal 2x2 Pocket Cube solver: IDA* over corner permutation & orientation
// with BFS pattern tables, in the {U,R,F} move group with an anchored corner.
// ---------------------------------------------------------------------------
import { CUBE_ROTATIONS, M3, rotFromAxisAngle } from "../engine/math";
import type { AppliedMove, Mat3, Vec3 } from "../engine/types";
import type { PieceSnap } from "./protocol";

// kociemba corner order: URF, UFL, ULB, UBR, DFR, DLF, DBL, DRB
export const CORNER_SLOTS: Vec3[] = [
  [1, 1, 1],
  [-1, 1, 1],
  [-1, 1, -1],
  [1, 1, -1],
  [1, -1, 1],
  [-1, -1, 1],
  [-1, -1, -1],
  [1, -1, -1],
];

function dirColor(d: Vec3): number {
  if (d[0] === 1) return 1;
  if (d[0] === -1) return 4;
  if (d[1] === 1) return 0;
  if (d[1] === -1) return 3;
  if (d[2] === 1) return 2;
  return 5;
}

/** canonical colors for the corner whose home is slot s */
const PIECE_COLORS: number[][] = CORNER_SLOTS.map((s) => {
  const dirs: Vec3[] = [
    [s[0], 0, 0],
    [0, s[1], 0],
    [0, 0, s[2]],
  ];
  return dirs
    .map(dirColor)
    .slice()
    .sort((a, b) => a - b);
});

const PIECE_BY_COLORKEY = new Map<string, number>();
PIECE_COLORS.forEach((cs, i) => PIECE_BY_COLORKEY.set(cs.join(","), i));

const ANCHOR_SLOT = 6; // DBL
const SOLVER_MOVES: { id: string; R: Mat3; layer: (s: number) => boolean }[] = [];
for (const f of ["U", "R", "F"] as const) {
  const axisIdx = f === "R" ? 0 : f === "U" ? 1 : 2;
  const axis: Vec3 = f === "U" ? [0, 1, 0] : f === "R" ? [1, 0, 0] : [0, 0, 1];
  for (let p = 1; p <= 3; p++) {
    SOLVER_MOVES.push({
      id: f + (p === 2 ? "2" : p === 3 ? "'" : ""),
      R: rotFromAxisAngle(axis, -90 * p),
      layer: (s) => CORNER_SLOTS[s][axisIdx] === 1,
    });
  }
}

/** slot outward directions [x, y, z]-ish unit vectors */
function slotDirs(s: number): Vec3[] {
  const p = CORNER_SLOTS[s];
  return [
    [p[0], 0, 0],
    [0, p[1], 0],
    [0, 0, p[2]],
  ];
}

function oriFrom(s: number, w: Vec3): number {
  const d = slotDirs(s);
  if (w[0] === d[1][0] && w[1] === d[1][1] && w[2] === d[1][2]) return 0;
  if (w[0] === d[0][0] && w[1] === d[0][1] && w[2] === d[0][2]) return 1;
  if (w[0] === d[2][0] && w[1] === d[2][1] && w[2] === d[2][2]) return 2;
  return -1;
}
function normalFrom(s: number, o: number): Vec3 {
  const d = slotDirs(s);
  return o === 0 ? d[1] : o === 1 ? d[0] : d[2];
}

// --- index encoding ----------------------------------------------------------
const MOVABLE_SLOTS = [0, 1, 2, 3, 4, 5, 7]; // all but anchor slot 6
const MOVABLE_PIECES = [0, 1, 2, 3, 4, 5, 7]; // all but anchor piece 6

function lehmerEncode(items: number[], universe: number[]): number {
  let idx = 0;
  const avail = universe.slice();
  for (let i = 0; i < items.length; i++) {
    const pos = avail.indexOf(items[i]);
    idx = idx * (avail.length) + pos;
    avail.splice(pos, 1);
  }
  return idx;
}
function lehmerDecode(idx: number, universe: number[]): number[] {
  const n = universe.length;
  const digits: number[] = new Array(n).fill(0);
  let x = idx;
  for (let i = n - 1; i >= 0; i--) {
    digits[i] = x % (n - i);
    x = Math.floor(x / (n - i));
  }
  const pool = universe.slice();
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(pool[digits[i]]);
    pool.splice(digits[i], 1);
  }
  return out;
}

const PERM_N = 5040; // 7!
const ORI_N = 2187; // 3^7

function encodePerm(perm: number[]): number {
  const movable = MOVABLE_SLOTS.map((s) => perm[s]);
  return lehmerEncode(movable, MOVABLE_PIECES);
}
function decodePerm(idx: number): number[] {
  const movable = lehmerDecode(idx, MOVABLE_PIECES);
  const perm = new Array(8).fill(-1);
  MOVABLE_SLOTS.forEach((s, i) => (perm[s] = movable[i]));
  perm[ANCHOR_SLOT] = 6;
  return perm;
}
function encodeOri(ori: number[]): number {
  let x = 0;
  for (const s of MOVABLE_SLOTS) x = x * 3 + ori[s];
  return x;
}
function decodeOri(idx: number): number[] {
  const ori = new Array(8).fill(0);
  let x = idx;
  for (let i = MOVABLE_SLOTS.length - 1; i >= 0; i--) {
    ori[MOVABLE_SLOTS[i]] = x % 3;
    x = Math.floor(x / 3);
  }
  return ori;
}

function applyMove(
  perm: number[],
  ori: number[],
  mv: { R: Mat3; layer: (s: number) => boolean },
): [number[], number[]] {
  const np = perm.slice();
  const no = ori.slice();
  for (let s = 0; s < 8; s++) {
    if (!mv.layer(s)) continue;
    const from = M3.mulVec(mv.R, CORNER_SLOTS[s]);
    const dst = CORNER_SLOTS.findIndex(
      (p) => p[0] === from[0] && p[1] === from[1] && p[2] === from[2],
    );
    np[dst] = perm[s];
    const w = normalFrom(s, ori[s]);
    const w2 = M3.mulVec(mv.R, w);
    no[dst] = oriFrom(dst, w2);
  }
  return [np, no];
}

// --- tables -------------------------------------------------------------------
let permMoves: Int32Array | null = null;
let oriMoves: Int32Array | null = null;
let hPerm: Uint8Array | null = null;
let hOri: Uint8Array | null = null;

export function buildPocketTables() {
  if (permMoves) return;
  const M = SOLVER_MOVES.length;
  permMoves = new Int32Array(PERM_N * M);
  oriMoves = new Int32Array(ORI_N * M);
  for (let p = 0; p < PERM_N; p++) {
    const perm = decodePerm(p);
    for (let m = 0; m < M; m++) {
      const [np] = applyMove(perm, decodeOri(0), SOLVER_MOVES[m]);
      permMoves[p * M + m] = encodePerm(np);
    }
  }
  for (let o = 0; o < ORI_N; o++) {
    const ori = decodeOri(o);
    for (let m = 0; m < M; m++) {
      const [, no] = applyMove(decodePerm(0), ori, SOLVER_MOVES[m]);
      oriMoves[o * M + m] = encodeOri(no);
    }
  }
  const bfs = (table: Int32Array, size: number): Uint8Array => {
    const dist = new Uint8Array(size).fill(255);
    dist[0] = 0;
    const queue: number[] = [0];
    let qi = 0;
    while (qi < queue.length) {
      const cur = queue[qi++];
      const d = dist[cur];
      for (let m = 0; m < M; m++) {
        const nxt = table[cur * M + m];
        if (dist[nxt] === 255) {
          dist[nxt] = d + 1;
          queue.push(nxt);
        }
      }
    }
    return dist;
  };
  hPerm = bfs(permMoves, PERM_N);
  hOri = bfs(oriMoves, ORI_N);
}

// --- decode engine state -------------------------------------------------------
export function decodePocketDebug(pieces: PieceSnap[]): { perm: number[]; ori: number[] } {
  const corners = pieces.filter((p) => p.kind === "corner");
  if (corners.length !== 8) throw new Error("Expected 8 corner pieces");
  const anchor = corners.find((p) => {
    const cs = p.stickers.map((s) => s.c).sort((a, b) => a - b);
    return cs[0] === 3 && cs[1] === 4 && cs[2] === 5;
  });
  if (!anchor) throw new Error("Invalid 2×2 state: DBL corner not found");
  const udSticker = anchor.stickers.find((s) => s.c === 0 || s.c === 3)!;
  const m = M3.mulVec(anchor.ori as Mat3, udSticker.n);
  const g = CUBE_ROTATIONS.find((R) => {
    const p2 = M3.mulVec(R, anchor.pos);
    const m2 = M3.mulVec(R, m);
    return p2[0] === -1 && p2[1] === -1 && p2[2] === -1 && m2[0] === 0 && m2[1] === -1 && m2[2] === 0;
  });
  if (!g) throw new Error("Invalid 2×2 state: cannot anchor");
  const perm = new Array(8).fill(-1);
  const ori = new Array(8).fill(0);
  for (const c of corners) {
    const pos = M3.mulVec(g, c.pos);
    const slot = CORNER_SLOTS.findIndex(
      (p) => p[0] === pos[0] && p[1] === pos[1] && p[2] === pos[2],
    );
    if (slot < 0) throw new Error("Invalid 2×2 state: corner off lattice");
    const key = c.stickers
      .map((s) => s.c)
      .sort((a, b) => a - b)
      .join(",");
    const piece = PIECE_BY_COLORKEY.get(key);
    if (piece === undefined) throw new Error("Invalid 2×2 state: unknown corner colors");
    perm[slot] = piece;
    if (slot === ANCHOR_SLOT) continue;
    const ud = c.stickers.find((s) => s.c === 0 || s.c === 3)!;
    const w = M3.mulVec(M3.mul(g, c.ori as Mat3), ud.n);
    const o = oriFrom(slot, w);
    if (o < 0) throw new Error("Invalid 2×2 state: bad twist");
    ori[slot] = o;
  }
  if (new Set(perm).size !== 8) throw new Error("Invalid 2×2 state: duplicate corners");
  return { perm, ori };
}

/** Solve a 2x2 snapshot. Returns engine moves (ids U/R/F + pow/dir). */
export function solvePocket(pieces: PieceSnap[]): { moves: AppliedMove[]; depth: number } {
  buildPocketTables();
  const { perm, ori } = decodePocketDebug(pieces);
  const M = SOLVER_MOVES.length;
  let p0 = encodePerm(perm);
  let o0 = encodeOri(ori);
  if (p0 === 0 && o0 === 0) return { moves: [], depth: 0 };

  const path: number[] = [];
  let nodes = 0;
  const MAX_NODES = 4_000_000;

  const h = hPerm!;
  const ho = hOri!;
  const pm = permMoves!;
  const om = oriMoves!;

  const ida = (p: number, o: number, g: number, bound: number, lastFace: number): number => {
    const heuristic = Math.max(h[p], ho[o]);
    const f = g + heuristic;
    if (f > bound) return f;
    if (p === 0 && o === 0) return -1;
    let min = Infinity;
    for (let m = 0; m < M; m++) {
      const face = Math.floor(m / 3);
      if (face === lastFace) continue;
      if (++nodes > MAX_NODES) throw new Error("2×2 solver exceeded search budget");
      path.push(m);
      const t = ida(pm[p * M + m], om[o * M + m], g + 1, bound, face);
      if (t === -1) return -1;
      if (t < min) min = t;
      path.pop();
    }
    return min;
  };

  let bound = Math.max(h[p0], ho[o0]);
  for (;;) {
    const t = ida(p0, o0, 0, bound, -1);
    if (t === -1) break;
    bound = t;
    if (bound > 20) throw new Error("2×2 solver failed");
  }

  const moves: AppliedMove[] = path.map((mi) => {
    const tok = SOLVER_MOVES[mi].id;
    const pow = tok.endsWith("2") ? 2 : 1;
    const dir = tok.endsWith("'") ? -1 : 1;
    return { moveId: tok[0], dir, pow: pow as 1 | 2 };
  });
  return { moves, depth: moves.length };
}


