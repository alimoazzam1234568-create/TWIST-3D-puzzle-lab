import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  Bot,
  Camera,
  ChevronRight,
  CircleCheck,
  Dices,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play as PlayIcon,
  RotateCcw,
  Shuffle,
  Shuffle as ScrambleIcon,
  Square,
  StepForward,
  Timer as TimerIcon,
  Trophy,
  Undo2,
  Redo2,
  Keyboard,
  MousePointer2,
  AlertTriangle,
} from "lucide-react";
import { GameScene, cameraAPI, type CameraPreset } from "../components/three/Scene";
import { Badge, Btn, Chip, IconBtn, Panel, PanelHeader, Progress, Slider, TextInput, Kbd } from "../components/ui";
import { engine } from "../lib/engine/engine";
import { getPuzzleDef, CATALOG } from "../lib/catalog";
import { formatMove, formatMoves, parseMoves } from "../lib/notation";
import { solverClient, type SolveResult } from "../lib/solverClient";
import { cn } from "../utils/cn";
import { CHALLENGE_STAGES, fmtTime, useApp, type GameMode } from "../store";
import { sfx } from "../lib/sound";
import type { AppliedMove } from "../lib/engine/types";

// ---------------------------------------------------------------------------
type TimerPhase = "idle" | "armed" | "running" | "paused" | "stopped";

interface SolveState {
  status: "idle" | "thinking" | "running" | "paused" | "done" | "error";
  meta?: SolveResult;
  error?: string;
}

export function GameScreen({ layout }: { layout: "play" | "solver" }) {
  const version = useSyncExternalStore(engine.subscribe, engine.getVersion);
  const puzzleId = useApp((s) => s.currentPuzzleId);
  const mode = useApp((s) => s.mode);
  const setMode = useApp((s) => s.setMode);
  const settings = useApp((s) => s.settings);
  const patchSettings = useApp((s) => s.patchSettings);
  const recordSolve = useApp((s) => s.recordSolve);
  const recordScramble = useApp((s) => s.recordScramble);
  const challengeStage = useApp((s) => s.challengeStage);
  const bumpChallenge = useApp((s) => s.bumpChallenge);
  const setPuzzle = useApp((s) => s.setPuzzle);

  const def = useMemo(() => getPuzzleDef(puzzleId), [puzzleId]);
  const [scrambleText, setScrambleText] = useState("");
  const [customScr, setCustomScr] = useState("");
  const [customErr, setCustomErr] = useState("");
  const [prime, setPrime] = useState(false);
  const [solve, setSolve] = useState<SolveState>({ status: "idle" });
  const [solverReady, setSolverReady] = useState(solverClient.isReady);
  const [toast, setToast] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ---- timer ---------------------------------------------------------------
  const [phase, setPhase] = useState<TimerPhase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);

  useEffect(() => {
    if (phase !== "running") return;
    const iv = setInterval(() => setElapsed(performance.now() - startRef.current), 31);
    return () => clearInterval(iv);
  }, [phase]);

  const pauseTimer = () => {
    if (phase !== "running") return;
    setElapsed(performance.now() - startRef.current);
    setPhase("paused");
  };
  const resumeTimer = () => {
    if (phase !== "paused") return;
    startRef.current = performance.now() - elapsed;
    setPhase("running");
  };

  // ---- engine boot -----------------------------------------------------------
  useEffect(() => {
    if (def && engine.def !== def) {
      engine.load(def);
      engine.turnDuration = settings.animSpeed;
      engine.solveDuration = settings.solveSpeed;
      setScrambleText("");
      setSolve({ status: "idle" });
      setPhase("idle");
      setElapsed(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def]);
  useEffect(() => solverClient.onReady(setSolverReady), []);
  useEffect(() => {
    solverClient.init();
  }, []);
  useEffect(() => {
    engine.turnDuration = settings.animSpeed;
    engine.solveDuration = settings.solveSpeed;
  }, [settings.animSpeed, settings.solveSpeed]);

  // ---- solved-state & timer transitions --------------------------------------
  const solvedNow = engine.isSolved();
  useEffect(() => {
    if (phase === "armed" && engine.history.length > 0) {
      startRef.current = performance.now();
      setPhase("running");
    }
  }, [version, phase]);

  useEffect(() => {
    if (phase === "running" && solvedNow && !engine.autoSolving && engine.history.length > 0) {
      const t = performance.now() - startRef.current;
      setElapsed(t);
      setPhase("stopped");
      sfx.solved();
      recordSolve({
        puzzleId,
        puzzleName: def?.name ?? puzzleId,
        timeMs: Math.round(t),
        moves: engine.movesSinceScramble,
        date: Date.now(),
        scramble: scrambleText,
      });
      if (mode === "challenge" && CHALLENGE_STAGES[challengeStage]?.puzzleId === puzzleId) {
        bumpChallenge();
        flash(`Stage cleared! ${challengeStage + 1 < CHALLENGE_STAGES.length ? "Next puzzle unlocked" : "Challenge complete!"}`);
        const next = CHALLENGE_STAGES[challengeStage + 1];
        if (next) setTimeout(() => setPuzzle(next.puzzleId), 1600);
      } else {
        flash("Puzzle solved!");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solvedNow, phase]);

  // auto-solve completion watcher
  useEffect(() => {
    if ((solve.status === "running" || solve.status === "paused") && !engine.autoSolving && !engine.busy) {
      setSolve((s) => (s.meta ? { ...s, status: solvedNow ? "done" : "idle" } : s));
      if (solvedNow) sfx.solved();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, engine.autoSolving]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
  };

  // ---- actions ---------------------------------------------------------------
  const doScramble = useCallback(() => {
    if (!def) return;
    const s = engine.scrambleNow();
    setScrambleText(formatMoves(s));
    setSolve({ status: "idle" });
    setPhase("armed");
    setElapsed(0);
    recordScramble(puzzleId);
    sfx.scramble();
  }, [def, puzzleId, recordScramble]);

  const doReset = useCallback(() => {
    engine.reset();
    setSolve({ status: "idle" });
    setScrambleText("");
    setPhase("idle");
    setElapsed(0);
    sfx.click();
  }, []);

  const applyCustom = () => {
    if (!def) return;
    try {
      const moves = parseMoves(def, customScr);
      engine.reset();
      engine.lastScramble = moves;
      engine.applyMany(moves, { dur: 0.05, record: false });
      setScrambleText(formatMoves(moves));
      setCustomErr("");
      setPhase("armed");
      sfx.scramble();
    } catch (e) {
      setCustomErr(e instanceof Error ? e.message : String(e));
      sfx.error();
    }
  };

  const doMove = useCallback(
    (id: string, invert = false) => {
      if (engine.autoSolving) return;
      const dir = (invert ? -1 : 1) as 1 | -1;
      engine.apply({ moveId: id, dir });
      sfx.move();
    },
    [],
  );

  const doAutoSolve = useCallback(async () => {
    if (!def || !solverReady) return;
    if (solvedNow && engine.history.length === 0) {
      flash("Already solved — scramble first");
      return;
    }
    setSolve({ status: "thinking" });
    try {
      const snap = engine.pieces.map((p) => ({
        id: p.id,
        kind: p.kind,
        pos: [...p.pos] as [number, number, number],
        ori: [...p.ori],
        stickers: p.stickers.map((s) => ({ n: [...s.n] as [number, number, number], c: s.c })),
      }));
      const result = await solverClient.solve(
        def.solver === "none" ? "reverse" : def.solver,
        snap,
        engine.trail(),
      );
      if (result.moves.length === 0) {
        setSolve({ status: "done", meta: result });
        return;
      }
      setPhase("idle");
      setSolve({ status: "running", meta: result });
      engine.startSolve(result.moves);
    } catch (e) {
      setSolve({ status: "error", error: e instanceof Error ? e.message : String(e) });
      sfx.error();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def, solverReady, solvedNow]);

  // ---- keyboard controls --------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const k = e.key.toLowerCase();
      if (!def) return;
      const faces = def.family === "cube" ? "udlrfb" : "urlb";
      if (!faces.includes(k) || e.metaKey || e.ctrlKey) return;
      let id = k.toUpperCase();
      if (def.family === "pyraminx" && e.altKey) id = k; // tips
      else if (def.family === "cube" && e.altKey) id = `${id}w`;
      if (!engine.moveDef(id)) return;
      doMove(id, e.shiftKey);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [def, doMove]);

  // ---- derived display -----------------------------------------------------------
  const history = engine.history;
  const solveTotal = solve.meta?.moves.length ?? 0;
  const solveDone =
    solve.status === "done"
      ? solveTotal
      : solveTotal - engine.queue.length - (engine.anim && solve.status !== "idle" ? 1 : 0);
  const busy = engine.busy || solve.status === "thinking";
  const entry = CATALOG.find((c) => c.id === puzzleId);
  const best = useApp((s) => s.stats[puzzleId]?.best ?? null);

  const fsRef = useRef<HTMLDivElement>(null);
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      void fsRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      void document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const camBtn = (p: CameraPreset, label: string) => (
    <button
      key={p}
      onClick={() => cameraAPI.view(p)}
      className="rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-dim hover:bg-sky-400/15 hover:text-sky-300 transition-colors cursor-pointer"
    >
      {label}
    </button>
  );

  if (!def) return null;

  const movePadMoves = def.moves.filter((m) =>
    def.family === "pyraminx" ? /^[URLB]$/.test(m.id) : /^[UDRLFB]$/.test(m.id),
  );
  const wideMoves = def.moves.filter((m) => /^[UDRLFB]w$/.test(m.id));
  const extraWide = def.moves.filter((m) => /^\d/.test(m.id));
  const tipMoves = def.moves.filter((m) => /^[urlb]$/.test(m.id));

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3 lg:flex-row lg:p-4" ref={fsRef}>
      {/* LEFT: puzzle library */}
      <Panel className="hidden w-60 shrink-0 flex-col overflow-hidden lg:flex">
        <PanelHeader title="Puzzle Library" icon={<Dices className="h-3.5 w-3.5" />} />
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {["Standard Cubes", "Shape Mods", "Twisty Specials"].map((cat) => (
            <div key={cat} className="mb-3">
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-dim">
                {cat}
              </div>
              {CATALOG.filter((c) => c.category === cat).map((c) => (
                <button
                  key={c.id}
                  disabled={c.status !== "ready"}
                  onClick={() => setPuzzle(c.id)}
                  className={cn(
                    "group flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[12.5px] transition-all cursor-pointer",
                    c.id === puzzleId
                      ? "bg-sky-400/15 text-sky-200 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.35)]"
                      : c.status === "ready"
                        ? "text-[var(--text)]/85 hover:bg-white/[0.05]"
                        : "text-dim/50 cursor-not-allowed",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-dim w-7">{c.short}</span>
                    {c.name}
                  </span>
                  {c.status === "soon" ? (
                    <span className="text-[9px] uppercase tracking-wider text-dim/60">soon</span>
                  ) : (
                    c.id === puzzleId && <ChevronRight className="h-3 w-3 text-sky-300" />
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="border-t border-[var(--line)] p-2">
          <Btn
            variant="accent"
            className="w-full"
            onClick={() => {
              const ready = CATALOG.filter((c) => c.status === "ready");
              const pick = ready[Math.floor(Math.random() * ready.length)];
              setPuzzle(pick.id);
              setTimeout(doScramble, 60);
            }}
          >
            <Shuffle className="h-3.5 w-3.5" /> Random puzzle
          </Btn>
        </div>
      </Panel>

      {/* CENTER: 3D stage + move pad bar (canvas never covered) */}
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <Panel className="relative min-h-[380px] min-w-0 flex-1 overflow-hidden">
          <GameScene palette={settings.palette} className="absolute inset-0" />

        {/* top overlay */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3">
          <div className="pointer-events-auto">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight">{def.name}</h2>
              <Badge tone={def.solver === "reverse" ? "violet" : "success"}>{def.solverLabel}</Badge>
            </div>
            <div className="mt-0.5 text-[11px] text-dim">{entry?.desc}</div>
          </div>
          <div className="pointer-events-auto flex items-center gap-1 rounded-xl glass px-1.5 py-1">
            <Camera className="ml-1 h-3.5 w-3.5 text-dim" />
            {camBtn("iso", "Iso")}
            {camBtn("front", "Front")}
            {camBtn("top", "Top")}
            {camBtn("right", "Side")}
            <div className="mx-1 h-4 w-px bg-[var(--line)]" />
            <IconBtn label="Fullscreen" onClick={toggleFullscreen} className="border-0 bg-transparent">
              {isFullscreen ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
            </IconBtn>
          </div>
        </div>

        {/* toast */}
        {toast && (
          <div className="absolute left-1/2 top-20 -translate-x-1/2 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-200 backdrop-blur-xl shadow-[0_0_30px_rgba(52,211,153,0.3)]">
            <CircleCheck className="mr-2 inline h-4 w-4" />
            {toast}
          </div>
        )}

        {/* solved glow */}
        {solvedNow && history.length === 0 && !engine.busy && (
          <div className="pointer-events-none absolute bottom-3 left-3 rounded-xl glass px-3 py-1.5 text-[11px] text-emerald-300/90">
            Cube is in a solved state
          </div>
        )}
        </Panel>

        {/* move pad — its own bar below the stage, never overlapping the puzzle */}
        <Panel className="shrink-0 px-3 py-2">
          <div className="mx-auto flex max-w-full flex-wrap items-center justify-center gap-1.5 w-fit">
            {movePadMoves.map((m) => (
              <button
                key={m.id}
                disabled={engine.autoSolving}
                onClick={() => doMove(m.id, prime)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  doMove(m.id, !prime);
                }}
                className="h-8 min-w-8 rounded-lg border border-[var(--line)] bg-white/[0.03] px-2 font-mono text-[12px] font-bold text-[var(--text)]/90 transition-all hover:border-sky-400/50 hover:bg-sky-400/15 hover:text-sky-200 hover:shadow-[0_0_10px_rgba(56,189,248,0.3)] active:scale-90 cursor-pointer disabled:opacity-40"
                title={`Turn ${m.id} (right-click for inverse)`}
              >
                {prime ? `${m.id}'` : m.id}
              </button>
            ))}
            {(wideMoves.length > 0 || tipMoves.length > 0 || extraWide.length > 0) && (
              <>
                <div className="mx-1 h-5 w-px bg-[var(--line)]" />
                {[...wideMoves, ...extraWide, ...tipMoves].map((m) => (
                  <button
                    key={m.id}
                    disabled={engine.autoSolving}
                    onClick={() => doMove(m.id, prime)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      doMove(m.id, !prime);
                    }}
                    className="h-8 min-w-8 rounded-lg border border-violet-400/25 bg-violet-400/[0.06] px-2 font-mono text-[12px] font-bold text-violet-200/90 transition-all hover:border-violet-400/60 hover:bg-violet-400/20 active:scale-90 cursor-pointer disabled:opacity-40"
                  >
                    {prime ? `${m.id}'` : m.id}
                  </button>
                ))}
              </>
            )}
            <div className="mx-1 h-5 w-px bg-[var(--line)]" />
            <button
              onClick={() => setPrime((p) => !p)}
              className={cn(
                "h-8 rounded-lg border px-2 font-mono text-[12px] font-bold transition-all cursor-pointer",
                prime
                  ? "border-amber-400/50 bg-amber-400/15 text-amber-200"
                  : "border-[var(--line)] bg-white/[0.03] text-dim hover:text-[var(--text)]",
              )}
              title="Toggle inverse moves (')"
            >
              ′
            </button>
          </div>
        </Panel>
      </div>

      {/* RIGHT: controls */}
      <div className="flex w-full shrink-0 flex-col gap-3 lg:w-[330px] overflow-y-auto">
        {/* timer card — lives in the side panel so the stage stays clear */}
        <Panel
          className={cn(
            "transition-all",
            phase === "running" && "border-sky-400/40 shadow-[0_0_28px_rgba(56,189,248,0.18)]",
          )}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-dim">
                <TimerIcon className="h-3 w-3" />
                {phase === "running" ? "Solving…" : phase === "stopped" ? "Solved in" : phase === "armed" ? "Ready — make a move" : phase === "paused" ? "Paused" : "Timer"}
                {phase === "running" && <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse-soft" />}
              </div>
              <div className={cn("font-mono text-[26px] font-bold leading-none mt-1.5", phase === "stopped" ? "text-emerald-300" : "text-[var(--text)]")}>
                {fmtTime(phase === "idle" ? null : elapsed)}
              </div>
              <div className="mt-1 text-[10.5px] text-dim">
                {engine.movesSinceScramble} moves · best {fmtTime(best)}
              </div>
            </div>
            {(phase === "running" || phase === "paused") && (
              <button
                className="focusable flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] text-dim transition-all hover:text-sky-300 hover:bg-sky-400/10 cursor-pointer"
                onClick={phase === "running" ? pauseTimer : resumeTimer}
                title={phase === "running" ? "Pause timer" : "Resume timer"}
              >
                {phase === "running" ? <Pause className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
              </button>
            )}
          </div>
        </Panel>

        {layout === "play" && (
          <Panel>
            <PanelHeader title="Game Mode" icon={<Trophy className="h-3.5 w-3.5" />} />
            <div className="flex flex-wrap gap-1.5 p-3">
              {(
                [
                  ["free", "Free Play"],
                  ["timed", "Timed"],
                  ["practice", "Practice"],
                  ["challenge", "Challenge"],
                ] as [GameMode, string][]
              ).map(([m, label]) => (
                <Chip key={m} active={mode === m} onClick={() => setMode(m)}>
                  {label}
                </Chip>
              ))}
            </div>
            {mode === "challenge" && (
              <div className="mx-3 mb-3 rounded-xl border border-violet-400/25 bg-violet-400/[0.06] px-3 py-2 text-[12px]">
                <div className="font-semibold text-violet-200">
                  Stage {Math.min(challengeStage + 1, CHALLENGE_STAGES.length)}/{CHALLENGE_STAGES.length}:{" "}
                  {CHALLENGE_STAGES[Math.min(challengeStage, CHALLENGE_STAGES.length - 1)].label}
                </div>
                <div className="text-dim mt-0.5">
                  {CHALLENGE_STAGES[Math.min(challengeStage, CHALLENGE_STAGES.length - 1)].target}
                  {CHALLENGE_STAGES[Math.min(challengeStage, CHALLENGE_STAGES.length - 1)].puzzleId !== puzzleId && (
                    <button
                      className="ml-2 text-sky-300 underline cursor-pointer"
                      onClick={() => setPuzzle(CHALLENGE_STAGES[Math.min(challengeStage, CHALLENGE_STAGES.length - 1)].puzzleId)}
                    >
                      load it
                    </button>
                  )}
                </div>
              </div>
            )}
          </Panel>
        )}

        <Panel>
          <PanelHeader
            title="Scramble"
            icon={<ScrambleIcon className="h-3.5 w-3.5" />}
            right={
              <div className="flex gap-1">
                <IconBtn label="Undo move" onClick={() => engine.undo()} disabled={history.length === 0 || busy}>
                  <Undo2 className="h-3.5 w-3.5" />
                </IconBtn>
                <IconBtn label="Redo move" onClick={() => engine.redo()} disabled={busy}>
                  <Redo2 className="h-3.5 w-3.5" />
                </IconBtn>
                <IconBtn label="Reset puzzle" onClick={doReset} disabled={busy}>
                  <RotateCcw className="h-3.5 w-3.5" />
                </IconBtn>
              </div>
            }
          />
          <div className="space-y-3 p-3">
            <Btn variant="primary" className="w-full" onClick={doScramble} disabled={engine.autoSolving} glow>
              <Shuffle className="h-4 w-4" /> Scramble puzzle
            </Btn>
            {scrambleText && (
              <div className="max-h-20 overflow-y-auto rounded-xl border border-[var(--line)] bg-black/20 p-2 font-mono text-[11px] leading-5 text-sky-200/80">
                {scrambleText}
              </div>
            )}
            <div>
              <div className="mb-1 flex items-center gap-1.5 text-[11px] text-dim">
                <Keyboard className="h-3 w-3" /> Custom scramble
              </div>
              <div className="flex gap-1.5">
                <TextInput
                  value={customScr}
                  onChange={(e) => setCustomScr(e.target.value)}
                  placeholder={def.family === "pyraminx" ? "U L' R u ..." : "R U2 F' Rw ..."}
                  onKeyDown={(e) => e.key === "Enter" && applyCustom()}
                />
                <Btn variant="ghost" onClick={applyCustom}>Apply</Btn>
              </div>
              {customErr && <div className="mt-1 text-[11px] text-rose-300">{customErr}</div>}
            </div>
          </div>
        </Panel>

        {/* auto solver */}
        <Panel>
          <PanelHeader title="Auto Solver" icon={<Bot className="h-3.5 w-3.5" />} right={
            solverReady ? <Badge tone="success">engine ready</Badge> : <Badge tone="warn">warming up</Badge>
          } />
          <div className="space-y-3 p-3">
            {(solve.status === "idle" || solve.status === "error" || solve.status === "done") && (
              <Btn
                variant="accent"
                className="w-full"
                onClick={doAutoSolve}
                disabled={!solverReady || engine.autoSolving}
                glow={solverReady}
              >
                {!solverReady ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                {solve.status === "done" ? "Solve again" : "Solve it for me"}
              </Btn>
            )}

            {solve.status === "thinking" && (
              <div className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white/[0.02] p-3 text-[12px] text-dim">
                <Loader2 className="h-4 w-4 animate-spin text-sky-300" /> Computing solution…
              </div>
            )}

            {(solve.status === "running" || solve.status === "paused" || solve.status === "done") && solve.meta && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-[11px] text-dim">
                  <span>{solve.meta.alg}</span>
                  <span className="font-mono text-sky-300">
                    {Math.max(solveDone, 0)}/{solveTotal} moves
                  </span>
                </div>
                <Progress value={solveTotal ? solveDone / solveTotal : 0} />
                {solve.status !== "done" ? (
                  <div className="flex gap-1.5">
                    {solve.status === "running" ? (
                      <Btn variant="ghost" className="flex-1" onClick={() => engine.pauseSolve()}>
                        <Pause className="h-3.5 w-3.5" /> Pause
                      </Btn>
                    ) : (
                      <Btn variant="ghost" className="flex-1" onClick={() => engine.resumeSolve()}>
                        <PlayIcon className="h-3.5 w-3.5" /> Resume
                      </Btn>
                    )}
                    <Btn
                      variant="danger"
                      className="flex-1"
                      onClick={() => {
                        engine.stopSolve();
                        setSolve({ status: "idle" });
                      }}
                    >
                      <Square className="h-3.5 w-3.5" /> Stop
                    </Btn>
                  </div>
                ) : (
                  <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-2.5 text-[12px] text-emerald-200">
                    <CircleCheck className="mr-1.5 inline h-4 w-4" />
                    {solve.meta.optimal ? "Solved optimally." : "Solved."} {solve.meta.detail}
                  </div>
                )}
                <Slider
                  label="Animation speed"
                  value={settings.solveSpeed}
                  min={0.05}
                  max={0.7}
                  step={0.05}
                  onChange={(v) => patchSettings({ solveSpeed: v })}
                  format={(v) => `${Math.round(1 / v)}/s`}
                />
                {layout === "solver" && (
                  <div className="max-h-36 overflow-y-auto rounded-xl border border-[var(--line)] bg-black/20 p-2.5 leading-6">
                    {solve.meta.moves.map((m, i) => (
                      <span
                        key={i}
                        className={cn(
                          "mr-1.5 inline-block rounded px-1 font-mono text-[11px] transition-all",
                          i === solveDone
                            ? "bg-sky-400/25 text-sky-200 shadow-[0_0_8px_rgba(56,189,248,0.4)]"
                            : i < solveDone
                              ? "text-dim/50"
                              : "text-[var(--text)]/80",
                        )}
                      >
                        {formatMove(m as AppliedMove)}
                      </span>
                    ))}
                  </div>
                )}
                {layout === "solver" && <Explainer alg={solve.meta.alg} />}
              </div>
            )}

            {solve.status === "error" && (
              <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-2.5 text-[12px] text-rose-200">
                <AlertTriangle className="mr-1.5 inline h-4 w-4" /> {solve.error}
              </div>
            )}
          </div>
        </Panel>

        {/* history */}
        <Panel className="min-h-28">
          <PanelHeader title={`Move history · ${history.length}`} icon={<StepForward className="h-3.5 w-3.5" />} />
          <div className="max-h-32 overflow-y-auto p-3 pt-2 leading-7">
            {history.length === 0 ? (
              <div className="flex items-center gap-2 text-[12px] text-dim">
                <MousePointer2 className="h-3.5 w-3.5" />
                Drag stickers on the puzzle, use the move pad, or keys <Kbd>U</Kbd> <Kbd>R</Kbd> <Kbd>F</Kbd> — <Kbd>Shift</Kbd> inverts, <Kbd>Alt</Kbd> = wide/tips.
              </div>
            ) : (
              history.map((m, i) => (
                <span
                  key={i}
                  className={cn(
                    "mr-1.5 font-mono text-[11.5px]",
                    i === history.length - 1 ? "rounded bg-sky-400/20 px-1 text-sky-200" : "text-[var(--text)]/70",
                  )}
                >
                  {formatMove(m)}
                </span>
              ))
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Explainer({ alg }: { alg: string }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-white/[0.02] p-3 text-[11.5px] leading-relaxed text-dim">
      <div className="mb-1 flex items-center gap-1.5 font-semibold uppercase tracking-wider text-[10px] text-[var(--text)]/70">
        <Bot className="h-3 w-3" /> How this solver works
      </div>
      {alg}
      {alg.includes("Kociemba") && (
        <p className="mt-1">
          Phase 1 brings the cube into the subgroup where edges are oriented and the UD-slice
          edges sit in the middle layer; phase 2 finishes using only half turns on R/F/L. Solutions
          land at ~20 moves in under a second.
        </p>
      )}
      {alg.includes("IDA*") && (
        <p className="mt-1">
          Iterative-deepening A* searches over corner permutation and twist coordinates, guided by
          two precomputed BFS pattern databases — always finds a shortest solution.
        </p>
      )}
      {alg.includes("BFS") && (
        <p className="mt-1">
          A complete breadth-first search over all 933,120 Pyraminx states (edges × flips × axial
          twists) maps every position to its God's-number distance, then walks downhill. Tips are
          aligned at the end.
        </p>
      )}
      {alg.includes("rewind") && (
        <p className="mt-1">
          This engine currently guarantees correctness, not optimality: it replays the exact inverse
          of every legal move that built this state. A reduction solver with parity handling is on
          the roadmap for big cubes.
        </p>
      )}
    </div>
  );
}
