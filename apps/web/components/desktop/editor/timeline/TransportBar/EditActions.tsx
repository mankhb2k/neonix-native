"use client";

import { Redo2, Scissors, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui";
import { useEditorStore } from "@/lib/editor/editor-store";
import { playheadSplitsClip } from "@/lib/editor/clip-clipboard";
import { usePlaybackClock } from "@/lib/editor/playback/playback-clock-store";

/** Shared Lucide props for TransportBar edit icons. */
export const editActionIcon = {
  size: 16,
  strokeWidth: 2.25,
} as const;

/**
 * Edit actions left of the zoom cluster: Undo · Redo · Split · Delete.
 * Undo/Redo stay placeholders until history lands.
 */
export function EditActions() {
  const selectedClipIds = useEditorStore((s) => s.selectedClipIds);
  const timelineClips = useEditorStore((s) => s.timelineClips);
  const splitSelectedClipsAt = useEditorStore((s) => s.splitSelectedClipsAt);
  const deleteSelectedClips = useEditorStore((s) => s.deleteSelectedClips);
  const currentTime = usePlaybackClock((s) => s.currentTime);

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
        disabled
        aria-label="Hoàn tác"
        title="Hoàn tác"
        leftIcon={<Undo2 {...editActionIcon} />}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        iconOnly
        disabled
        aria-label="Làm lại"
        title="Làm lại"
        leftIcon={<Redo2 {...editActionIcon} />}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        iconOnly
        disabled={!canSplit}
        aria-label="Tách clip"
        title="Tách tại playhead (Ctrl+B)"
        leftIcon={<Scissors {...editActionIcon} />}
        onClick={() => splitSelectedClipsAt(currentTime)}
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
