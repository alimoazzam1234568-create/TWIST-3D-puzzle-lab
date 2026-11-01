# Twist — 3D Rubik's Cube & Twisty Puzzle Lab

A premium, fully interactive 3D twisty-puzzle simulator and solver workbench built with
React, TypeScript, Three.js (React Three Fiber), Tailwind CSS and Framer Motion.

## Run it

```bash
npm install
npm run dev        # development server
npm run build      # production build (dist/)
npm run preview    # serve the production build
```

### Headless engine tests

```bash
npx esbuild scripts/test.ts --bundle --format=cjs --platform=node \
  --external:cubejs --outfile=node_modules/.cache/test.cjs
node node_modules/.cache/test.cjs
```

Covers: scramble integrity for every puzzle family, solved-state detection, Kociemba
solves verified against the live engine, optimal 2×2 and Pyraminx solutions, the rewind
solver, and undo/redo bookkeeping.

## Playable puzzles

| Puzzle | Mechanics | Automatic solver |
| --- | --- | --- |
| 2×2 Pocket Cube | full piece simulation | **Optimal IDA\*** with pattern databases |
| 3×3 Rubik's Cube | full piece simulation | **Kociemba two-phase** (~20 moves) |
| 4×4 – 10×10 | full piece simulation, wide moves | Correct-by-construction **rewind solver** |
| Pyraminx | tetrahedral lattice, tips/axials/edges | **Optimal BFS** over all 933,120 states |
| Skewb | deep 120° half-turns about body diagonals | **Rewind solver** |

The library lists further puzzles (Megaminx, Square-1, Mirror/Fisher/Ghost/Axis/Windmill
cubes, Gear family, Helicopter family, …). These are honestly marked **coming soon** rather
than faked — the engine architecture (below) is built to accept them.

## How it works

### Exact piece-level simulation (`src/lib/engine`)

- Every puzzle is a set of **pieces** with exact integer lattice positions and integer
  3×3 orientation matrices (90° turns about coordinate axes and 120° turns about body
  diagonals are *exact* signed-permutation matrices — float arithmetic never corrupts state).
- **Moves are layers resolved live**: `MoveDef.select(pieces)` evaluates which pieces are in
  a layer from *current* positions at the moment a turn starts, so arbitrary sequences always
  mutate the correct pieces.
- Solved-state detection checks every sticker's world normal against the canonical face colors.
- Web levels and row counts are derived geometrically (the Pyraminx face tessellation is
  generated from barycentric grids and assigned to real pieces).

### Rendering (`src/components/three`)

- React Three Fiber scene: physically-based lighting, soft shadows, contact shadow stage,
  drag-orbit camera with damping, zoom limits, camera presets, fullscreen.
- **Drag-to-turn**: raycast a sticker, project pointer drag onto the face plane, score the
  possible rotation axes by tangential velocity, turn the best-matching layer.
- Animation runs through a queued engine pump (`engine.tick`) with cubic easing; moves are
  never lost or overlapped; undo/redo share the same pipeline.
- Only surface pieces are instantiated, so a 10×10 renders ~488 meshes instead of 1000.

### Solvers (`src/lib/solvers`, run inside a Web Worker)

- **3×3** — extracts the 54 facelets in Kociemba URFDLB order from the live geometry and runs
  Herbert Kociemba's two-phase algorithm (`cubejs`); the returned solution is verified before
  being animated.
- **2×2** — corner permutation/orientation coordinates, two BFS pattern databases, IDA*;
  always optimal.
- **Pyraminx** — geometry-derived transition tables + full BFS from solved (God's algorithm);
  tips fixed afterwards.
- **Rewind** — for big cubes and Skewb, the exact inverse of the scramble+move trail is
  replayed. It is always correct and never pretends to be minimal; the UI labels it as such.
- Invalid/unreachable states surface as readable errors instead of wrong moves.

### State, stats, settings

- Zustand + localStorage persistence: per-puzzle records, solve history, challenge progress,
  theme (dark/light), sounds, animation speeds, render quality, and a fully customizable
  6-color sticker palette.

## Roadmap

- **Puzzle Scanner**: photograph a physical cube, detect the six faces' colors, rebuild the
  state in 3D with a confirmation step, then solve it with the same engine.
- Reduction solver (centers → edge pairing → 3×3 stage) with parity handling for 4×4+.
- Additional puzzle families noted above, plus state import/export.
