import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "../cn";
import { IconButton } from "../IconButton/IconButton";

export type DialogProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
};

export function Dialog({
  open,
  title,
  onClose,
  children,
  footer,
  className,
}: DialogProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;
  const titleId = React.useId();

  React.useEffect(() => {
    if (!open) return undefined;
    const close = () => onCloseRef.current();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => {
      panelRef.current?.focus();
    }, 0);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] grid place-items-center"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default border-0 bg-black/55"
        aria-label="Close dialog"
        onClick={() => onCloseRef.current()}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "relative z-10 w-[min(420px,calc(100vw-32px))] rounded-[10px] border border-[var(--border-strong)] bg-[var(--bg-panel)] text-[var(--fg)] outline-none",
          className,
        )}
      >
        <header className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-3.5 py-3">
          <h2 id={titleId} className="m-0 text-[13px] font-semibold">
            {title}
          </h2>
          <IconButton aria-label="Close" onClick={() => onCloseRef.current()}>
            ×
          </IconButton>
        </header>
        <div className="grid gap-3 p-3.5">{children}</div>
        {footer ? (
          <footer className="flex justify-end gap-2 border-t border-[var(--border-subtle)] px-3.5 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
