import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "../utils/cn";

// ---------------------------------------------------------------------------
export function Panel({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("glass rounded-2xl shadow-2xl", className)} {...rest}>
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  right,
  icon,
}: {
  title: string;
  right?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2 border-b border-[var(--line)]">
      <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] uppercase text-dim">
        {icon}
        {title}
      </div>
      {right}
    </div>
  );
}

// ---------------------------------------------------------------------------
type BtnVariant = "primary" | "ghost" | "danger" | "accent" | "success";

export const Btn = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; glow?: boolean }
>(function Btn({ className, variant = "ghost", glow, ...rest }, ref) {
  const styles: Record<BtnVariant, string> = {
    primary:
      "bg-gradient-to-br from-sky-500 to-violet-600 text-white hover:from-sky-400 hover:to-violet-500 border border-sky-400/40",
    accent:
      "bg-[var(--accent-soft)] text-[var(--accent)] border border-[rgba(56,189,248,0.35)] hover:bg-[rgba(56,189,248,0.2)]",
    ghost:
      "bg-white/[0.03] text-[var(--text)] border border-[var(--line)] hover:bg-white/[0.07] hover:border-sky-400/30",
    success:
      "bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 hover:bg-emerald-500/25",
    danger:
      "bg-rose-500/10 text-rose-300 border border-rose-400/30 hover:bg-rose-500/20",
  };
  return (
    <button
      ref={ref}
      className={cn(
        "focusable inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-medium transition-all duration-150 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none select-none cursor-pointer",
        styles[variant],
        glow && "shadow-[0_0_18px_rgba(56,189,248,0.35)]",
        className,
      )}
      {...rest}
    />
  );
});

export function IconBtn({
  className,
  label,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        "focusable inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-white/[0.03] text-dim transition-all hover:text-[var(--text)] hover:border-sky-400/40 hover:bg-sky-400/10 active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer",
        className,
      )}
      {...rest}
    />
  );
}

// ---------------------------------------------------------------------------
export function Chip({
  children,
  className,
  active,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-[12px] font-medium transition-all cursor-pointer",
        active
          ? "border-sky-400/60 bg-sky-400/15 text-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.25)]"
          : "border-[var(--line)] bg-white/[0.02] text-dim hover:text-[var(--text)] hover:border-slate-400/40",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Badge({
  children,
  tone = "info",
  className,
}: {
  children: ReactNode;
  tone?: "info" | "success" | "warn" | "violet" | "dim";
  className?: string;
}) {
  const tones = {
    info: "border-sky-400/40 bg-sky-400/10 text-sky-300",
    success: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
    warn: "border-amber-400/40 bg-amber-400/10 text-amber-300",
    violet: "border-violet-400/40 bg-violet-400/10 text-violet-300",
    dim: "border-[var(--line)] bg-white/[0.03] text-dim",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between text-[12px]">
        <span className="text-dim">{label}</span>
        <span className="font-mono text-sky-300">{format ? format(value) : value}</span>
      </div>
      <input
        type="range"
        className="w-full accent-sky-400 cursor-pointer"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </label>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-white/[0.02] px-3.5 py-2.5 text-left transition-colors hover:border-slate-400/30 cursor-pointer"
    >
      <span>
        <span className="block text-[13px] font-medium">{label}</span>
        {hint && <span className="block text-[11px] text-dim mt-0.5">{hint}</span>}
      </span>
      <span
        className={cn(
          "relative h-5.5 w-10 shrink-0 rounded-full border transition-colors",
          checked ? "border-sky-400/60 bg-sky-500/40" : "border-[var(--line)] bg-white/[0.05]",
        )}
        style={{ height: 22 }}
      >
        <span
          className={cn(
            "absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full transition-all",
            checked ? "left-[19px] bg-sky-300 shadow-[0_0_8px_rgba(56,189,248,0.8)]" : "left-[3px] bg-slate-400",
          )}
        />
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
export const TextInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function TextInput({ className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "focusable w-full rounded-xl border border-[var(--line)] bg-white/[0.03] px-3 py-2 font-mono text-[13px] text-[var(--text)] placeholder:text-dim/60",
        className,
      )}
      {...rest}
    />
  );
});

export function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white/[0.02] px-4 py-3.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dim">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 font-mono text-2xl font-bold",
          accent ? "text-sky-300" : "text-[var(--text)]",
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-dim">{sub}</div>}
    </div>
  );
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06] border border-[var(--line)]">
      <div
        className="h-full rounded-full bg-gradient-to-r from-sky-400 to-violet-500 transition-[width] duration-200 shadow-[0_0_10px_rgba(56,189,248,0.5)]"
        style={{ width: `${Math.round(Math.min(Math.max(value, 0), 1) * 100)}%` }}
      />
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-[var(--line)] bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] text-dim">
      {children}
    </kbd>
  );
}
