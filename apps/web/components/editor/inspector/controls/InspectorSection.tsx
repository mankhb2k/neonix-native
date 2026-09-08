"use client";

import { ChevronDown, Diamond } from "lucide-react";
import type { ReactNode } from "react";

export const inspectorInputClass =
  "h-7 w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-site)] px-2 text-[12px] text-[var(--fg-primary)] outline-none focus:border-[var(--border-focus)]";

export function InspectorSection({
  label,
  open,
  onToggle,
  children,
  className,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`border-b border-[var(--border-subtle)] ${className ?? ""}`}>
      <button
        type="button"
        className="flex min-h-9 w-full items-center justify-between px-0 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--fg-muted)]"
        aria-expanded={open}
        onClick={onToggle}
      >
        {label}
        <ChevronDown size={13} className={`transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>
      {open ? <div className="space-y-2 px-0 pb-3">{children}</div> : null}
    </section>
  );
}

export function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="shrink-0 text-[11px] text-[var(--fg-muted)]">{label}</span>
      <span className="max-w-[7rem] truncate text-right font-mono text-[11px] text-[var(--fg-secondary)]">{value}</span>
    </div>
  );
}

export function ActionButton({
  label,
  onClick,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="h-7 flex-1 rounded-md border border-[var(--border-strong)] px-2 text-[11px] text-[var(--fg-secondary)] disabled:opacity-40"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export function IconActionButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="flex h-7 items-center justify-center rounded-md border border-[var(--border-strong)] text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]"
      onClick={onClick}
    >
      {icon}
    </button>
  );
}

export function KeyframeButton({
  label,
  active,
  disabled = false,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const action = disabled ? "Move the playhead inside the layer duration" : active ? "Remove" : "Add";
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`${action} keyframe${disabled ? "" : ` for ${label}`}`}
      title={disabled ? `${action} to add a keyframe` : `${action} keyframe at current time`}
      data-active={active}
      className="flex h-7 w-6 shrink-0 items-center justify-center rounded text-[var(--fg-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-[var(--fg-muted)] data-[active=true]:text-[var(--accent)]"
      onClick={onClick}
    >
      <Diamond size={13} fill={active ? "currentColor" : "none"} strokeWidth={1.8} />
    </button>
  );
}
