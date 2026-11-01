// ---------------------------------------------------------------------------
// Core puzzle engine types — shared by geometry builders, renderer & solvers.
// All spatial math uses exact integer vectors/matrices so puzzle state never
// drifts under rotations (90° and 120° turns are exact integer matrices).
// ---------------------------------------------------------------------------

/** exact integer vector */
export type Vec3 = [number, number, number];
/** float vector / generic tuple */
export type FVec = [number, number, number];
/** Row-major 3x3 matrix (integers) */
export type Mat3 = number[];

export interface Sticker {
  /** exact integer outward normal of this sticker in LOCAL piece space */
  n: Vec3;
  /** palette color index this sticker had in the solved state */
  c: number;
  /** float local-space offset of the sticker plane center from piece origin */
  off: FVec;
  /** optional in-plane "up" direction (float, local space) for triangles */
  triUp?: FVec;
}

export type PieceKind = "corner" | "edge" | "center" | "tip" | "axial" | "filler";
export type PieceShape = "box" | "tetra" | "diamond";

export interface Piece {
  id: number;
  kind: PieceKind;
  /** exact lattice position */
  pos: Vec3;
  /** exact orientation: local -> world basis matrix */
  ori: Mat3;
  stickers: Sticker[];
  shape: PieceShape;
  /** float render position in world units */
  renderPos: FVec;
  /** base render size of the piece mesh */
  renderSize: number;
}

export type Family = "cube" | "pyraminx" | "skewb";

export interface MoveDef {
  /** unique id e.g. "U", "R", "3Uw", "u" */
  id: string;
  label: string;
  /** exact rotation axis (integer direction, unit-ish) */
  axis: Vec3;
  /** exact rotation angle in degrees for dir=+1 (clockwise seen from outside) */
  angle: number;
  /**
   * Resolve the CURRENT piece ids belonging to this layer. Layer membership
   * must be evaluated live — pieces move between layers after every turn.
   */
  select: (pieces: Piece[]) => number[];
  /** scramble grouping: never pick twice in a row from same group */
  group: string;
}

/** An applied move. pow=2 is a double turn. dir=-1 is inverse. */
export interface AppliedMove {
  moveId: string;
  dir: 1 | -1;
  pow?: 1 | 2;
}

export interface FaceDef {
  n: Vec3;
  color: number;
  name: string;
}

export interface PuzzleDef {
  id: string;
  name: string;
  family: Family;
  order: number;
  pieces: Piece[];
  moves: MoveDef[];
  faces: FaceDef[];
  scramble(length?: number): AppliedMove[];
  radius: number;
  /** lattice unit -> world render unit */
  worldScale: number;
  solver: "kociemba" | "pocket" | "pyra" | "reverse" | "none";
  solverLabel: string;
  status: "ready" | "soon";
}

/** Default palette (indices: 0 U white, 1 R red, 2 F green, 3 D yellow, 4 L orange, 5 B blue) */
export const DEFAULT_PALETTE = [
  "#f8fafc",
  "#e11d48",
  "#22c55e",
  "#facc15",
  "#f97316",
  "#3b82f6",
];

export const FACE_NAMES = ["U", "R", "F", "D", "L", "B"];

/**
 * Canonical cube face layout: F=+z green, B=-z blue, U=+y white,
 * D=-y yellow, R=+x red, L=-x orange.
 */
export const CUBE_FACES: FaceDef[] = [
  { n: [0, 1, 0], color: 0, name: "U" },
  { n: [1, 0, 0], color: 1, name: "R" },
  { n: [0, 0, 1], color: 2, name: "F" },
  { n: [0, -1, 0], color: 3, name: "D" },
  { n: [-1, 0, 0], color: 4, name: "L" },
  { n: [0, 0, -1], color: 5, name: "B" },
];

export function colorLetter(c: number): string {
  return "URFDLB"[c] ?? "?";
}
