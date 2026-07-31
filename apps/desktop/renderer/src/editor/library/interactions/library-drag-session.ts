/**
 * Pointer drag session for library → timeline. UI-only until pointer-up commits.
 */

import type { LibraryItem } from "../model/library-item";

export type LibraryDragSession = {
  item: LibraryItem;
  clientX: number;
  clientY: number;
  active: boolean;
};

type Listener = (session: LibraryDragSession | null) => void;

let current: LibraryDragSession | null = null;
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) listener(current);
}

export function subscribeLibraryDrag(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}

export function getLibraryDragSession(): LibraryDragSession | null {
  return current;
}

export function beginLibraryDrag(
  item: LibraryItem,
  clientX: number,
  clientY: number,
): void {
  current = { item, clientX, clientY, active: true };
  emit();
}

export function moveLibraryDrag(clientX: number, clientY: number): void {
  if (!current?.active) return;
  current = { ...current, clientX, clientY };
  emit();
}

export function endLibraryDrag(): LibraryItem | null {
  const item = current?.active ? current.item : null;
  current = null;
  emit();
  return item;
}

export function cancelLibraryDrag(): void {
  current = null;
  emit();
}
