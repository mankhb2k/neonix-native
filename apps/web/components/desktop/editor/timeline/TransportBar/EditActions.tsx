"use client";

import { Undo2, Redo2, Scissors, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { useEditorStore } from "@/lib/editor/editor-store";
import { selectedClipIdsFrom } from "@/lib/editor/model/editor-selection";
import { playheadSplitsClip } from "@/lib/editor/clip-clipboard";
import { usePlaybackClock } from "@/lib/editor/playback/playback-clock-store";
import { playbackFrameIndex } from "@/lib/editor/playback/time-frame";

/** Shared Lucide props for TransportBar edit icons. */
export const editActionIcon = {
  size: 16,
  strokeWidth: 2.25,
} as const;

/**
 * Timeline Edit actions: Undo · Redo · Split · Delete.
 */
export function EditActions() {
  const canUndo = useEditorStore((s) => s.canUndo);
  const canRedo = useEditorStore((s) => s.canRedo);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);

  const selectedClipIds = useEditorStore((s) =>
    selectedClipIdsFrom(s.selection),
  );
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
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        iconOnly
        disabled={!canUndo}
        aria-label="Hoàn tác"
        title="Hoàn tác (Ctrl+Z)"
        leftIcon={<Undo2 {...editActionIcon} />}
        onClick={undo}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        iconOnly
        disabled={!canRedo}
        aria-label="Làm lại"
        title="Làm lại (Ctrl+Y)"
        leftIcon={<Redo2 {...editActionIcon} />}
        onClick={redo}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        iconOnly
        disabled={!canSplit}
        aria-label="Tách clip"
        title="Tách tại playhead (Ctrl+B / S)"
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
        title="Xóa (Del / Backspace)"
        leftIcon={<Trash2 {...editActionIcon} />}
        onClick={() => deleteSelectedClips()}
      />
    </div>
  );
}
