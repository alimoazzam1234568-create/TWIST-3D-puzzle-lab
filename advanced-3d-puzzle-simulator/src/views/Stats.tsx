import { BarChart3, History, Trash2 } from "lucide-react";
import { Badge, Btn, Panel, PanelHeader, Stat } from "../components/ui";
import { catalogEntry } from "../lib/catalog";
import { fmtTime, useApp } from "../store";

export function Stats() {
  const stats = useApp((s) => s.stats);
  const history = useApp((s) => s.history);
  const resetStats = useApp((s) => s.resetStats);

  const totalSolves = Object.values(stats).reduce((a, b) => a + b.solves, 0);
  const totalMoves = Object.values(stats).reduce((a, b) => a + b.totalMoves, 0);
  const totalScrambles = Object.values(stats).reduce((a, b) => a + b.scrambles, 0);
  const entries = Object.entries(stats).sort(
    ([a], [b]) => (catalogEntry(a)?.name ?? a).localeCompare(catalogEntry(b)?.name ?? b),
  );

  const barMax = Math.max(1, ...entries.map(([, s]) => s.solves));

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Statistics</h1>
            <p className="mt-1 text-[13.5px] text-dim">Stored locally on this device.</p>
          </div>
          <Btn
            variant="danger"
            onClick={() => {
              if (window.confirm("Delete all statistics and history?")) resetStats();
            }}
          >
            <Trash2 className="h-4 w-4" /> Reset all data
          </Btn>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Total solves" value={totalSolves} accent />
          <Stat label="Moves executed" value={totalMoves.toLocaleString()} />
          <Stat label="Scrambles" value={totalScrambles.toLocaleString()} />
          <Stat
            label="Best single solve"
            value={fmtTime(
              Object.values(stats).reduce<number | null>(
                (a, b) => (b.best === null ? a : a === null ? b.best : Math.min(a, b.best)),
                null,
              ),
            )}
          />
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <Panel className="min-h-40">
            <PanelHeader title="Records by puzzle" icon={<BarChart3 className="h-3.5 w-3.5" />} />
            <div className="divide-y divide-[var(--line)]">
              {entries.length === 0 && (
                <div className="p-6 text-[13px] text-dim">
                  No solves yet — your personal records will appear here.
                </div>
              )}
              {entries.map(([id, s]) => {
                const avg = s.last.length
                  ? s.last.reduce((a, b) => a + b, 0) / s.last.length
                  : null;
                return (
                  <div key={id} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-medium">
                        {catalogEntry(id)?.name ?? id}
                      </span>
                      <div className="flex items-center gap-3 font-mono text-[11.5px]">
                        <span className="text-dim">{s.solves} solves</span>
                        <span className="text-sky-300">best {fmtTime(s.best)}</span>
                        <span className="text-dim">avg {fmtTime(avg)}</span>
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sky-500 to-violet-500"
                        style={{ width: `${(s.solves / barMax) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel className="min-h-40">
            <PanelHeader title="Solving history" icon={<History className="h-3.5 w-3.5" />} />
            <div className="max-h-[430px] divide-y divide-[var(--line)] overflow-y-auto">
              {history.length === 0 && (
                <div className="p-6 text-[13px] text-dim">
                  Finish a solve to start building your log.
                </div>
              )}
              {history.map((h, i) => (
                <div key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium">{h.puzzleName}</div>
                    <div className="text-[11px] text-dim">
                      {new Date(h.date).toLocaleString()} · {h.moves} moves
                    </div>
                  </div>
                  <Badge tone="info" className="font-mono normal-case">
                    {fmtTime(h.timeMs)}
                  </Badge>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
