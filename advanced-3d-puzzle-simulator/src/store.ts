import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_PALETTE } from "./lib/engine/types";

export type View =
  | "home"
  | "library"
  | "play"
  | "solver"
  | "tutorials"
  | "stats"
  | "settings";

export type GameMode = "free" | "timed" | "auto" | "practice" | "challenge";

export interface PuzzleStats {
  best: number | null;
  last: number[]; // ms, newest first, keep 12
  solves: number;
  totalMoves: number;
  scrambles: number;
}

interface Settings {
  theme: "dark" | "light";
  sound: boolean;
  animSpeed: number; // seconds per quarter turn 0.08..0.6
  solveSpeed: number;
  quality: "high" | "balanced";
  cameraAutoRotate: boolean;
  palette: string[];
}

interface SolveRecord {
  puzzleId: string;
  puzzleName: string;
  timeMs: number;
  moves: number;
  date: number;
  scramble: string;
}

interface AppState {
  view: View;
  mode: GameMode;
  currentPuzzleId: string;
  settings: Settings;
  stats: Record<string, PuzzleStats>;
  history: SolveRecord[];
  challengeStage: number;
  setView: (v: View) => void;
  setMode: (m: GameMode) => void;
  setPuzzle: (id: string) => void;
  patchSettings: (p: Partial<Settings>) => void;
  recordSolve: (rec: SolveRecord) => void;
  recordScramble: (puzzleId: string) => void;
  bumpChallenge: () => void;
  resetStats: () => void;
}

export const CHALLENGE_STAGES = [
  { puzzleId: "cube-2", label: "Warm up on the Pocket Cube", target: "Solve the 2×2" },
  { puzzleId: "pyraminx", label: "Tame the tetrahedron", target: "Solve the Pyraminx" },
  { puzzleId: "skewb", label: "Master the diagonal", target: "Solve the Skewb" },
  { puzzleId: "cube-3", label: "The classic", target: "Solve the 3×3" },
  { puzzleId: "cube-4", label: "Parity gauntlet", target: "Solve the 4×4" },
  { puzzleId: "cube-5", label: "Professor's trial", target: "Solve the 5×5" },
];

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      view: "home",
      mode: "free",
      currentPuzzleId: "cube-3",
      settings: {
        theme: "dark",
        sound: true,
        animSpeed: 0.22,
        solveSpeed: 0.2,
        quality: "high",
        cameraAutoRotate: false,
        palette: [...DEFAULT_PALETTE],
      },
      stats: {},
      history: [],
      challengeStage: 0,
      setView: (v) => set({ view: v }),
      setMode: (m) => set({ mode: m }),
      setPuzzle: (id) => set({ currentPuzzleId: id }),
      patchSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
      recordScramble: (puzzleId) =>
        set((s) => {
          const st = s.stats[puzzleId] ?? {
            best: null,
            last: [],
            solves: 0,
            totalMoves: 0,
            scrambles: 0,
          };
          return { stats: { ...s.stats, [puzzleId]: { ...st, scrambles: st.scrambles + 1 } } };
        }),
      recordSolve: (rec) =>
        set((s) => {
          const st = s.stats[rec.puzzleId] ?? {
            best: null,
            last: [],
            solves: 0,
            totalMoves: 0,
            scrambles: 0,
          };
          const last = [rec.timeMs, ...st.last].slice(0, 12);
          const best = st.best === null ? rec.timeMs : Math.min(st.best, rec.timeMs);
          return {
            stats: {
              ...s.stats,
              [rec.puzzleId]: {
                best,
                last,
                solves: st.solves + 1,
                totalMoves: st.totalMoves + rec.moves,
                scrambles: st.scrambles,
              },
            },
            history: [rec, ...s.history].slice(0, 60),
          };
        }),
      bumpChallenge: () => set((s) => ({ challengeStage: s.challengeStage + 1 })),
      resetStats: () => set({ stats: {}, history: [], challengeStage: 0 }),
    }),
    {
      name: "twist-3d-store",
      version: 1,
    },
  ),
);

export function fmtTime(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  const s = ms / 1000;
  if (s < 60) return s.toFixed(2);
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(2).padStart(5, "0")}`;
}
