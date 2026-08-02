import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "../cn";

type ContextMenuContextValue = {
  open: boolean;
  position: { x: number; y: number };
  openAt: (x: number, y: number) => void;
  close: () => void;
};

const ContextMenuContext = React.createContext<ContextMenuContextValue | null>(
  null,
);

const openMenus = new Set<() => void>();

function useContextMenu() {
  const ctx = React.useContext(ContextMenuContext);
  if (!ctx) {
    throw new Error("ContextMenu components must be used within <ContextMenu>");
  }
  return ctx;
}

export function ContextMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const close = React.useCallback(() => setOpen(false), []);

  React.useEffect(() => {
    openMenus.add(close);
    return () => {
      openMenus.delete(close);
    };
  }, [close]);

  const openAt = React.useCallback(
    (x: number, y: number) => {
      for (const other of openMenus) {
        if (other !== close) other();
      }
      setPosition({ x, y });
      setOpen(true);
    },
    [close],
  );

  return (
    <ContextMenuContext.Provider value={{ open, position, openAt, close }}>
      {children}
    </ContextMenuContext.Provider>
  );
}

export function ContextMenuTrigger({
  children,
  className,
  disabled,
}: {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const { openAt } = useContextMenu();
  return (
    <div
      className={cn(className)}
      onContextMenu={(event) => {
        if (disabled) return;
        event.preventDefault();
        openAt(event.clientX, event.clientY);
      }}
    >
      {children}
    </div>
  );
}

export function ContextMenuContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { open, position, close } = useContextMenu();

  React.useEffect(() => {
    if (!open) return undefined;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") close();
    };
    const onPointer = () => close();
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open, close]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="menu"
      className={cn(
        "fixed z-[100] min-w-[160px] rounded-md border border-[var(--line-strong)] bg-[var(--bg-elevated)] py-1 shadow-lg text-[12px] text-[var(--fg)]",
        className,
      )}
      style={{ left: position.x, top: position.y }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  );
}

export function ContextMenuItem({
  children,
  className,
  disabled,
  onSelect,
}: {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onSelect?: () => void;
}) {
  const { close } = useContextMenu();
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      className={cn(
        "flex w-full items-center px-3 py-1.5 text-left hover:bg-[var(--bg-hover)] disabled:opacity-40 disabled:cursor-not-allowed",
        className,
      )}
      onClick={() => {
        if (disabled) return;
        onSelect?.();
        close();
      }}
    >
      {children}
    </button>
  );
}
