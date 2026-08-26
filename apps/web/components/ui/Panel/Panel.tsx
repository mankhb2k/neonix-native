import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type PanelProps = {
  title?: string;
  actions?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
};

export function Panel({
  title,
  actions,
  className,
  bodyClassName,
  children,
}: PanelProps) {
  return (
    <section
      className={cn(
        "flex min-h-0 min-w-0 flex-col border border-[var(--border-subtle)] bg-[var(--bg-editor)] shadow-sm",
        className,
      )}
    >
      {title ? (
        <header className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-3.5 text-caption font-semibold tracking-[0.04em] text-[var(--fg-muted)] uppercase [background:color-mix(in_srgb,var(--bg-surface)_70%,var(--bg-editor))]">
          <span>{title}</span>
          {actions ? <div className="flex items-center gap-1">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn("min-h-0 flex-1 overflow-auto px-3.5 py-3", bodyClassName)}>
        {children}
      </div>
    </section>
  );
}
