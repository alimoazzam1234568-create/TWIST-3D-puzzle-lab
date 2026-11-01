// ---------------------------------------------------------------------------
// 3x3 solver: extract the 54 facelets in Kociemba URFDLB order from the
// geometric piece model, run the cubejs two-phase solver, verify the result.
// ---------------------------------------------------------------------------
import Cube from "cubejs";
import { M3 } from "../engine/math";
import type { AppliedMove, Mat3, Vec3 } from "../engine/types";
import type { PieceSnap } from "./protocol";

interface FaceSpec {
  letter: string;
  n: Vec3;
  right: Vec3;
  up: Vec3;
}

// Standard Kociemba facelet layout:
// U (back row first), R, F, D (front row first), L, B — each viewed from outside.
const FACES: FaceSpec[] = [
  { letter: "U", n: [0, 1, 0], right: [1, 0, 0], up: [0, 0, -1] },
  { letter: "R", n: [1, 0, 0], right: [0, 0, -1], up: [0, 1, 0] },
  { letter: "F", n: [0, 0, 1], right: [1, 0, 0], up: [0, 1, 0] },
  { letter: "D", n: [0, -1, 0], right: [1, 0, 0], up: [0, 0, 1] },
  { letter: "L", n: [-1, 0, 0], right: [0, 0, 1], up: [0, 1, 0] },
  { letter: "B", n: [0, 0, -1], right: [-1, 0, 0], up: [0, 1, 0] },
];

const COLOR_LETTERS = "URFDLB";

export function extractFacelets(pieces: PieceSnap[]): string {
  // doubled-centered 3x3 lattice: coords in {-2, 0, 2}
  const byPos = new Map<string, PieceSnap>();
  for (const p of pieces) byPos.set(p.pos.join(","), p);
  let out = "";
  for (const f of FACES) {
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const pos: Vec3 = [
          f.n[0] * 2 + f.right[0] * (col - 1) * 2 + f.up[0] * (1 - row) * 2,
          f.n[1] * 2 + f.right[1] * (col - 1) * 2 + f.up[1] * (1 - row) * 2,
          f.n[2] * 2 + f.right[2] * (col - 1) * 2 + f.up[2] * (1 - row) * 2,
        ];
        const piece = byPos.get(pos.join(","));
        if (!piece) throw new Error(`Missing cubie at ${pos}`);
        let found: number | null = null;
        for (const s of piece.stickers) {
          const w = M3.mulVec(piece.ori as Mat3, s.n);
          if (w[0] === f.n[0] && w[1] === f.n[1] && w[2] === f.n[2]) {
            found = s.c;
            break;
          }
        }
        if (found === null) throw new Error(`No sticker facing ${f.letter} at ${pos}`);
        out += COLOR_LETTERS[found];
      }
    }
  }
  return out;
}

export function solveKociemba(pieces: PieceSnap[]): { moves: AppliedMove[]; length: number } {
  const facelets = extractFacelets(pieces);
  // color sanity: 9 of each
  const counts: Record<string, number> = {};
  for (const ch of facelets) counts[ch] = (counts[ch] ?? 0) + 1;
  if (Object.values(counts).length !== 6 || Object.values(counts).some((c) => c !== 9))
    throw new Error("Invalid 3×3 state: color counts are not 9 each");

  const cube = Cube.fromString(facelets);
  let solution = "";
  try {
    solution = cube.solve();
  } catch {
    throw new Error("Invalid or unsupported 3×3 state (not legally reachable)");
  }
  // verify
  const check = Cube.fromString(facelets);
  check.move(solution);
  if (!check.isSolved()) throw new Error("Solver verification failed on this state");

  const moves: AppliedMove[] = [];
  for (const tok of solution.split(/\s+/).filter(Boolean)) {
    const face = tok[0];
    if (!"UDLRFB".includes(face)) continue;
    if (tok.includes("2")) moves.push({ moveId: face, dir: 1, pow: 2 });
    else if (tok.includes("'")) moves.push({ moveId: face, dir: -1, pow: 1 });
    else moves.push({ moveId: face, dir: 1, pow: 1 });
  }
  return { moves, length: moves.length };
}
