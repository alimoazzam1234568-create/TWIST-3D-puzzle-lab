// ---------------------------------------------------------------------------
// Optimal Pyraminx solver. State = edge permutation (6!) x edge flip (2^6)
// x axial twists (3^4); tips are trivial and fixed afterwards. Transition
// tables are DERIVED FROM THE EXACT GEOMETRY model, then a full BFS from the
// solved state (933,120 reachable states) gives God's-algorithm solutions.
// ---------------------------------------------------------------------------
import { M3, V3, rotFromAxisAngle } from "../engine/math";
import type { AppliedMove, Mat3, Vec3 } from "../engine/types";
import { TETRA_V, TETRA_FACES } from "../engine/pyraminx";
import type { PieceSnap } from "./protocol";

const EDGE_PAIRS: [number, number][] = [
  [0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3],
];

interface SlotInfo {
  pos: Vec3;
  /** two face normals (integer), sorted by face index */
  normals: [Vec3, Vec3];
}

function faceIndexOfNormal(n: Vec3): number {
  return TETRA_FACES.findIndex((f) => V3.eq(f.n, n));
}

const SLOTS: SlotInfo[] = EDGE_PAIRS.map(([i, j]) => {
  const mid = V3.add(TETRA_V[i], TETRA_V[j]);
  const pos: Vec3 = [(mid[0] * 5) / 2, (mid[1] * 5) / 2, (mid[2] * 5) / 2];
  const others = [0, 1, 2, 3].filter((x) => x !== i && x !== j);
  const normals = others
    .map((k) => V3.neg(TETRA_V[k]))
    .sort((a, b) => faceIndexOfNormal(a) - faceIndexOfNormal(b)) as [Vec3, Vec3];
  return { pos, normals };
});

const VNAME = ["U", "R", "L", "B"];

interface PyraState {
  perm: number[]; // slot -> edge piece (0..5, piece id - 8)
  flip: number[]; // 6 bits
  ax: number[]; // 4 axial twists
  tip: number[]; // 4 tip twists
}

interface PyraMove {
  name: string;
  vertex: number;
  dir: 1 | -1;
  permMap: number[]; // src slot -> dst slot (identity when unmoved)
  flipXor: number[]; // per src slot
  axDelta: number[]; // per axial
  R: Mat3;
}

let MOVES: PyraMove[] | null = null;
let DIST: Uint8Array | null = null;

const PERM_N = 720;
const FLIP_N = 64;
const AX_N = 81;
const TOTAL = PERM_N * FLIP_N * AX_N;

function lehmerEnc(perm: number[]): number {
  let idx = 0;
  const avail = [0, 1, 2, 3, 4, 5];
  for (let i = 0; i < 6; i++) {
    const pos = avail.indexOf(perm[i]);
    idx = idx * (6 - i) + pos;
    avail.splice(pos, 1);
  }
  return idx;
}
function lehmerDec(idx: number): number[] {
  const digits = new Array(6).fill(0);
  let x = idx;
  for (let i = 5; i >= 0; i--) {
    digits[i] = x % (6 - i);
    x = Math.floor(x / (6 - i));
  }
  const pool = [0, 1, 2, 3, 4, 5];
  return digits.map((d) => pool.splice(d, 1)[0]);
}

function encIndex(perm: number[], flip: number[], ax: number[]): number {
  let fb = 0;
  for (let i = 0; i < 6; i++) fb |= flip[i] << i;
  let ab = 0;
  for (let i = 0; i < 4; i++) ab = ab * 3 + ax[i];
  return (lehmerEnc(perm) * FLIP_N + fb) * AX_N + ab;
}

function buildMoves(): PyraMove[] {
  const out: PyraMove[] = [];
  for (let i = 0; i < 4; i++) {
    for (const dir of [1, -1] as const) {
      const R = rotFromAxisAngle(TETRA_V[i], -120 * dir);
      const permMap = [0, 1, 2, 3, 4, 5];
      const flipXor = new Array(6).fill(0);
      for (let src = 0; src < 6; src++) {
        const sp = SLOTS[src].pos;
        if (V3.dot(sp, TETRA_V[i]) < 5) {
          permMap[src] = src;
          continue;
        }
        const dstPos = M3.mulVec(R, sp);
        const dst = SLOTS.findIndex((s) => V3.eq(s.pos, dstPos));
        permMap[src] = dst;
        // edge piece with flip 0 at src: its l1 normal is SLOTS[src].normals[0];
        // after rotation it should equal SLOTS[dst].normals[0] for flip 0.
        const rotated = M3.mulVec(R, SLOTS[src].normals[0]);
        flipXor[src] = V3.eq(rotated, SLOTS[dst].normals[0]) ? 0 : 1;
      }
      const axDelta = [0, 0, 0, 0];
      axDelta[i] = dir === 1 ? 1 : 2;
      out.push({ name: VNAME[i] + (dir === -1 ? "'" : ""), vertex: i, dir, permMap, flipXor, axDelta, R });
    }
  }
  return out;
}

let PT: Int32Array | null = null; // perm transition tables: 8 moves x 720
let FT: Uint8Array | null = null; // flip transition tables: 8 x 64
let AT: Uint8Array | null = null; // axial transition tables: 8 x 81

export function buildPyraTables() {
  if (DIST) return;
  MOVES = buildMoves();
  const NM = MOVES.length;

  // precompute index-level transitions (much faster than decode+apply+encode)
  PT = new Int32Array(NM * PERM_N);
  FT = new Uint8Array(NM * FLIP_N);
  AT = new Uint8Array(NM * AX_N);
  for (let m = 0; m < NM; m++) {
    const mv = MOVES[m];
    for (let p = 0; p < PERM_N; p++) {
      const perm = lehmerDec(p);
      const np = new Array(6);
      for (let src = 0; src < 6; src++) np[mv.permMap[src]] = perm[src];
      PT[m * PERM_N + p] = lehmerEnc(np);
    }
    for (let f = 0; f < FLIP_N; f++) {
      let nf = 0;
      for (let src = 0; src < 6; src++) {
        const dst = mv.permMap[src];
        nf |= (((f >> src) & 1) ^ mv.flipXor[src]) << dst;
      }
      FT[m * FLIP_N + f] = nf;
    }
    for (let a = 0; a < AX_N; a++) {
      // decode axial, add delta, re-encode
      const d0 = Math.floor(a / 27) % 3;
      const d1 = Math.floor(a / 9) % 3;
      const d2 = Math.floor(a / 3) % 3;
      const d3 = a % 3;
      const ds = [
        (d0 + mv.axDelta[0]) % 3,
        (d1 + mv.axDelta[1]) % 3,
        (d2 + mv.axDelta[2]) % 3,
        (d3 + mv.axDelta[3]) % 3,
      ];
      AT[m * AX_N + a] = ds[0] * 27 + ds[1] * 9 + ds[2] * 3 + ds[3];
    }
  }

  DIST = new Uint8Array(TOTAL).fill(255);
  DIST[0] = 0;
  const queue = new Int32Array(TOTAL);
  let head = 0;
  let tail = 0;
  queue[tail++] = 0;
  const PTl = PT, FTl = FT, ATl = AT, D = DIST;
  while (head < tail) {
    const cur = queue[head++];
    const d = D[cur] + 1;
    const p = Math.floor(cur / (FLIP_N * AX_N));
    const r = cur % (FLIP_N * AX_N);
    const f = Math.floor(r / AX_N);
    const a = r % AX_N;
    for (let m = 0; m < NM; m++) {
      const nxt = (PTl[m * PERM_N + p] * FLIP_N + FTl[m * FLIP_N + f]) * AX_N + ATl[m * AX_N + a];
      if (D[nxt] === 255) {
        D[nxt] = d;
        queue[tail++] = nxt;
      }
    }
  }
}

// --- decode engine pieces ------------------------------------------------------
function decodeMatrixTwist(ori: number[], axis: Vec3): number {
  for (let k = 0; k < 3; k++) {
    const R = rotFromAxisAngle(axis, -120 * k);
    if (R.every((v, i) => v === Math.round(ori[i]))) return k;
  }
  return -1;
}

export function decodePyra(pieces: PieceSnap[]): PyraState {
  const perm = new Array(6).fill(-1);
  const flip = new Array(6).fill(0);
  const ax = new Array(4).fill(-1);
  const tip = new Array(4).fill(-1);
  for (const p of pieces) {
    if (p.kind === "edge") {
      const slot = SLOTS.findIndex((s) => V3.eq(s.pos, p.pos));
      if (slot < 0) throw new Error("Invalid Pyraminx: edge off lattice");
      const piece = p.id - 8;
      perm[slot] = piece;
      const l1 = SLOTS[piece].normals[0];
      const w = M3.mulVec(p.ori as Mat3, l1);
      if (V3.eq(w, SLOTS[slot].normals[0])) flip[slot] = 0;
      else if (V3.eq(w, SLOTS[slot].normals[1])) flip[slot] = 1;
      else throw new Error("Invalid Pyraminx: bad edge orientation");
    } else if (p.kind === "axial") {
      const vIdx = TETRA_V.findIndex((v) => V3.eq(V3.scale(v, 3), p.pos));
      if (vIdx < 0) throw new Error("Invalid Pyraminx: axial off lattice");
      const k = decodeMatrixTwist(p.ori, TETRA_V[vIdx]);
      if (k < 0) throw new Error("Invalid Pyraminx: bad axial twist");
      ax[vIdx] = k;
    } else if (p.kind === "tip") {
      const vIdx = TETRA_V.findIndex((v) => V3.eq(V3.scale(v, 5), p.pos));
      if (vIdx < 0) throw new Error("Invalid Pyraminx: tip off lattice");
      const k = decodeMatrixTwist(p.ori, TETRA_V[vIdx]);
      if (k < 0) throw new Error("Invalid Pyraminx: bad tip twist");
      tip[vIdx] = k;
    }
  }
  if (perm.some((x) => x < 0) || new Set(perm).size !== 6)
    throw new Error("Invalid Pyraminx: edge permutation broken");
  return { perm, flip, ax, tip };
}

export function solvePyra(pieces: PieceSnap[]): { moves: AppliedMove[]; optimal: number } {
  buildPyraTables();
  const moves = MOVES!;
  const dist = DIST!;
  const P = PT!;
  const F = FT!;
  const A = AT!;
  const state = decodePyra(pieces);
  const tips = state.tip.slice();
  const path: PyraMove[] = [];
  let guard = 0;
  let idx = encIndex(state.perm, state.flip, state.ax);
  while (dist[idx] !== 0) {
    if (++guard > 24) throw new Error("Pyraminx solver: walk failed");
    const d = dist[idx];
    const p = Math.floor(idx / (FLIP_N * AX_N));
    const r = idx % (FLIP_N * AX_N);
    const f = Math.floor(r / AX_N);
    const a = r % AX_N;
    let advanced = false;
    for (let m = 0; m < moves.length; m++) {
      const ni =
        (P[m * PERM_N + p] * FLIP_N + F[m * FLIP_N + f]) * AX_N + A[m * AX_N + a];
      if (dist[ni] === d - 1) {
        const mv = moves[m];
        path.push(mv);
        tips[mv.vertex] = (tips[mv.vertex] + (mv.dir === 1 ? 1 : 2)) % 3;
        idx = ni;
        advanced = true;
        break;
      }
    }
    if (!advanced) throw new Error("Pyraminx solver: inconsistent tables");
  }
  const out: AppliedMove[] = path.map((mv) => ({
    moveId: VNAME[mv.vertex],
    dir: mv.dir,
    pow: 1,
  }));
  // fix tips (they decode as k dir=+1 twists; fix = (3-k) mod 3 twists)
  tips.forEach((k, i) => {
    const fix = (3 - k) % 3;
    if (fix === 1) out.push({ moveId: VNAME[i].toLowerCase(), dir: 1, pow: 1 });
    else if (fix === 2) out.push({ moveId: VNAME[i].toLowerCase(), dir: -1, pow: 1 });
  });
  return { moves: out, optimal: path.length };
}
