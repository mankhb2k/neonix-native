"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useCallback, useState, type RefObject , PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from "react";
import { useVisibleTimeline } from "@/hooks/editor/timeline/use-visible-timeline";
import { ClipStrip, type ClipStripVisualKind } from "../clips/ClipStrip";
import { useClipMove } from "../clips/use-clip-move";
import { useClipTrim, type ClipTrimPreview } from "../clips/use-clip-trim";
import { LANE_GAP_PX, TIMELINE_START_GUTTER_PX } from "../timeline-scale";
import { EmptyTimelineDash } from "./EmptyTimelineDash";
import type { LaneRow } from "../lanes/timeline-lane-rows";
import type { BeginGesture } from "@/hooks/editor/pointer/use-pointer-session-host";
import type { ClipMovePreview ,
  EditorSelection,
  TimelineClip,
  TimelineEdit,
  TimelineLane,
} from "@motionvideo/editor-core/timeline";

function visualKindForClip(clip: TimelineClip): ClipStripVisualKind {
  if (clip.kind === "audio") return "audio";
  if (clip.mediaType === "text") return "text";
  if (clip.mediaType === "shape") return "shape";
  return "media";
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
  onExecute: (command: TimelineEdit, label: string) => void;
  onToggleAudioTrackMuted?: (trackId: string) => void;
  onToggleVideoMuted?: (layerId: string) => void;
  scrollRef: RefObject<HTMLElement | null>;
  onMarqueePointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onClipSelectPointerDown?: (
    event: ReactPointerEvent<HTMLElement>,
    clip: TimelineClip,
  ) => void;
  onClipDoubleClick?: (clip: TimelineClip) => void;
  onClipContextMenu?: (event: ReactMouseEvent<HTMLElement>, clip: TimelineClip) => void;
  /** Group surface: one child per row (swap / insert, never pack). */
  exclusiveRows?: boolean;
  autoSnapping?: boolean;
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
  onExecute: (command: TimelineEdit, label: string) => void;
  onMovePreview: (preview: ClipMovePreview | null) => void;
  scrollRef: RefObject<HTMLElement | null>;
  onClipSelectPointerDown?: (
    event: ReactPointerEvent<HTMLElement>,
    clip: TimelineClip,
  ) => void;
  onClipDoubleClick?: (clip: TimelineClip) => void;
  onClipContextMenu?: (event: ReactMouseEvent<HTMLElement>, clip: TimelineClip) => void;
  exclusiveRows?: boolean;
  autoSnapping?: boolean;
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
  onClipContextMenu,
  exclusiveRows = false,
  autoSnapping = true,
  movingClipId,
  movePreview,
}: LaneRowClipsProps) {
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
    autoSnapping,
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
            visualKind={visualKindForClip(clip)}
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
            onContextMenu={onClipContextMenu}
          />
        );
      })}
      {movePreview &&
      !movePreview.isInsert &&
      movePreview.laneId === row.id ? (
        <div
          className="pointer-events-none absolute top-0 bottom-0 z-[20] my-auto h-[90%] overflow-hidden rounded border border-[#4a4a52] bg-[#38383e] shadow-md will-change-[left]"
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
            className="pointer-events-none absolute top-0 bottom-0 z-[20] my-auto h-[90%] overflow-hidden rounded border border-[#4a4a52] bg-[#38383e] opacity-80 shadow-md will-change-[left]"
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
  onToggleAudioTrackMuted,
  onToggleVideoMuted,
  scrollRef,
  onMarqueePointerDown,
  onClipSelectPointerDown,
  onClipDoubleClick,
  onClipContextMenu,
  exclusiveRows = false,
  autoSnapping = true,
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
      className="relative flex min-h-0"
      style={{
        width: contentWidth + TIMELINE_START_GUTTER_PX,
        boxSizing: "border-box",
      }}
    >
      <div
        className="relative shrink-0 bg-[var(--timeline-track-gutter,var(--bg-surface))]"
        style={{ width: TIMELINE_START_GUTTER_PX }}
        data-testid="timeline-track-gutter"
        aria-hidden={timelineEmpty ? true : undefined}
      >
        {topPadding > 0 ? <div style={{ height: topPadding }} aria-hidden /> : null}
        {!timelineEmpty
          ? rows.map((row, index) => {
              const laneClips = clipsForLane(row.id);
              const videoClip = laneClips.find(
                (clip) => clip.kind === "scene" && clip.mediaType === "video",
              );
              const hasEmbeddedAudio = videoClip?.kind === "scene" && videoClip.mediaType === "video" && videoClip.embeddedAudio;
              const videoLayerId = hasEmbeddedAudio && videoClip.kind === "scene" ? videoClip.sceneId : null;
              const videoMuted = videoClip?.kind === "scene" ? videoClip.muted ?? false : false;
              const audioTrackId = row.kind === "audio"
                ? row.id.replace(/^lane\.audio\./, "")
                : null;
              const audioToggle = row.kind === "audio" && audioTrackId && onToggleAudioTrackMuted
                ? {
                    muted: row.muted ?? false,
                    label: `${row.name} audio`,
                    onClick: () => onToggleAudioTrackMuted(audioTrackId),
                  }
                : videoLayerId && onToggleVideoMuted
                  ? {
                      muted: videoMuted,
                      label: `${videoClip?.name ?? "Video"} audio`,
                      onClick: () => onToggleVideoMuted(videoLayerId),
                    }
                  : null;
              return (
                <div
                  key={row.id}
                  className="flex justify-center"
                  style={{
                    height: row.height,
                    marginBottom: index === rows.length - 1 ? 0 : LANE_GAP_PX,
                  }}
                >
                  {audioToggle ? (
                    <div className="flex items-center gap-0.5">
                      <TrackAudioButton
                        muted={audioToggle.muted}
                        label={audioToggle.label}
                        onClick={audioToggle.onClick}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })
          : null}
        {bottomPadding > 0 ? <div style={{ height: bottomPadding }} aria-hidden /> : null}
      </div>

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
            <div key={row.id}>
              <div
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
                    onClipContextMenu={onClipContextMenu}
                    exclusiveRows={exclusiveRows}
                    autoSnapping={autoSnapping}
                    movingClipId={movePreview?.clipId}
                    movePreview={movePreview}
                />
              </div>
            </div>
          );
        })
      )}

      {bottomPadding > 0 ? (
        <div style={{ height: bottomPadding }} aria-hidden />
      ) : null}
      </div>
    </div>
  );
}

function TrackAudioButton({
  muted,
  label,
  onClick,
}: {
  muted: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="pointer-events-auto flex h-7 w-10 items-center justify-center self-center rounded-md bg-transparent text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]"
      aria-label={`${muted ? "Unmute" : "Mute"} ${label}`}
      aria-pressed={muted}
      data-marquee-ignore="true"
      data-testid={`timeline-audio-toggle-${label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onClick}
    >
      {muted ? <VolumeX size={14} strokeWidth={1.8} /> : <Volume2 size={14} strokeWidth={1.8} />}
    </button>
  );
}
