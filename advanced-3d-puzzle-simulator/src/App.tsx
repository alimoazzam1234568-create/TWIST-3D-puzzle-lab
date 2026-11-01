import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Bot,
  Boxes,
  ChartNoAxesColumn,
  Gamepad2,
  Home,
  Moon,
  Settings as SettingsIcon,
  Sun,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "./utils/cn";
import { useApp, type View } from "./store";
import { setMuted } from "./lib/sound";
import { solverClient } from "./lib/solverClient";
import { Home as HomeView } from "./views/Home";
import { Library } from "./views/Library";
import { Play } from "./views/Play";
import { SolverView } from "./views/SolverView";
import { Tutorials } from "./views/Tutorials";
import { Stats } from "./views/Stats";
import { Settings } from "./views/Settings";

const NAV: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: "home", label: "Home", icon: <Home className="h-4 w-4" /> },
  { id: "library", label: "Library", icon: <Boxes className="h-4 w-4" /> },
  { id: "play", label: "Play", icon: <Gamepad2 className="h-4 w-4" /> },
  { id: "solver", label: "Auto Solver", icon: <Bot className="h-4 w-4" /> },
  { id: "tutorials", label: "Tutorials", icon: <BookOpen className="h-4 w-4" /> },
  { id: "stats", label: "Statistics", icon: <ChartNoAxesColumn className="h-4 w-4" /> },
  { id: "settings", label: "Settings", icon: <SettingsIcon className="h-4 w-4" /> },
];

function hashToView(h: string): View | null {
  const v = h.replace(/^#\/?/, "") as View;
  return NAV.some((n) => n.id === v) ? v : null;
}

export default function App() {
  const view = useApp((s) => s.view);
  const setView = useApp((s) => s.setView);
  const theme = useApp((s) => s.settings.theme);
  const sound = useApp((s) => s.settings.sound);
  const patch = useApp((s) => s.patchSettings);

  // theme
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // sound mute
  useEffect(() => setMuted(!sound), [sound]);

  // warm up solver worker early
  useEffect(() => solverClient.init(), []);

  // hash routing
  useEffect(() => {
    const v = hashToView(window.location.hash);
    if (v) setView(v);
    const onHash = () => {
      const nv = hashToView(window.location.hash);
      if (nv) setView(nv);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (window.location.hash !== `#/${view}`) window.history.replaceState(null, "", `#/${view}`);
  }, [view]);

  return (
    <div className="flex h-full flex-col">
      <div className="bg-ambience" />
      <div className="bg-grid" />

      {/* top bar */}
      <header className="z-20 flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--bg)_70%,transparent)] px-4 py-2.5 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-violet-600 shadow-[0_0_18px_rgba(99,102,241,0.5)]">
            <Boxes className="h-4.5 w-4.5 text-white" />
          </div>
          <div className="leading-none">
            <div className="text-[15px] font-bold tracking-tight">
              TWIST<span className="text-sky-400">.</span>
            </div>
            <div className="text-[9.5px] uppercase tracking-[0.22em] text-dim">3D puzzle lab</div>
          </div>
        </div>

        <nav className="hidden items-center gap-0.5 md:flex">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setView(n.id)}
              className={cn(
                "focusable relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-all cursor-pointer",
                view === n.id ? "text-sky-300" : "text-dim hover:text-[var(--text)]",
              )}
            >
              {n.icon}
              {n.label}
              {view === n.id && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-0 -z-10 rounded-lg border border-sky-400/30 bg-sky-400/10"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => patch({ sound: !sound })}
            className="focusable flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] text-dim transition-all hover:text-[var(--text)] cursor-pointer"
            title={sound ? "Mute sounds" : "Enable sounds"}
          >
            {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <button
            onClick={() => patch({ theme: theme === "dark" ? "light" : "dark" })}
            className="focusable flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] text-dim transition-all hover:text-[var(--text)] cursor-pointer"
            title="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-[var(--line)] bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] py-2 backdrop-blur-xl md:hidden">
        {NAV.slice(0, 6).map((n) => (
          <button
            key={n.id}
            onClick={() => setView(n.id)}
            className={cn(
              "flex flex-col items-center gap-0.5 text-[9px] font-medium cursor-pointer",
              view === n.id ? "text-sky-300" : "text-dim",
            )}
          >
            {n.icon}
            {n.label}
          </button>
        ))}
      </nav>

      {/* content */}
      <main className="relative z-10 min-h-0 flex-1 pb-14 md:pb-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="h-full"
          >
            {view === "home" && <HomeView />}
            {view === "library" && <Library />}
            {view === "play" && <Play />}
            {view === "solver" && <SolverView />}
            {view === "tutorials" && <Tutorials />}
            {view === "stats" && <Stats />}
            {view === "settings" && <Settings />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
