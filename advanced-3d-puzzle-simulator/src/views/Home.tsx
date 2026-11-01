import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Float } from "@react-three/drei";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three-stdlib";
import {
  ArrowRight,
  Bot,
  Boxes,
  Camera,
  Dices,
  Layers,
  Play,
  ScanSearch,
  Sparkles,
  Timer,
  Trophy,
  Wand2,
} from "lucide-react";
import { Badge, Btn, Panel, Stat } from "../components/ui";
import { CATALOG } from "../lib/catalog";
import { DEFAULT_PALETTE } from "../lib/engine/types";
import { fmtTime, useApp } from "../store";

// ---------------------------------------------------------------------------
function DecorCube() {
  const g = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  useFrame(({ clock }, dt) => {
    if (g.current) {
      g.current.rotation.y += dt * 0.4;
      g.current.rotation.x = Math.sin(clock.elapsedTime * 0.35) * 0.25 + 0.35;
    }
    if (inner.current) inner.current.rotation.y -= dt * 0.12;
  });
  const box = new RoundedBoxGeometry(0.92, 0.92, 0.92, 3, 0.09);
  const sq = new THREE.PlaneGeometry(0.72, 0.72);
  const body = new THREE.MeshStandardMaterial({ color: "#10141f", roughness: 0.35, metalness: 0.15 });
  const mats = DEFAULT_PALETTE.map(
    (c) =>
      new THREE.MeshStandardMaterial({
        color: c,
        roughness: 0.2,
        emissive: c,
        emissiveIntensity: 0.18,
      }),
  );
  const dirs = [
    [0, 1, 0],
    [1, 0, 0],
    [0, 0, 1],
    [0, -1, 0],
    [-1, 0, 0],
    [0, 0, -1],
  ];
  const cubes: React.ReactNode[] = [];
  let k = 0;
  for (let x = -1; x <= 1; x++)
    for (let y = -1; y <= 1; y++)
      for (let z = -1; z <= 1; z++) {
        if (x === 0 && y === 0 && z === 0) continue;
        const stickers: React.ReactNode[] = [];
        dirs.forEach((d, di) => {
          if ((d[0] !== 0 && d[0] !== x) || (d[1] !== 0 && d[1] !== y) || (d[2] !== 0 && d[2] !== z))
            return;
          const q = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 0, 1),
            new THREE.Vector3(d[0], d[1], d[2]),
          );
          // scatter a few colors for style
          const colorIdx = (di + (x + y + z + 3)) % 6;
          stickers.push(
            <mesh
              key={di}
              geometry={sq}
              material={mats[colorIdx]}
              position={[d[0] * 0.47, d[1] * 0.47, d[2] * 0.47]}
              quaternion={q}
            />,
          );
        });
        cubes.push(
          <mesh key={k++} geometry={box} material={body} position={[x, y, z]}>
            {stickers}
          </mesh>,
        );
      }
  return (
    <Float speed={1.6} rotationIntensity={0.15} floatIntensity={0.9}>
      <group ref={g}>
        <group ref={inner} scale={0.62}>
          {cubes}
        </group>
      </group>
    </Float>
  );
}

// ---------------------------------------------------------------------------
export function Home() {
  const setView = useApp((s) => s.setView);
  const setPuzzle = useApp((s) => s.setPuzzle);
  const history = useApp((s) => s.history);
  const stats = useApp((s) => s.stats);
  const totalSolves = history.length;
  const totalMoves = Object.values(stats).reduce((a, b) => a + b.totalMoves, 0);
  const bestOverall = Object.values(stats).reduce<number | null>(
    (a, b) => (b.best === null ? a : a === null ? b.best : Math.min(a, b.best)),
    null,
  );
  const readyCount = CATALOG.filter((c) => c.status === "ready").length;

  const features = [
    { icon: <Boxes className="h-5 w-5" />, t: "12 playable puzzles", d: "Cubes from 2×2 to 10×10 plus Pyraminx and Skewb — each with true mechanics, not reskins." },
    { icon: <Bot className="h-5 w-5" />, t: "Real solver engines", d: "Kociemba two-phase for 3×3, optimal IDA* for 2×2, God's-number BFS for Pyraminx." },
    { icon: <Layers className="h-5 w-5" />, t: "Exact state engine", d: "Integer-lattice piece tracking keeps every permutation, twist and flip perfectly in sync." },
    { icon: <Timer className="h-5 w-5" />, t: "Speedcubing tools", d: "WCA-style scrambles, precision timer, move history, undo/redo, personal records." },
    { icon: <Trophy className="h-5 w-5" />, t: "Modes & challenges", d: "Free play, timed runs, practice, challenge ladder and random-puzzle roulette." },
    { icon: <ScanSearch className="h-5 w-5" />, t: "Puzzle Scanner — soon", d: "Photograph your physical cube, confirm the detected colors, and get a solution." },
  ];

  return (
    <div className="h-full overflow-y-auto">
      {/* hero */}
      <div className="mx-auto grid max-w-7xl gap-8 px-6 pb-10 pt-12 lg:grid-cols-[1.15fr_1fr] lg:pt-16">
        <div className="flex flex-col justify-center">
          <Badge tone="violet" className="w-fit">
            <Sparkles className="h-3 w-3" /> 3D twisty puzzle laboratory
          </Badge>
          <h1 className="mt-4 text-5xl font-bold leading-[1.02] tracking-tight lg:text-6xl">
            Every twist.
            <br />
            <span className="bg-gradient-to-r from-sky-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              Perfectly simulated.
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-dim">
            A premium 3D playground for mechanical puzzles: scramble a 10×10, watch a Kociemba
            engine dismantle a 3×3 move-by-move, learn the Pyraminx with an optimal solver, and
            chase personal records — all in real time with true physical mechanics.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Btn
              variant="primary"
              glow
              className="px-5 py-2.5 text-sm"
              onClick={() => setView("play")}
            >
              <Play className="h-4 w-4" /> Start solving
              <ArrowRight className="h-4 w-4" />
            </Btn>
            <Btn className="px-5 py-2.5 text-sm" onClick={() => setView("solver")}>
              <Bot className="h-4 w-4" /> Watch the auto-solver
            </Btn>
            <Btn
              variant="ghost"
              className="px-5 py-2.5 text-sm"
              onClick={() => {
                const ready = CATALOG.filter((c) => c.status === "ready");
                const pick = ready[Math.floor(Math.random() * ready.length)];
                setPuzzle(pick.id);
                setView("play");
              }}
            >
              <Dices className="h-4 w-4" /> Random puzzle
            </Btn>
          </div>
          <div className="mt-9 grid max-w-lg grid-cols-3 gap-3">
            <Stat label="Puzzles live" value={readyCount} sub="9 more planned" accent />
            <Stat label="Your solves" value={totalSolves} sub="all time" />
            <Stat label="Best time" value={fmtTime(bestOverall)} sub={totalMoves ? `${totalMoves} moves` : "no solves yet"} />
          </div>
        </div>
        <Panel className="relative h-[380px] overflow-hidden lg:h-[460px]">
          <div className="dot-grid absolute inset-0 opacity-60" />
          <Canvas camera={{ position: [0, 0.6, 4.6], fov: 36 }} dpr={[1, 2]} gl={{ alpha: true, antialias: true }}>
            <Suspense fallback={null}>
              <ambientLight intensity={0.5} />
              <directionalLight position={[4, 6, 5]} intensity={1.6} />
              <pointLight position={[-4, -3, 4]} intensity={10} color="#38bdf8" distance={12} />
              <pointLight position={[4, 3, -4]} intensity={8} color="#8b5cf6" distance={12} />
              <DecorCube />
              <ContactShadows position={[0, -2, 0]} opacity={0.5} scale={9} blur={2.5} far={4} />
            </Suspense>
          </Canvas>
          <div className="absolute bottom-3 left-3 rounded-lg glass px-2.5 py-1.5 text-[11px] text-dim">
            Live renderer · runs the same engine as the game
          </div>
        </Panel>
      </div>

      {/* marquee */}
      <div className="relative overflow-hidden border-y border-[var(--line)] bg-white/[0.015] py-3">
        <div className="animate-marquee flex w-max gap-8 whitespace-nowrap">
          {[...CATALOG, ...CATALOG, ...CATALOG].map((c, i) => (
            <span key={i} className="flex items-center gap-2 text-[12px] uppercase tracking-[0.2em] text-dim">
              <span className="text-sky-400/70">{c.short}</span> {c.name}
            </span>
          ))}
        </div>
      </div>

      {/* features */}
      <div className="mx-auto grid max-w-7xl gap-4 px-6 py-12 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <Panel key={f.t} className="group p-5 transition-all hover:border-sky-400/30 hover:shadow-[0_0_30px_rgba(56,189,248,0.12)]">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/20 to-violet-500/20 text-sky-300 ring-1 ring-sky-400/30">
              {f.icon}
            </div>
            <div className="mt-3.5 text-[15px] font-semibold">{f.t}</div>
            <div className="mt-1 text-[13px] leading-relaxed text-dim">{f.d}</div>
          </Panel>
        ))}
      </div>

      {/* scanner teaser */}
      <div className="mx-auto max-w-7xl px-6 pb-16">
        <Panel className="relative overflow-hidden p-7 lg:p-10">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-violet-500/15 blur-3xl" />
          <div className="absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-sky-500/15 blur-3xl" />
          <div className="relative flex flex-col items-start gap-6 lg:flex-row lg:items-center">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-violet-600 shadow-[0_0_40px_rgba(99,102,241,0.5)]">
              <Camera className="h-7 w-7 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-2xl font-bold tracking-tight">Puzzle Scanner</h3>
                <Badge tone="warn">Coming in a future update</Badge>
              </div>
              <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-dim">
                Point your camera at a <span className="text-[var(--text)]">real, physical cube</span>:
                the scanner detects all six faces' colors, rebuilds the exact position in 3D, lets
                you confirm each sticker — then hands the state to the solving engine. Virtual and
                physical cubing, one toolbox.
              </p>
            </div>
            <Btn variant="ghost" className="shrink-0" onClick={() => setView("solver")}>
              <Wand2 className="h-4 w-4" /> Try the solver meanwhile
            </Btn>
          </div>
        </Panel>
      </div>
    </div>
  );
}
