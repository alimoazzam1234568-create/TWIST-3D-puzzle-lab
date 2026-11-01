import { Moon, Palette, RotateCcw, Settings2, Sun, Volume2 } from "lucide-react";
import { DEFAULT_PALETTE, FACE_NAMES } from "../lib/engine/types";
import { Btn, Chip, Panel, PanelHeader, Slider, Toggle } from "../components/ui";
import { useApp } from "../store";
import { setMuted } from "../lib/sound";

export function Settings() {
  const settings = useApp((s) => s.settings);
  const patch = useApp((s) => s.patchSettings);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-[13.5px] text-dim">Personalize the lab. Everything saves locally.</p>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Panel>
            <PanelHeader title="Appearance & feel" icon={<Sun className="h-3.5 w-3.5" />} />
            <div className="space-y-3 p-4">
              <div className="flex items-center gap-2">
                <Chip active={settings.theme === "dark"} onClick={() => patch({ theme: "dark" })}>
                  <Moon className="mr-1 inline h-3 w-3" /> Dark
                </Chip>
                <Chip active={settings.theme === "light"} onClick={() => patch({ theme: "light" })}>
                  <Sun className="mr-1 inline h-3 w-3" /> Light
                </Chip>
              </div>
              <Toggle
                label="Sound effects"
                hint="Turn clicks, scramble swooshes, solve chimes"
                checked={settings.sound}
                onChange={(v) => {
                  patch({ sound: v });
                  setMuted(!v);
                }}
              />
              <Toggle
                label="Slow camera auto-rotate"
                hint="The stage orbits gently when idle"
                checked={settings.cameraAutoRotate}
                onChange={(v) => patch({ cameraAutoRotate: v })}
              />
              <div>
                <div className="mb-2 flex items-center gap-2 text-[12px] text-dim">
                  <Settings2 className="h-3.5 w-3.5" /> Render quality
                </div>
                <div className="flex gap-2">
                  <Chip active={settings.quality === "high"} onClick={() => patch({ quality: "high" })}>
                    High (shadows)
                  </Chip>
                  <Chip
                    active={settings.quality === "balanced"}
                    onClick={() => patch({ quality: "balanced" })}
                  >
                    Balanced
                  </Chip>
                </div>
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Motion" icon={<Settings2 className="h-3.5 w-3.5" />} />
            <div className="space-y-4 p-4">
              <Slider
                label="Manual turn duration"
                value={settings.animSpeed}
                min={0.08}
                max={0.5}
                step={0.02}
                onChange={(v) => patch({ animSpeed: v })}
                format={(v) => `${Math.round(v * 1000)}ms`}
              />
              <Slider
                label="Auto-solver move duration"
                value={settings.solveSpeed}
                min={0.04}
                max={0.6}
                step={0.02}
                onChange={(v) => patch({ solveSpeed: v })}
                format={(v) => `${Math.round(v * 1000)}ms`}
              />
              <p className="text-[11.5px] leading-relaxed text-dim">
                Scrambles always animate fast. Solver speed can also be changed live from the solve
                panel while a solution is running.
              </p>
            </div>
          </Panel>

          <Panel className="lg:col-span-2">
            <PanelHeader
              title="Sticker palette"
              icon={<Palette className="h-3.5 w-3.5" />}
              right={
                <Btn variant="ghost" className="px-2.5 py-1 text-[11px]" onClick={() => patch({ palette: [...DEFAULT_PALETTE] })}>
                  <RotateCcw className="h-3 w-3" /> Reset
                </Btn>
              }
            />
            <div className="grid grid-cols-3 gap-3 p-4 sm:grid-cols-6">
              {settings.palette.map((c, i) => (
                <label key={i} className="group cursor-pointer">
                  <div
                    className="flex h-16 items-center justify-center rounded-xl border border-[var(--line)] text-[11px] font-bold uppercase tracking-widest transition-transform group-hover:scale-[1.03]"
                    style={{ background: c, color: i === 0 || i === 3 ? "#111" : "#fff" }}
                  >
                    {FACE_NAMES[i]}
                  </div>
                  <input
                    type="color"
                    value={c}
                    onChange={(e) => {
                      const palette = settings.palette.slice();
                      palette[i] = e.target.value;
                      patch({ palette });
                    }}
                    className="mt-1.5 h-6 w-full cursor-pointer rounded bg-transparent"
                  />
                </label>
              ))}
            </div>
            <p className="px-4 pb-4 text-[11.5px] text-dim">
              Palette slots map to cube faces U R F D L B. Pyraminx/Skewb reuse matching slots.
            </p>
          </Panel>

          <Panel className="lg:col-span-2">
            <PanelHeader title="About this build" icon={<Volume2 className="h-3.5 w-3.5" />} />
            <div className="space-y-2 p-4 text-[12.5px] leading-relaxed text-dim">
              <p>
                <span className="font-semibold text-[var(--text)]">Twist</span> runs a full piece-level
                mechanical simulation on an exact integer lattice — every cubie's position and
                orientation is tracked, rotations are exact signed-permutation matrices, and solvers
                decode the live geometry directly (never a parallel fake model).
              </p>
              <p>
                Solvers run in a Web Worker: Kociemba two-phase (3×3), IDA* with pattern databases
                (2×2, optimal), full-state BFS (Pyraminx, optimal). Big cubes use a transparent
                correct-by-construction rewind solver; a reduction engine with parity handling is on
                the roadmap.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
