/**
 * Interactive clip strip — select / move (incl. cross-lane) / edge trim.
 * Gesture controllers live in use-clip-move / use-clip-trim.
 * Move preview chrome is owned by timeline-preview-session; trim stays local.
 */

import { memo, useCallback, useState } from "react";
import {
  selectedClipIdsFrom,
  selectionClips,
  type EditorSelection,
  type TimelineClip,
  type TimelineCommand,
  type TimelineLane,
} from "@motionvideo/editor-core";
import { useMovePreviewForLane } from "../interactions/timeline-preview-session";
import type { BeginGesture } from "../interactions/use-pointer-session";
import { cn } from "../../../ui";
import type { ClipMovePreview } from "./clip-move-geometry";
import { useClipMove } from "./use-clip-move";
import { useClipTrim, type ClipTrimPreview } from "./use-clip-trim";

export type { ClipMovePreview };

type TrackKind = "main" | "overlay" | "audio";

function trackForLane(lane: TimelineLane | undefined): TrackKind {
  if (!lane) return "main";
  if (lane.kind === "audio") return "audio";
  if (lane.role === "base") return "main";
  return "overlay";
}

function clipClassName(trackKind: TrackKind, selected: boolean): string {
  const selectedCls = selected
    ? trackKind === "main"
      ? "z-10 border-2 border-white text-white shadow-md"
      : "z-10 border-2 border-white"
    : "";
  const base =
    trackKind === "main"
      ? "absolute top-0 bottom-0 my-auto h-[96%] overflow-hidden rounded px-2 text-left text-[11px] flex flex-col justify-center bg-[var(--timeline-clip-frame)] text-white/90"
      : trackKind === "audio"
        ? "absolute top-0 bottom-0 my-auto flex h-[96%] items-center overflow-hidden rounded bg-[var(--timeline-clip-audio)] px-2 text-[10px] font-medium text-white shadow-sm"
        : "absolute top-0 bottom-0 my-auto flex h-[96%] items-center overflow-hidden rounded bg-[#0F766E]/90 px-2 text-[10px] font-semibold text-white shadow-sm";
  return cn(base, selectedCls, "cursor-default");
}

type Props = {
  clips: TimelineClip[];
  /** Full document clips for multi-select move. */
  allClips?: TimelineClip[];
  /** Full lane list for group collision preview. */
  lanes: TimelineLane[];
  lane: TimelineLane;
  pixelsPerSecond: number;
  selection: EditorSelection;
  disabled?: boolean;
  beginGesture: BeginGesture;
  onSelect: (selection: EditorSelection) => void;
  onExecute: (command: TimelineCommand, label: string) => void;
};

/** Receives visibility-culled `clips` only — parent owns full document arrays. */
export const ClipStrip = memo(function ClipStrip({
  clips,
  allClips,
  lanes,
  lane,
  pixelsPerSecond,
  selection,
  disabled,
  beginGesture,
  onSelect,
  onExecute,
}: Props) {
  const pps = Math.max(pixelsPerSecond, 0.001);
  const selected = new Set(selectedClipIdsFrom(selection));
  const [trimPreview, setTrimPreview] = useState<ClipTrimPreview | null>(null);
  const activeMove = useMovePreviewForLane(lane.id);

  const onLocalPreview = useCallback((preview: ClipTrimPreview | null) => {
    setTrimPreview(preview);
  }, []);

  const { beginMove } = useClipMove({
    clips,
    allClips,
    lanes,
    lane,
    pixelsPerSecond,
    selection,
    disabled,
    beginGesture,
    onSelect,
    onExecute,
  });

  const { beginTrim } = useClipTrim({
    pixelsPerSecond,
    disabled,
    beginGesture,
    onSelect,
    onExecute,
    onLocalPreview,
  });

  const showMoveGhost =
    activeMove != null &&
    activeMove.laneId === lane.id &&
    !activeMove.isInsert;

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      data-testid="timeline-clip-strip-root"
    >
      {clips.map((clip) => {
        const isMovingSource =
          activeMove?.clipId === clip.id ||
          Boolean(activeMove?.members?.some((m) => m.clipId === clip.id));

        let start = clip.startTime;
        let duration = clip.duration;

        if (trimPreview?.clipId === clip.id) {
          start = trimPreview.startTime;
          duration = trimPreview.duration;
        }

        const left = start * pps;
        const width = Math.max(2, duration * pps);
        const isSelected = selected.has(clip.id);
        const trackKind = trackForLane(lane);

        return (
          <div
            key={clip.id}
            role="button"
            tabIndex={disabled ? -1 : 0}
            className={cn(
              clipClassName(trackKind, isSelected),
              isMovingSource && "invisible pointer-events-none",
            )}
            data-testid="timeline-clip-strip"
            data-clip-id={clip.id}
            data-start-time={String(start)}
            style={{ left, width }}
            title={clip.name || clip.id}
            onPointerDown={(e) => beginMove(e, clip)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(selectionClips([clip.id]));
              }
            }}
          >
            <span className="min-w-0 truncate font-semibold leading-tight pointer-events-none">
              {clip.name || clip.id}
            </span>
            {isSelected && !disabled && !isMovingSource ? (
              <>
                <span
                  className="absolute inset-y-0 left-0 z-[2] w-1.5 cursor-ew-resize"
                  onPointerDown={(e) => beginTrim(e, clip, "left")}
                />
                <span
                  className="absolute inset-y-0 right-0 z-[2] w-1.5 cursor-ew-resize"
                  onPointerDown={(e) => beginTrim(e, clip, "right")}
                />
              </>
            ) : null}
          </div>
        );
      })}
      {showMoveGhost && activeMove ? (
        <>
          <div
            className={cn(
              "pointer-events-none absolute top-0 bottom-0 z-[20] my-auto h-[96%] overflow-hidden rounded border border-[#4a4a52] bg-[#38383e] shadow-md will-change-[left]",
              !activeMove.valid && "border-[var(--danger)] bg-[var(--danger)]/40",
            )}
            aria-hidden
            data-testid="timeline-clip-move-ghost"
            style={{
              left: activeMove.startTime * pps,
              width: Math.max(24, activeMove.duration * pps),
            }}
          />
          {activeMove.members
            ?.filter((m) => m.laneId === lane.id)
            .map((m) => (
              <div
                key={`ghost-${m.clipId}`}
                className="pointer-events-none absolute top-0 bottom-0 z-[20] my-auto h-[96%] overflow-hidden rounded border border-[#4a4a52] bg-[#38383e] opacity-80 shadow-md"
                aria-hidden
                style={{
                  left: m.startTime * pps,
                  width: Math.max(24, m.duration * pps),
                }}
              />
            ))}
        </>
      ) : null}
    </div>
  );
});
