/**
 * High-frequency timeline chrome (library drop / clip-move / marquee).
 * Module store so TimelineViewport does not re-render every pointer frame.
 *
 * Invariant: single active timeline editor. Call `clearPreviewSession()` on
 * viewport unmount and when switching projects so a stale dropGhost/marquee
 * cannot leak into the next mount.
 */

import { useCallback, useSyncExternalStore } from "react";
import type { LibraryPayload } from "../../library/model/library-payload";
import type {
  ClipMovePreview,
  MarqueeRect,
} from "@motionvideo/editor-interactions";
import {
  resolveDropGeometryAtPoint,
  type LibraryDropPreview,
} from "../drop/library-drop";

export type TimelinePreviewSession = {
  dropGhost: LibraryDropPreview | null;
  clipMovePreview: ClipMovePreview | null;
  marquee: MarqueeRect | null;
  /** Live marquee highlight ids; null = no active marquee preview. */
  marqueeSelectionIds: string[] | null;
};

const EMPTY: TimelinePreviewSession = {
  dropGhost: null,
  clipMovePreview: null,
  marquee: null,
  marqueeSelectionIds: null,
};

let current: TimelinePreviewSession = EMPTY;
const listeners = new Set<() => void>();

/** Stable empty snapshot for lane selectors that miss. */
const NULL_MOVE: ClipMovePreview | null = null;
const NULL_MARQUEE_IDS: string[] | null = null;

let cachedPinKey = "";
let dropGhostRaf: number | null = null;
let pendingDropSample:
  | { kind: "clear" }
  | {
      kind: "point";
      clientX: number;
      clientY: number;
      item: LibraryPayload | null;
    }
  | undefined;

function emit(): void {
  for (const listener of listeners) listener();
}

function marqueeIdsEqual(
  a: string[] | null,
  b: string[] | null,
): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function setSession(next: TimelinePreviewSession): void {
  if (
    next.dropGhost === current.dropGhost &&
    next.clipMovePreview === current.clipMovePreview &&
    next.marquee === current.marquee &&
    marqueeIdsEqual(next.marqueeSelectionIds, current.marqueeSelectionIds)
  ) {
    return;
  }
  current = next;
  cachedPinKey = pinKeyFromPreview(next.clipMovePreview);
  emit();
}

export function getPreviewSession(): TimelinePreviewSession {
  return current;
}

export function subscribePreview(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setDropGhost(dropGhost: LibraryDropPreview | null): void {
  if (current.dropGhost === dropGhost) return;
  setSession({ ...current, dropGhost });
}

export function setClipMovePreview(clipMovePreview: ClipMovePreview | null): void {
  if (current.clipMovePreview === clipMovePreview) return;
  setSession({ ...current, clipMovePreview });
}

export function setMarquee(marquee: MarqueeRect | null): void {
  if (marquee == null) {
    if (current.marquee == null && current.marqueeSelectionIds == null) return;
    setSession({ ...current, marquee: null, marqueeSelectionIds: null });
    return;
  }
  if (current.marquee === marquee) return;
  setSession({ ...current, marquee });
}

export function setMarqueeSelectionIds(ids: string[] | null): void {
  if (marqueeIdsEqual(ids, current.marqueeSelectionIds)) return;
  setSession({ ...current, marqueeSelectionIds: ids });
}

export function clearPreviewSession(): void {
  cancelDropGhostRaf();
  pendingDropSample = undefined;
  if (
    current.dropGhost == null &&
    current.clipMovePreview == null &&
    current.marquee == null &&
    current.marqueeSelectionIds == null
  ) {
    return;
  }
  setSession(EMPTY);
}

export function pinKeyFromPreview(
  preview: ClipMovePreview | null | undefined,
): string {
  if (!preview) return "";
  const members = (preview.members ?? [])
    .map((m) => m.laneId)
    .sort()
    .join(",");
  return `${preview.originLaneId}|${preview.laneId}|${members}`;
}

/**
 * Inverse of pinKeyFromPreview. Returns all laneIds encoded in the key.
 * Empty string → [].
 */
export function parsePinKey(key: string): string[] {
  if (!key) return [];
  const [origin, lane, members] = key.split("|");
  const ids: string[] = [];
  if (origin) ids.push(origin);
  if (lane) ids.push(lane);
  if (members) {
    for (const id of members.split(",")) {
      if (id) ids.push(id);
    }
  }
  return ids;
}

export function getMovePinKey(): string {
  return cachedPinKey;
}

export function movePreviewTouchesLane(
  preview: ClipMovePreview | null,
  laneId: string,
): boolean {
  if (!preview) return false;
  if (preview.laneId === laneId || preview.originLaneId === laneId) return true;
  return Boolean(preview.members?.some((m) => m.laneId === laneId));
}

export function getMovePreviewForLane(
  laneId: string,
): ClipMovePreview | null {
  const preview = current.clipMovePreview;
  return movePreviewTouchesLane(preview, laneId) ? preview : NULL_MOVE;
}

function cancelDropGhostRaf(): void {
  if (dropGhostRaf != null) {
    cancelAnimationFrame(dropGhostRaf);
    dropGhostRaf = null;
  }
}

function flushDropGhostSample(): void {
  dropGhostRaf = null;
  const sample = pendingDropSample;
  pendingDropSample = undefined;
  if (sample === undefined) return;
  if (sample.kind === "clear") {
    setDropGhost(null);
    return;
  }
  setDropGhost(
    resolveDropGeometryAtPoint(sample.clientX, sample.clientY, sample.item),
  );
}

/** Coalesce library pointer samples; resolve geometry once per frame. */
export function scheduleDropGhostSample(
  sample:
    | { kind: "clear" }
    | {
        kind: "point";
        clientX: number;
        clientY: number;
        item: LibraryPayload | null;
      },
): void {
  pendingDropSample = sample;
  if (dropGhostRaf == null) {
    dropGhostRaf = requestAnimationFrame(flushDropGhostSample);
  }
}

export function resetDropGhostScheduler(): void {
  cancelDropGhostRaf();
  pendingDropSample = undefined;
}

/** Full chrome snapshot for TimelineOverlays. */
export function usePreviewSession(): TimelinePreviewSession {
  return useSyncExternalStore(
    subscribePreview,
    getPreviewSession,
    getPreviewSession,
  );
}

/** Pin-lane key only — TimelineViewport remount window. */
export function useMovePinKey(): string {
  return useSyncExternalStore(
    subscribePreview,
    getMovePinKey,
    getMovePinKey,
  );
}

/** Lane-scoped move preview; unrelated strips keep a stable null. */
export function useMovePreviewForLane(
  laneId: string,
): ClipMovePreview | null {
  const getSnapshot = useCallback(
    () => getMovePreviewForLane(laneId),
    [laneId],
  );
  return useSyncExternalStore(subscribePreview, getSnapshot, getSnapshot);
}

function getMarqueeSelectionIds(): string[] | null {
  return current.marqueeSelectionIds ?? NULL_MARQUEE_IDS;
}

/** Live marquee highlight ids; null when marquee preview is inactive. */
export function useMarqueeSelectionIds(): string[] | null {
  return useSyncExternalStore(
    subscribePreview,
    getMarqueeSelectionIds,
    () => null,
  );
}

function getDropGhostActive(): boolean {
  return current.dropGhost != null;
}

export function useDropGhostActive(): boolean {
  return useSyncExternalStore(
    subscribePreview,
    getDropGhostActive,
    () => false,
  );
}
