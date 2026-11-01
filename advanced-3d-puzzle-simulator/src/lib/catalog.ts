import { buildCubePuzzle, buildSkewbPuzzle } from "./engine/cube";
import { buildPyraminxPuzzle } from "./engine/pyraminx";
import type { PuzzleDef } from "./engine/types";

export interface CatalogEntry {
  id: string;
  name: string;
  category: "Standard Cubes" | "Shape Mods" | "Twisty Specials";
  short: string;
  desc: string;
  status: "ready" | "soon";
  solverLabel?: string;
  build?: () => PuzzleDef;
}

export const CATALOG: CatalogEntry[] = [
  { id: "cube-2", name: "Pocket Cube", short: "2×2", category: "Standard Cubes", status: "ready", solverLabel: "Optimal IDA*", desc: "The 2×2×2 mini cube. Corners only — deceptively tricky.", build: () => buildCubePuzzle(2) },
  { id: "cube-3", name: "Rubik's Cube", short: "3×3", category: "Standard Cubes", status: "ready", solverLabel: "Kociemba two-phase", desc: "The classic 1974 puzzle. ~43 quintillion states.", build: () => buildCubePuzzle(3) },
  { id: "cube-4", name: "Rubik's Revenge", short: "4×4", category: "Standard Cubes", status: "ready", solverLabel: "Rewind solver", desc: "Even order introduces parity situations and no fixed centers.", build: () => buildCubePuzzle(4) },
  { id: "cube-5", name: "Professor's Cube", short: "5×5", category: "Standard Cubes", status: "ready", solverLabel: "Rewind solver", desc: "Five layers of reduction-solving goodness.", build: () => buildCubePuzzle(5) },
  { id: "cube-6", name: "V-Cube 6", short: "6×6", category: "Standard Cubes", status: "ready", solverLabel: "Rewind solver", desc: "Big-cube territory — wide moves and careful center building.", build: () => buildCubePuzzle(6) },
  { id: "cube-7", name: "V-Cube 7", short: "7×7", category: "Standard Cubes", status: "ready", solverLabel: "Rewind solver", desc: "Seven layers, satisfyingly heavy OS-tans of the cube world.", build: () => buildCubePuzzle(7) },
  { id: "cube-8", name: "8×8 Cube", short: "8×8", category: "Standard Cubes", status: "ready", solverLabel: "Rewind solver", desc: "Serious marathon-level twisty puzzle.", build: () => buildCubePuzzle(8) },
  { id: "cube-9", name: "9×9 Cube", short: "9×9", category: "Standard Cubes", status: "ready", solverLabel: "Rewind solver", desc: "A dense field of 486 visible cubies.", build: () => buildCubePuzzle(9) },
  { id: "cube-10", name: "10×10 Cube", short: "10×10", category: "Standard Cubes", status: "ready", solverLabel: "Rewind solver", desc: "Endgame hardware test — 488 cubies rendered live.", build: () => buildCubePuzzle(10) },
  { id: "pyraminx", name: "Pyraminx", short: "△", category: "Shape Mods", status: "ready", solverLabel: "Optimal BFS (God's algorithm)", desc: "Tetrahedral classic. 120° vertex turns, tips and edges.", build: buildPyraminxPuzzle },
  { id: "skewb", name: "Skewb", short: "◇", category: "Shape Mods", status: "ready", solverLabel: "Rewind solver", desc: "Deep corner turns that rotate half the puzzle at once.", build: buildSkewbPuzzle },
  { id: "master-pyraminx", name: "Master Pyraminx", short: "△+", category: "Shape Mods", status: "soon", desc: "Four-layer tetrahedron with wing edges." },
  { id: "megaminx", name: "Megaminx", short: "⬠", category: "Twisty Specials", status: "soon", desc: "12-faced dodecahedron with 5-edge faces." },
  { id: "gigaminx", name: "Gigaminx", short: "⬠+", category: "Twisty Specials", status: "soon", desc: "Five-layer dodecahedron marathon." },
  { id: "square-1", name: "Square-1", short: "◫", category: "Shape Mods", status: "soon", desc: "Banded shape-shifter with 30° slice geometry." },
  { id: "mirror-cube", name: "Mirror Cube", short: "▦", category: "Shape Mods", status: "soon", desc: "Single-color 3×3 solved by piece size." },
  { id: "fisher-cube", name: "Fisher Cube", short: "◱", category: "Shape Mods", status: "soon", desc: "3×3 axes rotated so centers become corners." },
  { id: "windmill-cube", name: "Windmill Cube", short: "✣", category: "Shape Mods", status: "soon", desc: "3×3 with twisted face cuts, pinwheel patterns." },
  { id: "ghost-cube", name: "Ghost Cube", short: "▨", category: "Shape Mods", status: "soon", desc: "Misaligned layers that must be ghosted into shape." },
  { id: "axis-cube", name: "Axis Cube", short: "◭", category: "Shape Mods", status: "soon", desc: "3×3 rotated around a corner axis." },
  { id: "ivy-cube", name: "Ivy Cube", short: "❖", category: "Shape Mods", status: "soon", desc: "The gentle leaf-cut corner puzzle." },
  { id: "gear-cube", name: "Gear Cube", short: "⚙", category: "Twisty Specials", status: "soon", desc: "Interlocking gears couple every turn." },
  { id: "gear-ball", name: "Gear Ball", short: "◎", category: "Twisty Specials", status: "soon", desc: "Spherical geared mechanism." },
  { id: "redi-cube", name: "Redi Cube", short: "◈", category: "Twisty Specials", status: "soon", desc: "Corner-turning cube with leaf-like cuts." },
  { id: "dino-cube", name: "Dino Cube", short: "◆", category: "Twisty Specials", status: "soon", desc: "Corner-turning cube with rotating edges." },
  { id: "helicopter-cube", name: "Helicopter Cube", short: "✜", category: "Twisty Specials", status: "soon", desc: "Edge-turning 2×2-relative with jumbling." },
  { id: "curvy-copter", name: "Curvy Copter", short: "❋", category: "Twisty Specials", status: "soon", desc: "Helicopter family with curvy cuts and jumbling." },
  { id: "rex-cube", name: "Rex Cube", short: "✦", category: "Twisty Specials", status: "soon", desc: "Face and corner turning hybrid." },
];

const defCache = new Map<string, PuzzleDef>();

export function getPuzzleDef(id: string): PuzzleDef | null {
  const cached = defCache.get(id);
  if (cached) return cached;
  const entry = CATALOG.find((e) => e.id === id);
  if (!entry || !entry.build) return null;
  const def = entry.build();
  defCache.set(id, def);
  return def;
}

export function catalogEntry(id: string): CatalogEntry | undefined {
  return CATALOG.find((e) => e.id === id);
}
