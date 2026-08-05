import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

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
    <section className={cn("editor-panel", className)}>
      {title ? (
        <header className="editor-panel-header">
          <span>{title}</span>
          {actions ? <div className="flex items-center gap-1">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn("editor-panel-body", bodyClassName)}>{children}</div>
    </section>
  );
}
