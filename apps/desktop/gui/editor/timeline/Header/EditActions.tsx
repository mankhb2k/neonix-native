import { Redo2, Scissors, Trash2, Undo2 } from "lucide-react";
import {
  playheadSplitsClip,
  selectedClipIdsFrom,
  type EditorSelection,
  type TimelineClip,
} from "@motionvideo/editor-core";
import { Button } from "../../../ui";
import { usePlaybackClock } from "../../playback/playback-clock-store";
import { playbackFrameIndex } from "../../playback/time-frame";

/** Shared Lucide props for TransportBar edit icons. */
export const editActionIcon = {
  size: 16,
  strokeWidth: 2.25,
} as const;

type Props = {
  clips: TimelineClip[];
  selection: EditorSelection;
  fps: number;
  disabled?: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSplit: (time: number) => void;
  onDelete: () => void;
};

/**
 * Timeline Edit actions: Undo · Redo · Split · Delete.
 */
export function EditActions({
  clips,
  selection,
  fps,
  disabled,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSplit,
  onDelete,
}: Props) {
  const safeFps = Math.max(1, Math.round(fps));
  const displayFrame = usePlaybackClock((s) =>
    playbackFrameIndex(s.currentTime, safeFps),
  );
  const currentTime = usePlaybackClock((s) => s.currentTime);
  const displayTime = displayFrame / safeFps;

  const selectedClipIds = selectedClipIdsFrom(selection);
  const hasSelection = selectedClipIds.length > 0;
  const canSplit = selectedClipIds.some((id) => {
    const clip = clips.find((c) => c.id === id);
    return clip ? playheadSplitsClip(clip, displayTime) : false;
  });

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        iconOnly
        disabled={disabled || !canUndo}
        aria-label="Hoàn tác"
        title="Hoàn tác (Ctrl+Z)"
        leftIcon={<Undo2 {...editActionIcon} />}
        onClick={onUndo}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        iconOnly
        disabled={disabled || !canRedo}
        aria-label="Làm lại"
        title="Làm lại (Ctrl+Y)"
        leftIcon={<Redo2 {...editActionIcon} />}
        onClick={onRedo}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        iconOnly
        disabled={disabled || !canSplit}
        aria-label="Tách clip"
        title="Tách tại playhead (Ctrl+B / S)"
        leftIcon={<Scissors {...editActionIcon} />}
        onClick={() => onSplit(currentTime)}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        iconOnly
        disabled={disabled || !hasSelection}
        aria-label="Xóa"
        title="Xóa (Del / Backspace)"
        leftIcon={<Trash2 {...editActionIcon} />}
        onClick={onDelete}
      />
    </div>
  );
}
