import { useMemo, useState } from "react";
import { ArrowUpRight, Clock3, Cpu, Play, Search } from "lucide-react";
import { Badge, Chip, Panel } from "../components/ui";
import { CATALOG } from "../lib/catalog";
import { cn } from "../utils/cn";
import { useApp } from "../store";

const CATS = ["All", "Standard Cubes", "Shape Mods", "Twisty Specials"] as const;

/** stylized geometric glyph per puzzle */
function Glyph({ short, active }: { short: string; active?: boolean }) {
  return (
    <div
      className={cn(
        "flex h-14 w-14 shrink-0 items-center justify-center rounded-xl font-mono text-lg font-bold transition-all",
        active
          ? "bg-gradient-to-br from-sky-500/30 to-violet-500/30 text-sky-200 ring-1 ring-sky-400/50 shadow-[0_0_18px_rgba(56,189,248,0.25)]"
          : "bg-white/[0.04] text-dim ring-1 ring-[var(--line)] group-hover:text-[var(--text)]",
      )}
    >
      {short}
    </div>
  );
}

export function Library() {
  const [cat, setCat] = useState<(typeof CATS)[number]>("All");
  const [q, setQ] = useState("");
  const setView = useApp((s) => s.setView);
  const setPuzzle = useApp((s) => s.setPuzzle);
  const current = useApp((s) => s.currentPuzzleId);

  const list = useMemo(
    () =>
      CATALOG.filter(
        (c) =>
          (cat === "All" || c.category === cat) &&
          (q.trim() === "" || c.name.toLowerCase().includes(q.toLowerCase())),
      ),
    [cat, q],
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Puzzle Library</h1>
            <p className="mt-1 text-[13.5px] text-dim">
              {CATALOG.filter((c) => c.status === "ready").length} fully playable ·{" "}
              {CATALOG.filter((c) => c.status === "soon").length} on the roadmap — every entry gets
              its own real mechanics and solver.
            </p>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search puzzles…"
              className="focusable w-64 rounded-xl border border-[var(--line)] bg-white/[0.03] py-2 pl-9 pr-3 text-[13px] placeholder:text-dim/60"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {CATS.map((c) => (
            <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
              {c}
            </Chip>
          ))}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => {
            const ready = c.status === "ready";
            return (
              <Panel
                key={c.id}
                className={cn(
                  "group relative overflow-hidden p-5 transition-all",
                  ready && "hover:border-sky-400/40 hover:shadow-[0_0_35px_rgba(56,189,248,0.12)]",
                  !ready && "opacity-70",
                  current === c.id && "border-sky-400/50",
                )}
              >
                <div className="flex items-start gap-4">
                  <Glyph short={c.short} active={current === c.id} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-semibold">{c.name}</h3>
                      {current === c.id && <Badge tone="info">loaded</Badge>}
                    </div>
                    <div className="mt-0.5 text-[11px] uppercase tracking-wider text-dim">
                      {c.category}
                    </div>
                  </div>
                </div>
                <p className="mt-3 min-h-9 text-[12.5px] leading-relaxed text-dim">{c.desc}</p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {ready ? (
                      c.solverLabel?.includes("Optimal") || c.solverLabel?.includes("Kociemba") ? (
                        <Badge tone="success">
                          <Cpu className="h-3 w-3" /> {c.solverLabel}
                        </Badge>
                      ) : (
                        <Badge tone="violet">
                          <Cpu className="h-3 w-3" /> {c.solverLabel}
                        </Badge>
                      )
                    ) : (
                      <Badge tone="dim">
                        <Clock3 className="h-3 w-3" /> coming soon
                      </Badge>
                    )}
                  </div>
                  {ready && (
                    <button
                      onClick={() => {
                        setPuzzle(c.id);
                        setView("play");
                      }}
                      className="focusable flex items-center gap-1 rounded-lg bg-sky-400/10 px-3 py-1.5 text-[12px] font-semibold text-sky-300 transition-all hover:bg-sky-400/25 hover:shadow-[0_0_14px_rgba(56,189,248,0.3)] cursor-pointer"
                    >
                      <Play className="h-3.5 w-3.5" /> Play
                      <ArrowUpRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </Panel>
            );
          })}
        </div>
      </div>
    </div>
  );
}
