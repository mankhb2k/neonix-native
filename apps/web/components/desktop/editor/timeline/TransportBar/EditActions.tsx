"use client";

import { Scissors, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { useEditorStore } from "@/lib/editor/editor-store";
import { playheadSplitsClip } from "@/lib/editor/clip-clipboard";
import { usePlaybackClock } from "@/lib/editor/playback/playback-clock-store";
import { playbackFrameIndex } from "@/lib/editor/playback/time-frame";

/** Shared Lucide props for TransportBar edit icons. */
export const editActionIcon = {
  size: 16,
  strokeWidth: 2.25,
} as const;

/**
 * Edit actions: Split · Delete.
 * Undo/Redo ẩn đến khi có command history thật (UX-01).
 */
export function EditActions() {
  const selectedClipIds = useEditorStore((s) => s.selectedClipIds);
  const timelineClips = useEditorStore((s) => s.timelineClips);
  const fps = useEditorStore((s) => s.project?.metadata.fps ?? 30);
  const splitSelectedClipsAt = useEditorStore((s) => s.splitSelectedClipsAt);
  const deleteSelectedClips = useEditorStore((s) => s.deleteSelectedClips);
  // Subscribe theo frame index — tránh re-render mỗi tick floating-point (PERF-05).
  const displayFrame = usePlaybackClock((s) =>
    playbackFrameIndex(s.currentTime, fps),
  );
  const currentTime = displayFrame / Math.max(1, fps);

  const hasSelection = selectedClipIds.length > 0;
  const canSplit = selectedClipIds.some((id) => {
    const clip = timelineClips.find((c) => c.id === id);
    return clip ? playheadSplitsClip(clip, currentTime) : false;
  });

  return (
    <div className="flex items-center gap-2.5">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        iconOnly
        disabled={!canSplit}
        aria-label="Tách clip"
        title="Tách tại playhead (Ctrl+B)"
        leftIcon={<Scissors {...editActionIcon} />}
        onClick={() =>
          splitSelectedClipsAt(usePlaybackClock.getState().currentTime)
        }
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        iconOnly
        disabled={!hasSelection}
        aria-label="Xóa"
        title="Xóa (Del)"
        leftIcon={<Trash2 {...editActionIcon} />}
        onClick={() => deleteSelectedClips()}
      />
    </div>
  );
}
