import { M3, V3 } from "./math";
import type {
  AppliedMove,
  FVec,
  Mat3,
  MoveDef,
  Piece,
  PuzzleDef,
  Sticker,
  Vec3,
} from "./types";

/**
 * Pyraminx on an exact integer lattice.
 * Tetra vertices v_i (unnormalized); big tetra = 6*v_i.
 * rotation by 120° about any v_i is a signed permutation matrix -> exact.
 */
export const TETRA_V: Vec3[] = [
  [1, 1, 1], // 0 = U (top after tilt)
  [1, -1, -1], // 1 = R
  [-1, 1, -1], // 2 = L... renamed below
  [-1, -1, 1], // 3 = B
];

const SCALE = 0.155;
const VNAMES = ["U", "R", "L", "B"];

/** face k is opposite vertex k, outward normal -v_k */
export const TETRA_FACES: { n: Vec3; color: number; name: string }[] = [
  { n: [-1, -1, -1], color: 3, name: "D" }, // bottom (yellow)
  { n: [-1, 1, 1], color: 2, name: "F" }, // front (green)
  { n: [1, -1, 1], color: 1, name: "R-face" }, // red
  { n: [1, 1, -1], color: 5, name: "B-face" }, // blue
];

const EDGE_PAIRS: [number, number][] = [
  [0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3],
];

export interface PyraminxGeometry {
  pieces: Piece[];
  moves: MoveDef[];
}

export function buildPyraminxGeometry(): PyraminxGeometry {
  const pieces: Piece[] = [];
  let id = 0;

  const fmul = (v: Vec3, s: number): FVec => [v[0] * s, v[1] * s, v[2] * s];

  // --- piece bodies ---------------------------------------------------------
  for (let i = 0; i < 4; i++) {
    const v = TETRA_V[i];
    pieces.push({
      id: id++,
      kind: "tip",
      pos: V3.scale(v, 5),
      ori: M3.IDENTITY.slice() as Mat3,
      stickers: [],
      shape: "tetra",
      renderPos: fmul(V3.scale(v, 5), SCALE),
      renderSize: 0.24,
    });
  }
  for (let i = 0; i < 4; i++) {
    const v = TETRA_V[i];
    pieces.push({
      id: id++,
      kind: "axial",
      pos: V3.scale(v, 3),
      ori: M3.IDENTITY.slice() as Mat3,
      stickers: [],
      shape: "tetra",
      renderPos: fmul(V3.scale(v, 3), SCALE),
      renderSize: 0.31,
    });
  }
  for (const [i, j] of EDGE_PAIRS) {
    const mid = V3.add(TETRA_V[i], TETRA_V[j]); // components like (2,0,0)
    const pos: Vec3 = [mid[0] * 2.5, mid[1] * 2.5, mid[2] * 2.5] as Vec3;
    pieces.push({
      id: id++,
      kind: "edge",
      pos,
      ori: M3.IDENTITY.slice() as Mat3,
      stickers: [],
      shape: "diamond",
      renderPos: fmul(pos, SCALE),
      renderSize: 0.32,
    });
  }

  // --- tessellated stickers on the 4 face planes -----------------------------
  // Face plane: dot(p, -v_k) = 6 (in lattice units).
  for (let k = 0; k < 4; k++) {
    const others = [0, 1, 2, 3].filter((i) => i !== k); // vertices of this face
    const [a, b, c] = others;
    const A = fmul(V3.scale(TETRA_V[a], 6), SCALE);
    const B = fmul(V3.scale(TETRA_V[b], 6), SCALE);
    const C = fmul(V3.scale(TETRA_V[c], 6), SCALE);
    const P = (x: number, y: number, z: number): FVec => [
      (x * A[0] + y * B[0] + z * C[0]) / 3,
      (x * A[1] + y * B[1] + z * C[1]) / 3,
      (x * A[2] + y * B[2] + z * C[2]) / 3,
    ];
    const centroid = (p1: FVec, p2: FVec, p3: FVec): FVec => [
      (p1[0] + p2[0] + p3[0]) / 3,
      (p1[1] + p2[1] + p3[1]) / 3,
      (p1[2] + p2[2] + p3[2]) / 3,
    ];
    const faceN: Vec3 = V3.neg(TETRA_V[k]);
    const nLen = Math.sqrt(3);
    const nFloat: FVec = [faceN[0] / nLen, faceN[1] / nLen, faceN[2] / nLen];

    const addSticker = (pieceIdx: number, c0: FVec, c1: FVec, c2: FVec) => {
      const cen = centroid(c0, c1, c2);
      const piece = pieces[pieceIdx];
      const up: FVec = [c0[0] - cen[0], c0[1] - cen[1], c0[2] - cen[2]];
      const ul = Math.hypot(up[0], up[1], up[2]) || 1;
      // lift the sticker slightly above the face plane to avoid z-fighting
      const lift = 0.004 + piece.id * 0.0004;
      const sticker: Sticker = {
        n: faceN,
        c: TETRA_FACES[k].color,
        off: [
          cen[0] - piece.renderPos[0] + nFloat[0] * lift,
          cen[1] - piece.renderPos[1] + nFloat[1] * lift,
          cen[2] - piece.renderPos[2] + nFloat[2] * lift,
        ],
        triUp: [up[0] / ul, up[1] / ul, up[2] / ul],
      };
      piece.stickers.push(sticker);
    };

    const tipIdx = (vertex: number) => vertex; // tips ids 0..3
    const axialIdx = (vertex: number) => 4 + vertex; // axials 4..7
    const edgeIdx = (i: number, j: number) =>
      8 + EDGE_PAIRS.findIndex(([x, y]) => (x === i && y === j) || (x === j && y === i));

    // up-triangles: i+j+l = 2 -> corners P(i+1,j,l) P(i,j+1,l) P(i,j,l+1)
    const grid: [number, number, number][] = [
      [2, 0, 0], [0, 2, 0], [0, 0, 2], [1, 1, 0], [1, 0, 1], [0, 1, 1],
    ];
    for (const [i, j, l] of grid) {
      const c0 = P(i + 1, j, l);
      const c1 = P(i, j + 1, l);
      const c2 = P(i, j, l + 1);
      if (i === 2 || j === 2 || l === 2) {
        const vertex = i === 2 ? a : j === 2 ? b : c;
        addSticker(tipIdx(vertex), c0, c1, c2);
      } else {
        // edge-mid triangle: zero index marks the missing vertex
        const keep = [a, b, c].filter((_, idx) => [i, j, l][idx] !== 0);
        addSticker(edgeIdx(keep[0], keep[1]), c0, c1, c2);
      }
    }
    // down-triangles: i+j+l = 1 -> inverted, belong to the axial of the
    // vertex whose grid coordinate is non-zero (centroid is closest there)
    const dgrid: [number, number, number][] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    for (const [i, j, l] of dgrid) {
      const c0 = P(i + 1, j + 1, l);
      const c1 = P(i + 1, j, l + 1);
      const c2 = P(i, j + 1, l + 1);
      const vertex = i === 1 ? a : j === 1 ? b : c;
      addSticker(axialIdx(vertex), c0, c1, c2);
    }
  }

  // --- moves ------------------------------------------------------------------
  // layers along axis v_i by projection dot(p, v_i): tip=15, axial=9, edge=5
  const moves: MoveDef[] = [];
  for (let i = 0; i < 4; i++) {
    const v = TETRA_V[i];
    moves.push({
      id: VNAMES[i],
      label: VNAMES[i],
      axis: v.slice() as Vec3,
      angle: -120,
      select: (ps) => ps.filter((p) => V3.dot(p.pos, v) >= 5).map((p) => p.id),
      group: VNAMES[i].toUpperCase(),
    });
    moves.push({
      id: VNAMES[i].toLowerCase(),
      label: VNAMES[i].toLowerCase(),
      axis: v.slice() as Vec3,
      angle: -120,
      select: (ps) => ps.filter((p) => V3.dot(p.pos, v) >= 15).map((p) => p.id),
      group: VNAMES[i].toUpperCase(),
    });
  }

  return { pieces, moves };
}

export function pyraminxScramble(moves: MoveDef[], len = 11): AppliedMove[] {
  const vertex = moves.filter((m) => /^[URLB]$/.test(m.id));
  const tips = moves.filter((m) => /^[urlb]$/.test(m.id));
  const out: AppliedMove[] = [];
  let last = "";
  while (out.length < len) {
    const m = vertex[Math.floor(Math.random() * vertex.length)];
    if (m.group === last) continue;
    last = m.group;
    out.push({ moveId: m.id, dir: Math.random() < 0.5 ? -1 : 1 });
  }
  for (const t of tips) {
    if (Math.random() < 0.55) out.push({ moveId: t.id, dir: Math.random() < 0.5 ? -1 : 1 });
  }
  return out;
}

export function buildPyraminxPuzzle(): PuzzleDef {
  const { pieces, moves } = buildPyraminxGeometry();
  return {
    id: "pyraminx",
    name: "Pyraminx",
    family: "pyraminx",
    order: 3,
    pieces,
    moves,
    faces: TETRA_FACES.map((f) => ({ n: f.n, color: f.color, name: f.name })),
    scramble: (len) => pyraminxScramble(moves, len ?? 11),
    radius: 1.75,
    worldScale: SCALE,
    solver: "pyra",
    solverLabel: "Optimal BFS solver (God's algorithm)",
    status: "ready",
  };
}
