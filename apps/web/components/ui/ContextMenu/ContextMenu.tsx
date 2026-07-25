"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface ContextMenuContextValue {
  open: boolean;
  position: { x: number; y: number };
  openAt: (x: number, y: number) => void;
  close: () => void;
}

const ContextMenuContext = React.createContext<ContextMenuContextValue | null>(
  null
);

function useContextMenu() {
  const ctx = React.useContext(ContextMenuContext);
  if (!ctx) {
    throw new Error("ContextMenu components must be used within <ContextMenu>");
  }
  return ctx;
}

export interface ContextMenuProps {
  children: React.ReactNode;
}

export function ContextMenu({ children }: ContextMenuProps) {
  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });

  return (
    <ContextMenuContext.Provider
      value={{
        open,
        position,
        openAt: (x, y) => {
          setPosition({ x, y });
          setOpen(true);
        },
        close: () => setOpen(false),
      }}
    >
      {children}
    </ContextMenuContext.Provider>
  );
}

export interface ContextMenuTriggerProps {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onOpen?: () => void;
}

export function ContextMenuTrigger({
  children,
  className,
  disabled = false,
  onOpen,
}: ContextMenuTriggerProps) {
  const { openAt } = useContextMenu();

  return (
    <div
      className={cn(className)}
      onContextMenu={(e) => {
        if (disabled) return;
        e.preventDefault();
        e.stopPropagation();
        onOpen?.();
        openAt(e.clientX, e.clientY);
      }}
    >
      {children}
    </div>
  );
}

export interface ContextMenuContentProps {
  children: React.ReactNode;
  className?: string;
}

export function ContextMenuContent({
  children,
  className,
}: ContextMenuContentProps) {
  const { open, position, close } = useContextMenu();
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [coords, setCoords] = React.useState(position);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close();
      }
    };
    const onScroll = () => close();

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("scroll", onScroll, true);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, close]);

  React.useLayoutEffect(() => {
    if (!open || !menuRef.current) return;

    const menu = menuRef.current;
    const { width, height } = menu.getBoundingClientRect();
    const padding = 8;
    const x = Math.min(position.x, window.innerWidth - width - padding);
    const y = Math.min(position.y, window.innerHeight - height - padding);

    setCoords({
      x: Math.max(padding, x),
      y: Math.max(padding, y),
    });
  }, [open, position, children]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      className={cn(
        "fixed z-[100] min-w-[180px] overflow-hidden rounded-[var(--radius)] border border-[var(--line-strong)] bg-[var(--bg-elevated)] p-1 shadow-lg",
        className
      )}
      style={{ left: coords.x, top: coords.y }}
    >
      {children}
    </div>,
    document.body
  );
}

export interface ContextMenuItemProps {
  children: React.ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  leftIcon?: React.ReactNode;
  shortcut?: string;
  className?: string;
}

export function ContextMenuItem({
  children,
  onSelect,
  disabled = false,
  destructive = false,
  leftIcon,
  shortcut,
  className,
}: ContextMenuItemProps) {
  const { close } = useContextMenu();

  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-ui font-regular outline-none select-none",
        "text-[var(--fg)]",
        disabled
          ? "cursor-not-allowed opacity-40"
          : "cursor-pointer hover:bg-[var(--bg-hover)]",
        destructive && "text-[#ef4444] hover:bg-[rgba(239,68,68,0.12)]",
        className
      )}
      onClick={() => {
        if (disabled) return;
        onSelect?.();
        close();
      }}
    >
      {leftIcon && (
        <span className="inline-flex size-4 shrink-0 items-center justify-center text-[var(--fg-muted)]">
          {leftIcon}
        </span>
      )}
      <span className="flex-1 truncate">{children}</span>
      {shortcut && (
        <span className="ml-4 text-caption text-[var(--fg-muted)]">{shortcut}</span>
      )}
    </button>
  );
}

export interface ContextMenuSeparatorProps {
  className?: string;
}

export function ContextMenuSeparator({ className }: ContextMenuSeparatorProps) {
  return (
    <div
      role="separator"
      className={cn("my-1 h-px bg-[var(--line-strong)]", className)}
    />
  );
}

export interface ContextMenuLabelProps {
  children: React.ReactNode;
  className?: string;
}

export function ContextMenuLabel({
  children,
  className,
}: ContextMenuLabelProps) {
  return (
    <div
      className={cn(
        "px-2 py-1.5 text-caption font-semibold uppercase tracking-wide text-[var(--fg-muted)]",
        className
      )}
    >
      {children}
    </div>
  );
}
