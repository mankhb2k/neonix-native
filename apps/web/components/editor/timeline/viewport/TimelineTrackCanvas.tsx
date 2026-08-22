"use client";

import { ClipStrip, type ClipStripVisualKind } from "../clips/ClipStrip";
import { EmptyTimelineDash } from "./EmptyTimelineDash";
import { useClipMove } from "../clips/use-clip-move";
import { useClipTrim, type ClipTrimPreview } from "../clips/use-clip-trim";
import type { LaneRow } from "../lanes/timeline-lane-rows";
import { LANE_GAP_PX } from "../timeline-scale";
import type { ClipMovePreview } from "@motionvideo/editor-core";
import type {
  EditorSelection,
  TimelineClip,
  TimelineCommand,
  TimelineLane,
} from "@motionvideo/editor-core";
import { useVisibleTimeline } from "@/hooks/editor/timeline/use-visible-timeline";
import type { BeginGesture } from "@/hooks/editor/pointer/use-pointer-session-host";
import { useCallback, useState, type RefObject } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

function visualKindForLane(row: LaneRow): ClipStripVisualKind {
  if (row.kind === "audio") return "audio";
  if (row.role === "overlay") return "overlay";
  return "main";
}

type Props = {
  rows: LaneRow[];
  /** Pre-grouped clips by lane (same ref to avoid per-scroll rebuild). */
  clipsByLane: Map<string, TimelineClip[]>;
  allClips: TimelineClip[];
  lanes: TimelineLane[];
  pixelsPerSecond: number;
  scrollLeft: number;
  viewWidth: number;
  contentWidth: number;
  topPadding: number;
  bottomPadding: number;
  selectedClipIds?: ReadonlySet<string>;
  previewSelectedIds?: ReadonlySet<string> | null;
  muteWindow?: { start: number; end: number } | null;
  duration: number;
  selection: EditorSelection;
  beginGesture: BeginGesture;
  onSelect: (selection: EditorSelection) => void;
  onExecute: (command: TimelineCommand, label: string) => void;
  scrollRef: RefObject<HTMLElement | null>;
  onMarqueePointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onClipSelectPointerDown?: (
    event: ReactPointerEvent<HTMLElement>,
    clip: TimelineClip,
  ) => void;
  onClipDoubleClick?: (clip: TimelineClip) => void;
  /** Group surface: one child per row (swap / insert, never pack). */
  exclusiveRows?: boolean;
  /** Replace lane rows with the dashed Main drop hint. */
  timelineEmpty?: boolean;
  movePreview?: ClipMovePreview | null;
  onMovePreview?: (preview: ClipMovePreview | null) => void;
};

// ── Per-lane sub-component (hooks must be at component level) ────────

type LaneRowClipsProps = {
  row: LaneRow;
  laneClips: TimelineClip[];
  allClips: TimelineClip[];
  lanes: TimelineLane[];
  pixelsPerSecond: number;
  selectedClipIds: ReadonlySet<string>;
  previewSelectedIds: ReadonlySet<string> | null;
  selection: EditorSelection;
  beginGesture: BeginGesture;
  onSelect: (selection: EditorSelection) => void;
  onExecute: (command: TimelineCommand, label: string) => void;
  onMovePreview: (preview: ClipMovePreview | null) => void;
  scrollRef: RefObject<HTMLElement | null>;
  onClipSelectPointerDown?: (
    event: ReactPointerEvent<HTMLElement>,
    clip: TimelineClip,
  ) => void;
  onClipDoubleClick?: (clip: TimelineClip) => void;
  exclusiveRows?: boolean;
  /** Clip currently being dragged — dim its source strip. */
  movingClipId?: string | null;
  movePreview?: ClipMovePreview | null;
};

function LaneRowClips({
  row,
  laneClips,
  allClips,
  lanes,
  pixelsPerSecond,
  selectedClipIds,
  previewSelectedIds,
  selection,
  beginGesture,
  onSelect,
  onExecute,
  onMovePreview,
  scrollRef,
  onClipSelectPointerDown,
  onClipDoubleClick,
  exclusiveRows = false,
  movingClipId,
  movePreview,
}: LaneRowClipsProps) {
  const visualKind = visualKindForLane(row);
  const [trimPreview, setTrimPreview] = useState<ClipTrimPreview | null>(null);
  const onLocalPreview = useCallback((preview: ClipTrimPreview | null) => {
    setTrimPreview(preview);
  }, []);

  const { beginMove } = useClipMove({
    clips: laneClips,
    allClips,
    lanes,
    lane: row,
    pixelsPerSecond,
    selection,
    beginGesture,
    onSelect,
    onExecute,
    onMovePreview,
    scrollRef,
    exclusiveRows,
  });

  const { beginTrim } = useClipTrim({
    pixelsPerSecond,
    beginGesture,
    onSelect,
    onExecute,
    onLocalPreview,
  });

  return (
    <>
      {laneClips.map((clip) => {
        const selected =
          Boolean(previewSelectedIds?.has(clip.id)) ||
          selectedClipIds.has(clip.id);

        let start = clip.startTime;
        let duration = clip.duration;
        if (trimPreview?.clipId === clip.id) {
          start = trimPreview.startTime;
          duration = trimPreview.duration;
        }

        return (
          <ClipStrip
            key={clip.id}
            clip={{ ...clip, startTime: start, duration }}
            visualKind={visualKind}
            pixelsPerSecond={pixelsPerSecond}
            selected={selected}
            showTrimHandles
            isMovingSource={movingClipId === clip.id}
            onBeginMove={beginMove}
            onBeginTrim={beginTrim}
            onSelectPointerDown={onClipSelectPointerDown}
            onDoubleClick={
              onClipDoubleClick
                ? (_event, target) => onClipDoubleClick(target)
                : undefined
            }
          />
        );
      })}
      {movePreview &&
      !movePreview.isInsert &&
      movePreview.laneId === row.id ? (
        <div
          className="pointer-events-none absolute top-0 bottom-0 z-[20] my-auto h-[88%] overflow-hidden rounded border border-[#4a4a52] bg-[#38383e] shadow-md will-change-[left]"
          aria-hidden
          data-testid="timeline-clip-move-ghost"
          style={{
            left: movePreview.startTime * pixelsPerSecond,
            width: Math.max(24, movePreview.duration * pixelsPerSecond),
          }}
        />
      ) : null}
      {movePreview &&
      !movePreview.isInsert &&
      movePreview.members
        ?.filter((member) => member.laneId === row.id)
        .map((member) => (
          <div
            key={`ghost-${member.clipId}`}
            className="pointer-events-none absolute top-0 bottom-0 z-[20] my-auto h-[88%] overflow-hidden rounded border border-[#4a4a52] bg-[#38383e] opacity-80 shadow-md will-change-[left]"
            aria-hidden
            style={{
              left: member.startTime * pixelsPerSecond,
              width: Math.max(24, member.duration * pixelsPerSecond),
            }}
          />
        ))}
    </>
  );
}

// ── Main canvas ──────────────────────────────────────────────────────

export function TimelineTrackCanvas({
  rows,
  clipsByLane,
  allClips,
  lanes,
  pixelsPerSecond,
  scrollLeft,
  viewWidth,
  contentWidth,
  topPadding,
  bottomPadding,
  selectedClipIds,
  previewSelectedIds,
  muteWindow,
  duration,
  selection,
  beginGesture,
  onSelect,
  onExecute,
  scrollRef,
  onMarqueePointerDown,
  onClipSelectPointerDown,
  onClipDoubleClick,
  exclusiveRows = false,
  timelineEmpty = false,
  movePreview = null,
  onMovePreview,
}: Props) {
  const { clipsForLane } = useVisibleTimeline({
    scrollLeft,
    viewWidth,
    pixelsPerSecond,
    clipsByLane,
  });

  const effectiveSelectedIds: ReadonlySet<string> =
    selectedClipIds ?? new Set();
  const effectivePreviewIds: ReadonlySet<string> | null =
    previewSelectedIds ?? null;
  const setMovePreview = onMovePreview ?? (() => undefined);
  return (
    <div
      className="relative min-h-0"
      style={{ width: contentWidth }}
      data-testid="timeline-track-canvas"
      onPointerDown={(event) => {
        if (timelineEmpty) return;
        if (!onMarqueePointerDown || event.button !== 0) return;
        const target = event.target as HTMLElement;
        if (target.closest("[data-clip-id]")) return;
        if (target.closest("button")) return;
        if (target.closest("[data-marquee-ignore]")) return;
        if (target.closest("[data-testid='timeline-playhead']")) return;
        onMarqueePointerDown(event);
      }}
    >
      {topPadding > 0 ? (
        <div style={{ height: topPadding }} aria-hidden />
      ) : null}

      {muteWindow ? (
        <>
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-[1] bg-[var(--fg-primary)]/6"
            style={{
              left: 0,
              width: Math.max(0, muteWindow.start) * pixelsPerSecond,
            }}
          />
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-[1] bg-[var(--fg-primary)]/6"
            style={{
              left: muteWindow.end * pixelsPerSecond,
              width: Math.max(0, duration - muteWindow.end) * pixelsPerSecond,
            }}
          />
        </>
      ) : null}

      {timelineEmpty ? (
        <EmptyTimelineDash
          width={contentWidth}
          laneId={
            rows.find((r) => r.role === "base")?.id ??
            rows[0]?.id ??
            "lane.main"
          }
        />
      ) : (
        rows.map((row, index) => {
          const laneClips = clipsForLane(row.id);
          const isLast = index === rows.length - 1;
          return (
            <div
              key={row.id}
              className="relative bg-[var(--timeline-track-lane)]"
              style={{
                height: row.height,
                marginBottom: isLast ? 0 : LANE_GAP_PX,
              }}
              data-track-lane="true"
              data-lane-id={row.id}
              data-lane-order={row.order}
              data-track-role={
                row.kind === "audio"
                  ? "audio"
                  : row.role === "base"
                    ? "base"
                    : "overlay"
              }
              data-track-type={
                row.kind === "audio"
                  ? "audio"
                  : row.role === "base"
                    ? "main"
                    : "overlay"
              }
            >
              <LaneRowClips
                row={row}
                laneClips={laneClips}
                allClips={allClips}
                lanes={lanes}
                pixelsPerSecond={pixelsPerSecond}
                selectedClipIds={effectiveSelectedIds}
                previewSelectedIds={effectivePreviewIds}
                selection={selection}
                beginGesture={beginGesture}
                onSelect={onSelect}
                onExecute={onExecute}
                onMovePreview={setMovePreview}
                scrollRef={scrollRef}
                onClipSelectPointerDown={onClipSelectPointerDown}
                onClipDoubleClick={onClipDoubleClick}
                exclusiveRows={exclusiveRows}
                movingClipId={movePreview?.clipId}
                movePreview={movePreview}
              />
            </div>
          );
        })
      )}

      {bottomPadding > 0 ? (
        <div style={{ height: bottomPadding }} aria-hidden />
      ) : null}
    </div>
  );
}
