import { M3, V3 } from "./math";
import type {
  AppliedMove,
  Mat3,
  MoveDef,
  Piece,
  PieceKind,
  PuzzleDef,
  Vec3,
} from "./types";
import { CUBE_FACES } from "./types";

const FACE_AT: { axis: Vec3; side: 1 | -1; letter: string }[] = [
  { axis: [1, 0, 0], side: 1, letter: "R" },
  { axis: [1, 0, 0], side: -1, letter: "L" },
  { axis: [0, 1, 0], side: 1, letter: "U" },
  { axis: [0, 1, 0], side: -1, letter: "D" },
  { axis: [0, 0, 1], side: 1, letter: "F" },
  { axis: [0, 0, 1], side: -1, letter: "B" },
];

export function faceColorForNormal(n: Vec3): number {
  for (const f of CUBE_FACES) if (V3.eq(f.n, n)) return f.color;
  return 0;
}

/**
 * Lattice positions are "doubled-centered": grid cell x maps to 2x-(n-1),
 * so every coordinate is an integer symmetric around 0 and quarter turns
 * stay exact for even and odd N.
 */
function dc(x: number, n: number): number {
  return 2 * x - (n - 1);
}

/** Build the piece set of an NxN cube (only stickered surface cubies). */
export function buildCubePieces(n: number): Piece[] {
  const pieces: Piece[] = [];
  const pitch = 3 / n;
  const size = pitch * 0.96;
  let id = 0;
  for (let x = 0; x < n; x++)
    for (let y = 0; y < n; y++)
      for (let z = 0; z < n; z++) {
        const atSurface =
          x === 0 || y === 0 || z === 0 || x === n - 1 || y === n - 1 || z === n - 1;
        if (!atSurface) continue;
        const stickers: Piece["stickers"] = [];
        const dirs: Vec3[] = [
          [x === n - 1 ? 1 : x === 0 ? -1 : 0, 0, 0],
          [0, y === n - 1 ? 1 : y === 0 ? -1 : 0, 0],
          [0, 0, z === n - 1 ? 1 : z === 0 ? -1 : 0],
        ];
        for (const d of dirs) {
          if (d[0] === 0 && d[1] === 0 && d[2] === 0) continue;
          stickers.push({
            n: d,
            c: faceColorForNormal(d),
            off: [d[0] * size * 0.5, d[1] * size * 0.5, d[2] * size * 0.5],
          });
        }
        const kind: PieceKind =
          stickers.length === 3 ? "corner" : stickers.length === 2 ? "edge" : "center";
        pieces.push({
          id: id++,
          kind,
          pos: [dc(x, n), dc(y, n), dc(z, n)],
          ori: M3.IDENTITY.slice() as Mat3,
          stickers,
          shape: "box",
          renderPos: [dc(x, n) * pitch * 0.5, dc(y, n) * pitch * 0.5, dc(z, n) * pitch * 0.5],
          renderSize: size,
        });
      }
  return pieces;
}

/** Move definitions for an NxN cube (face + wide turns, WCA notation). */
export function buildCubeMoves(n: number): MoveDef[] {
  const moves: MoveDef[] = [];
  const maxW = Math.floor(n / 2);
  for (const f of FACE_AT) {
    for (let w = 1; w <= maxW; w++) {
      const normal: Vec3 = V3.scale(f.axis, f.side);
      const axisIdx = f.axis[0] !== 0 ? 0 : f.axis[1] !== 0 ? 1 : 2;
      const bound = n - 2 * w + 1; // outermost threshold in doubled coords
      const id = w === 1 ? f.letter : w === 2 ? `${f.letter}w` : `${w}${f.letter}w`;
      moves.push({
        id,
        label: id,
        axis: normal,
        angle: -90,
        select: (ps) =>
          ps
            .filter((p) => (f.side === 1 ? p.pos[axisIdx] >= bound : p.pos[axisIdx] <= -bound))
            .map((p) => p.id),
        group: `axis${axisIdx}`,
      });
    }
  }
  return moves;
}

export function cubeScramble(moves: MoveDef[], n: number, length?: number): AppliedMove[] {
  const len = length ?? Math.max(9, Math.min(80, n * 10));
  // For the pocket cube, WCA-style scrambles use only R, U, F turns.
  const pool = n === 2 ? moves.filter((m) => /^[URF]$/.test(m.id)) : moves;
  const out: AppliedMove[] = [];
  let lastGroup = "";
  while (out.length < len) {
    const m = pool[Math.floor(Math.random() * pool.length)];
    if (m.group === lastGroup) continue;
    lastGroup = m.group;
    const r = Math.random();
    out.push({ moveId: m.id, dir: r < 0.35 ? -1 : 1, pow: r >= 0.7 ? 2 : 1 });
  }
  return out;
}

export function buildCubePuzzle(n: number): PuzzleDef {
  const pieces = buildCubePieces(n);
  const moves = buildCubeMoves(n);
  const solver: PuzzleDef["solver"] = n === 2 ? "pocket" : n === 3 ? "kociemba" : "reverse";
  const solverLabel =
    n === 2
      ? "Optimal IDA* solver"
      : n === 3
        ? "Kociemba two-phase engine"
        : "Smart rewind solver";
  return {
    id: `cube-${n}`,
    name: n === 2 ? "Pocket Cube (2×2)" : n === 3 ? "Rubik's Cube (3×3)" : `${n}×${n} Cube`,
    family: "cube",
    order: n,
    pieces,
    moves,
    faces: CUBE_FACES,
    scramble: (len) => cubeScramble(moves, n, len),
    radius: 2.05,
    worldScale: 3 / (2 * n),
    solver,
    solverLabel,
    status: "ready",
  };
}

// ---------------------------------------------------------------------------
// Skewb — deep 120° half-puzzle turns about body diagonals of a 3x3 lattice.
// Corners + center pieces carry stickers; dark fillers keep the silhouette.
// ---------------------------------------------------------------------------

const SKEWB_AXES: { id: string; axis: Vec3 }[] = [
  { id: "R", axis: [1, 1, 1] },
  { id: "L", axis: [-1, -1, 1] },
  { id: "U", axis: [-1, 1, -1] },
  { id: "B", axis: [1, -1, -1] },
];

export function buildSkewbPuzzle(): PuzzleDef {
  const n = 3;
  const pieces: Piece[] = [];
  const pitch = 0.92;
  const size = pitch * 0.97;
  let id = 0;
  for (let x = 0; x < 3; x++)
    for (let y = 0; y < 3; y++)
      for (let z = 0; z < 3; z++) {
        const extreme = [x, y, z].filter((c) => c !== 1).length;
        if (extreme !== 3 && extreme !== 1 && extreme !== 2) continue;
        const stickers: Piece["stickers"] = [];
        if (extreme !== 2) {
          const dirs: Vec3[] = [
            [x === 2 ? 1 : x === 0 ? -1 : 0, 0, 0],
            [0, y === 2 ? 1 : y === 0 ? -1 : 0, 0],
            [0, 0, z === 2 ? 1 : z === 0 ? -1 : 0],
          ];
          for (const d of dirs) {
            if (d[0] === 0 && d[1] === 0 && d[2] === 0) continue;
            stickers.push({
              n: d,
              c: faceColorForNormal(d),
              off: [d[0] * size * 0.5, d[1] * size * 0.5, d[2] * size * 0.5],
            });
          }
        }
        pieces.push({
          id: id++,
          kind: extreme === 3 ? "corner" : extreme === 1 ? "center" : "filler",
          pos: [dc(x, n), dc(y, n), dc(z, n)],
          ori: M3.IDENTITY.slice() as Mat3,
          stickers,
          shape: "box",
          renderPos: [dc(x, n) * pitch * 0.5, dc(y, n) * pitch * 0.5, dc(z, n) * pitch * 0.5],
          renderSize: size,
        });
      }

  const moves: MoveDef[] = SKEWB_AXES.map((a) => {
    // doubled-centered coords are in {-2,0,2}; axis components ±1
    return {
      id: a.id,
      label: a.id,
      axis: a.axis,
      angle: -120,
      select: (ps) => ps.filter((p) => V3.dot(p.pos, a.axis) > 0).map((p) => p.id),
      group: a.id,
    };
  });

  return {
    id: "skewb",
    name: "Skewb",
    family: "skewb",
    order: 3,
    pieces,
    moves,
    faces: CUBE_FACES,
    scramble: (len = 12) => {
      const out: AppliedMove[] = [];
      let last = "";
      while (out.length < len) {
        const m = moves[Math.floor(Math.random() * moves.length)];
        if (m.group === last) continue;
        last = m.group;
        out.push({ moveId: m.id, dir: Math.random() < 0.5 ? -1 : 1 });
      }
      return out;
    },
    radius: 1.7,
    worldScale: 0.46,
    solver: "reverse",
    solverLabel: "Smart rewind solver",
    status: "ready",
  };
}
