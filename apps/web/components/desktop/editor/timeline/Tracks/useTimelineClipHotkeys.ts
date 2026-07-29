"use client";

import { useEffect } from "react";
import { useEditorStore } from "@/lib/editor/editor-store";
import { playheadSplitsClip } from "@/lib/editor/clip-clipboard";
import { usePlaybackClock } from "@/lib/editor/playback/playback-clock-store";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

/** Global hotkeys for timeline clip clipboard / split / duplicate. */
export function useTimelineClipHotkeys(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return;
      const mod = event.ctrlKey || event.metaKey;
      const store = useEditorStore.getState();
      const playhead = usePlaybackClock.getState().currentTime;

      if (mod && event.key.toLowerCase() === "c") {
        if (store.selectedClipIds.length === 0) return;
        event.preventDefault();
        store.copySelectedClips();
        return;
      }
      if (mod && event.key.toLowerCase() === "x") {
        if (store.selectedClipIds.length === 0) return;
        event.preventDefault();
        store.cutSelectedClips();
        return;
      }
      if (mod && event.key.toLowerCase() === "v") {
        if (!store.timelineClipboard?.length) return;
        event.preventDefault();
        store.pasteClips(playhead);
        return;
      }
      if (mod && event.key.toLowerCase() === "d") {
        if (store.selectedClipIds.length === 0) return;
        event.preventDefault();
        store.duplicateSelectedClips();
        return;
      }
      if (
        mod &&
        (event.key.toLowerCase() === "b" ||
          (event.shiftKey && event.key.toLowerCase() === "s"))
      ) {
        const canSplit = store.selectedClipIds.some((id) => {
          const clip = store.timelineClips.find((c) => c.id === id);
          return clip ? playheadSplitsClip(clip, playhead) : false;
        });
        if (!canSplit) return;
        event.preventDefault();
        store.splitSelectedClipsAt(playhead);
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        if (store.selectedClipIds.length === 0) return;
        event.preventDefault();
        store.deleteSelectedClips();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
