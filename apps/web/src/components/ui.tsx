import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
  title,
  action,
}: {
  className?: string;
  children: React.ReactNode;
  title?: string;
  action?: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-lg backdrop-blur",
        className,
      )}
    >
      {title || action ? (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title ? (
            <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-400">
              {title}
            </h2>
          ) : (
            <span />
          )}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "good" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-400"
      : tone === "bad"
        ? "text-rose-400"
        : "text-zinc-100";
  return (
    <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/50 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={cn("mt-1 text-lg font-semibold tabular-nums", toneClass)}>
        {value}
      </p>
    </div>
  );
}

export function Button({
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  const variants = {
    primary:
      "bg-emerald-500 text-black hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-400",
    secondary:
      "bg-zinc-800 text-zinc-100 hover:bg-zinc-700 disabled:opacity-50",
    danger: "bg-rose-600 text-white hover:bg-rose-500",
    ghost: "bg-transparent text-zinc-300 hover:bg-zinc-800",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
      {...props}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
      {...props}
    />
  );
}

export function Badge({
  children,
  ok,
}: {
  children: React.ReactNode;
  ok?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
        ok ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400",
      )}
    >
      {children}
    </span>
  );
}
