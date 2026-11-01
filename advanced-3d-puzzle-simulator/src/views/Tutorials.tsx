import { BookOpen, GraduationCap, Move3d, RotateCw, Type } from "lucide-react";
import { Kbd, Panel, PanelHeader, Btn } from "../components/ui";
import { useApp } from "../store";

const NOTATION = [
  { m: "U", d: "Up face clockwise" },
  { m: "U'", d: "Up face counter-clockwise" },
  { m: "U2", d: "Up face 180°" },
  { m: "R", d: "Right face clockwise" },
  { m: "F", d: "Front face clockwise" },
  { m: "Rw", d: "Two right layers together (big cubes)" },
  { m: "3Rw", d: "Three right layers (6×6 and up)" },
  { m: "u", d: "Lowercase = tip turns on Pyraminx" },
];

const GUIDES = [
  {
    title: "Your first 3×3 solve (beginner method)",
    puzzle: "cube-3",
    steps: [
      "Build a cross on the bottom face, aligning edge side colors with centers.",
      "Insert the four bottom-layer corners — each corner matches three face colors.",
      "Solve the middle layer edges with the triggers R U R' U' and its mirror L' U' L U.",
      "Make the top cross: F R U R' U' F' from a dot, L-shape, or line.",
      "Orient corners with the Sune: R U R' U R U2 R'.",
      "Permute corners, then finish edges with the standard 3-cycle.",
    ],
  },
  {
    title: "Pyraminx in three phases",
    puzzle: "pyraminx",
    steps: [
      "Match all four tips to their vertex centers — one twist each at most.",
      "Align the four axial pieces so each vertex shows one color.",
      "Solve the six edges with 2-move commutators like R U R' — our solver is optimal, compare your move count!",
    ],
  },
  {
    title: "Big-cube reduction (4×4 and up)",
    puzzle: "cube-4",
    steps: [
      "Build the six 2×2 centers using wide moves (Rw, Uw...).",
      "Pair all 12 edge groups; hold pairs on the front-right as you work.",
      "Solve it like a 3×3 — then repair OLL/PLL parity if a single edge or pair looks impossible.",
      "On 5×5 and larger, work centers row by row and use slice moves efficiently.",
    ],
  },
  {
    title: "Skewb — Sarah's method",
    puzzle: "skewb",
    steps: [
      "Skewb turns rotate an entire half of the puzzle around a corner axis.",
      "Solve one face's four corners around its center.",
      "Cycle remaining centers with the sledgehammer: R' L R L'.",
      "Orient the last corners with the same trigger from the right angle.",
    ],
  },
];

export function Tutorials() {
  const setView = useApp((s) => s.setView);
  const setPuzzle = useApp((s) => s.setPuzzle);
  const setMode = useApp((s) => s.setMode);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Tutorials & Notation</h1>
        <p className="mt-1 text-[13.5px] text-dim">
          Learn the language of twisty puzzles, then practice on the real thing.
        </p>

        <div className="mt-6 grid gap-4 lg:grid-cols-[340px_1fr]">
          <Panel>
            <PanelHeader title="Notation reference" icon={<Type className="h-3.5 w-3.5" />} />
            <div className="divide-y divide-[var(--line)]">
              {NOTATION.map((n) => (
                <div key={n.m} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-10 rounded-md bg-sky-400/10 px-2 py-1 text-center font-mono text-[12px] font-bold text-sky-300">
                    {n.m}
                  </span>
                  <span className="text-[12.5px] text-dim">{n.d}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-[var(--line)] px-4 py-3 text-[11.5px] leading-relaxed text-dim">
              <div className="mb-1 font-semibold uppercase tracking-wider text-[10px] text-[var(--text)]/70">
                Controls
              </div>
              <div className="space-y-1.5">
                <div><Move3d className="mr-1 inline h-3 w-3" /> Drag a sticker to turn its layer; drag the background to orbit; scroll to zoom.</div>
                <div>Keys <Kbd>U</Kbd><Kbd>D</Kbd><Kbd>L</Kbd><Kbd>R</Kbd><Kbd>F</Kbd><Kbd>B</Kbd> turn faces, <Kbd>Shift</Kbd> inverts, <Kbd>Alt</Kbd> makes wide turns (or tip turns on Pyraminx).</div>
                <div><RotateCw className="mr-1 inline h-3 w-3" /> Right-click any move-pad button for its inverse.</div>
              </div>
            </div>
          </Panel>

          <div className="grid gap-4">
            {GUIDES.map((g) => (
              <Panel key={g.title} className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500/20 to-violet-500/20 text-sky-300 ring-1 ring-sky-400/30">
                      <GraduationCap className="h-4.5 w-4.5" />
                    </span>
                    <h3 className="font-semibold">{g.title}</h3>
                  </div>
                  <Btn
                    variant="ghost"
                    className="px-3 py-1.5 text-[12px]"
                    onClick={() => {
                      setPuzzle(g.puzzle);
                      setMode("practice");
                      setView("play");
                    }}
                  >
                    <BookOpen className="h-3.5 w-3.5" /> Practice this
                  </Btn>
                </div>
                <ol className="mt-3 space-y-1.5">
                  {g.steps.map((s, i) => (
                    <li key={i} className="flex gap-2.5 text-[13px] text-dim">
                      <span className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-sky-400/10 font-mono text-[10px] font-bold text-sky-300">
                        {i + 1}
                      </span>
                      {s}
                    </li>
                  ))}
                </ol>
              </Panel>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
