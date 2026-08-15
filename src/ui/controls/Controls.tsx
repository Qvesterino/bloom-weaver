import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/* --------------------------------------------------------------- structure */

export function Section({
  title,
  children,
  action,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-border/70 last:border-b-0">
      <header className="flex items-center justify-between gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="focus-ring label-xs flex flex-1 items-center gap-1.5 rounded text-left transition-colors hover:text-foreground"
        >
          <span
            className={cn(
              "inline-block transition-transform duration-150",
              open ? "rotate-90" : "rotate-0",
            )}
          >
            ▸
          </span>
          {title}
        </button>
        {action}
      </header>
      {open ? <div className="space-y-2.5 px-3 pb-3">{children}</div> : null}
    </section>
  );
}

export function Row({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,5.5rem)_1fr] items-center gap-2" title={hint}>
      <span className="label-xs truncate normal-case tracking-normal">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/* ----------------------------------------------------------------- slider */

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  onCommit?: () => void;
  precision?: number;
  suffix?: string;
}

export function Slider({
  value,
  min,
  max,
  step = 0.01,
  onChange,
  onCommit,
  precision = 2,
  suffix,
}: SliderProps) {
  const [text, setText] = useState<string | null>(null);
  const display = text ?? value.toFixed(precision).replace(/\.?0+$/, "") ?? String(value);
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        className="lab-slider focus-ring flex-1"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
      />
      <input
        className="numeric focus-ring w-[4.25rem] shrink-0 rounded-md border border-border bg-input px-1.5 py-1 text-right text-foreground"
        value={suffix && text === null ? `${display}${suffix}` : display}
        onChange={(e) => setText(e.target.value)}
        onFocus={(e) => {
          setText(String(value));
          e.currentTarget.select();
        }}
        onBlur={() => {
          if (text !== null) {
            const parsed = Number.parseFloat(text);
            if (Number.isFinite(parsed)) onChange(Math.min(max, Math.max(min, parsed)));
            onCommit?.();
          }
          setText(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setText(null);
            e.currentTarget.blur();
          }
        }}
      />
    </div>
  );
}

/* ----------------------------------------------------------------- select */

export function Select<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="focus-ring w-full appearance-none rounded-md border border-border bg-input px-2 py-1.5 pr-6 text-xs text-foreground transition-colors hover:border-border-strong"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-popover">
            {o.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[9px] text-muted-foreground">
        ▼
      </span>
    </div>
  );
}

/* ----------------------------------------------------------------- toggle */

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "focus-ring relative h-4.5 w-8 shrink-0 rounded-full border transition-colors",
        checked ? "border-primary/60 bg-primary/30" : "border-border bg-surface-sunken",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-3 w-3 rounded-full transition-all duration-150",
          checked ? "left-4 bg-primary shadow-glow" : "left-0.5 bg-muted-foreground",
        )}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ button */

export function Button({
  children,
  onClick,
  variant = "ghost",
  size = "sm",
  disabled,
  title,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "outline" | "danger" | "accent";
  size?: "sm" | "xs" | "md";
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "focus-ring inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-all disabled:pointer-events-none disabled:opacity-40",
        size === "xs" && "px-1.5 py-1 text-[11px]",
        size === "sm" && "px-2.5 py-1.5 text-xs",
        size === "md" && "px-3.5 py-2 text-sm",
        variant === "primary" &&
          "bg-primary text-primary-foreground hover:brightness-110 active:brightness-95",
        variant === "accent" && "bg-accent text-accent-foreground hover:brightness-110",
        variant === "outline" &&
          "border border-border bg-surface-raised text-foreground hover:border-border-strong hover:bg-muted",
        variant === "ghost" && "text-muted-foreground hover:bg-muted hover:text-foreground",
        variant === "danger" && "text-destructive hover:bg-destructive/15",
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ tabs */

export function Tabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-0.5 rounded-md border border-border bg-surface-sunken p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "focus-ring flex-1 rounded px-2 py-1 text-[11px] font-medium transition-colors",
            value === o.value
              ? "bg-surface-raised text-foreground shadow-panel"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ color input */

export function ColorInput({
  value,
  onChange,
  onCommit,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit?: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="focus-ring h-6 w-6 shrink-0 rounded-md border border-border-strong"
        style={{ backgroundColor: value }}
        aria-label="Pick color"
      />
      <input
        ref={ref}
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        className="sr-only"
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        className="numeric focus-ring min-w-0 flex-1 rounded-md border border-border bg-input px-2 py-1 uppercase"
      />
    </div>
  );
}

/* --------------------------------------------------------------- vector 3 */

export function Vector3Input({
  value,
  onChange,
  onCommit,
  step = 0.05,
}: {
  value: { x: number; y: number; z: number };
  onChange: (axis: "x" | "y" | "z", v: number) => void;
  onCommit?: () => void;
  step?: number;
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {(["x", "y", "z"] as const).map((axis) => (
        <NumberInput
          key={axis}
          prefix={axis.toUpperCase()}
          value={value[axis]}
          step={step}
          onChange={(v) => onChange(axis, v)}
          onCommit={onCommit}
        />
      ))}
    </div>
  );
}

export function NumberInput({
  value,
  onChange,
  onCommit,
  step = 0.1,
  prefix,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  onCommit?: () => void;
  step?: number;
  prefix?: string;
  min?: number;
  max?: number;
}) {
  const [text, setText] = useState<string | null>(null);
  const dragging = useRef<{ startX: number; startValue: number } | null>(null);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!dragging.current) return;
      const delta = (e.clientX - dragging.current.startX) * step;
      let next = dragging.current.startValue + delta;
      if (min !== undefined) next = Math.max(min, next);
      if (max !== undefined) next = Math.min(max, next);
      onChange(Number(next.toFixed(4)));
    };
    const up = () => {
      if (dragging.current) {
        dragging.current = null;
        onCommit?.();
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [onChange, onCommit, step, min, max]);

  return (
    <div className="flex items-center gap-1 rounded-md border border-border bg-input px-1.5 focus-within:border-border-strong">
      {prefix ? (
        <span
          onPointerDown={(e) => {
            dragging.current = { startX: e.clientX, startValue: value };
            e.preventDefault();
          }}
          className="numeric cursor-ew-resize text-muted-foreground select-none"
        >
          {prefix}
        </span>
      ) : null}
      <input
        className="numeric focus-ring w-full min-w-0 bg-transparent py-1 text-right text-foreground outline-none"
        value={text ?? Number(value.toFixed(3))}
        onChange={(e) => setText(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={() => {
          if (text !== null) {
            const parsed = Number.parseFloat(text);
            if (Number.isFinite(parsed)) onChange(parsed);
            onCommit?.();
          }
          setText(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  onCommit,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit?: () => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      className="focus-ring w-full rounded-md border border-border bg-input px-2 py-1.5 text-xs text-foreground"
    />
  );
}
