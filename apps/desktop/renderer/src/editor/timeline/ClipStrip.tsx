/**
 * Interactive clip strip — select / move (incl. cross-lane) / edge trim.
 */

import { useState } from "react";
import {
  MIN_CLIP_SLICE_SEC,
  selectedClipIdsFrom,
  selectionClips,
  type EditorSelection,
  type TimelineClip,
  type TimelineCommand,
  type TimelineLane,
} from "@motionvideo/editor-core";
import {
  autoScrollTimelineNearEdge,
  resolveDropGeometryAtPoint,
} from "./drop-host";
import type { BeginGesture } from "./interactions/use-pointer-session";
import type { PointerEvent as ReactPointerEvent } from "react";

const DRAG_THRESHOLD_PX = 3;

type TrackKind = "main" | "overlay" | "audio";

export type ClipMovePreview = {
  clipId: string;
  originLaneId: string;
  laneId: string;
  startTime: number;
  duration: number;
  valid: boolean;
};

function trackForLane(lane: TimelineLane | undefined): TrackKind {
  if (!lane) return "main";
  if (lane.kind === "audio") return "audio";
  if (lane.role === "base") return "main";
  return "overlay";
}

function clipAcceptsTrack(clip: TimelineClip, track: TrackKind): boolean {
  if (clip.kind === "audio") return track === "audio";
  return track === "main" || track === "overlay";
}

type Preview =
  | ClipMovePreview
  | {
      kind: "trim";
      clipId: string;
      startTime: number;
      duration: number;
    };

function isMovePreview(preview: Preview | null): preview is ClipMovePreview {
  return preview != null && !("kind" in preview);
}

type Props = {
  clips: TimelineClip[];
  lane: TimelineLane;
  pixelsPerSecond: number;
  laneHeight: number;
  selection: EditorSelection;
  disabled?: boolean;
  /** Shared cross-lane move ghost (owned by TimelineViewport). */
  movePreview?: ClipMovePreview | null;
  onMovePreviewChange?: (preview: ClipMovePreview | null) => void;
  beginGesture: BeginGesture;
  onSelect: (selection: EditorSelection) => void;
  onExecute: (command: TimelineCommand, label: string) => void;
};

export function ClipStrip({
  clips,
  lane,
  pixelsPerSecond,
  laneHeight,
  selection,
  disabled,
  movePreview = null,
  onMovePreviewChange,
  beginGesture,
  onSelect,
  onExecute,
}: Props) {
  const pps = Math.max(pixelsPerSecond, 0.001);
  const padY = 4;
  const height = Math.max(8, laneHeight - padY * 2);
  const selected = new Set(selectedClipIdsFrom(selection));
  const [localPreview, setLocalPreview] = useState<Preview | null>(null);

  const clearMovePreview = () => {
    setLocalPreview(null);
    onMovePreviewChange?.(null);
  };

  const beginMove = (
    event: ReactPointerEvent<HTMLElement>,
    clip: TimelineClip,
  ) => {
    if (disabled || event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();

    const additive = event.metaKey || event.ctrlKey;
    const already = selected.has(clip.id);
    if (additive) {
      const next = already
        ? [...selected].filter((id) => id !== clip.id)
        : [...selected, clip.id];
      onSelect(selectionClips(next));
    } else if (!already) {
      onSelect(selectionClips([clip.id]));
    }

    const originX = event.clientX;
    const originStart = clip.startTime;
    const originLaneId = lane.id;
    const originTrack = trackForLane(lane);
    const duration = clip.duration;

    type MoveState = {
      startTime: number;
      laneId: string;
      track: TrackKind;
      moved: boolean;
      valid: boolean;
    };
    beginGesture<MoveState, void>(
      {
        name: `move-${clip.id}`,
        onStart: () => ({
          startTime: originStart,
          laneId: originLaneId,
          track: originTrack,
          moved: false,
          valid: true,
        }),
        onUpdate: (pos, state) => {
          const dx = pos.x - originX;
          if (!state.moved && Math.abs(dx) < DRAG_THRESHOLD_PX) return state;
          autoScrollTimelineNearEdge(pos.x, pos.y);
          const nextStart = Math.max(0, originStart + dx / pps);
          let laneId = originLaneId;
          let track = originTrack;
          let valid = true;
          const geo = resolveDropGeometryAtPoint(pos.x, pos.y);
          if (geo) {
            if (clipAcceptsTrack(clip, geo.track)) {
              laneId = geo.laneId;
              track = geo.track;
              valid = true;
            } else {
              // Highlight incompatible target; commit keeps origin lane.
              laneId = geo.laneId;
              track = originTrack;
              valid = false;
            }
          }
          const preview: ClipMovePreview = {
            clipId: clip.id,
            originLaneId,
            laneId,
            startTime: nextStart,
            duration,
            valid,
          };
          setLocalPreview(preview);
          onMovePreviewChange?.(preview);
          return {
            startTime: nextStart,
            laneId: valid ? laneId : originLaneId,
            track: valid ? track : originTrack,
            moved: true,
            valid,
          };
        },
        onCommit: (state) => {
          clearMovePreview();
          if (!state.moved) return;
          onExecute(
            {
              type: "move-clip",
              clipId: clip.id,
              patch: {
                startTime: state.startTime,
                track: state.track,
                laneId: state.laneId,
              },
            },
            "Move clip",
          );
        },
        onCancel: () => clearMovePreview(),
      },
      { x: event.clientX, y: event.clientY },
      event.currentTarget,
      event.pointerId,
    );
  };

  const beginTrim = (
    event: ReactPointerEvent<HTMLElement>,
    clip: TimelineClip,
    edge: "left" | "right",
  ) => {
    if (disabled || event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    onSelect(selectionClips([clip.id]));

    const originX = event.clientX;
    const originStart = clip.startTime;
    const originDur = clip.duration;
    const originEnd = originStart + originDur;

    type TrimState = { startTime: number; duration: number };
    beginGesture<TrimState, void>(
      {
        name: `trim-${clip.id}-${edge}`,
        onStart: () => ({ startTime: originStart, duration: originDur }),
        onUpdate: (pos) => {
          const dx = (pos.x - originX) / pps;
          let startTime = originStart;
          let duration = originDur;
          if (edge === "right") {
            duration = Math.max(MIN_CLIP_SLICE_SEC, originDur + dx);
          } else {
            const nextStart = Math.min(
              originEnd - MIN_CLIP_SLICE_SEC,
              Math.max(0, originStart + dx),
            );
            startTime = nextStart;
            duration = originEnd - nextStart;
          }
          setLocalPreview({
            kind: "trim",
            clipId: clip.id,
            startTime,
            duration,
          });
          return { startTime, duration };
        },
        onCommit: (state) => {
          setLocalPreview(null);
          onExecute(
            {
              type: "clip/trim",
              clipId: clip.id,
              startTime: state.startTime,
              duration: state.duration,
            },
            "Trim clip",
          );
        },
        onCancel: () => setLocalPreview(null),
      },
      { x: event.clientX, y: event.clientY },
      event.currentTarget,
      event.pointerId,
    );
  };

  const activeMove =
    movePreview ??
    (isMovePreview(localPreview) ? localPreview : null);
  const trimPreview =
    localPreview && "kind" in localPreview && localPreview.kind === "trim"
      ? localPreview
      : null;

  const showTargetGhost =
    activeMove != null &&
    activeMove.laneId === lane.id &&
    activeMove.originLaneId !== lane.id;

  return (
    <div className="timeline-clip-strip" data-testid="timeline-clip-strip-root">
      {clips.map((clip) => {
        let start = clip.startTime;
        let duration = clip.duration;
        let isDragging = false;
        let dragInvalid = false;
        let crossLaneOrigin = false;

        if (activeMove?.clipId === clip.id) {
          isDragging = true;
          dragInvalid = !activeMove.valid;
          if (activeMove.laneId === lane.id) {
            start = activeMove.startTime;
            duration = activeMove.duration;
          } else if (activeMove.originLaneId === lane.id) {
            // Keep origin silhouette; ghost renders on the target lane.
            crossLaneOrigin = true;
          }
        } else if (trimPreview?.clipId === clip.id) {
          start = trimPreview.startTime;
          duration = trimPreview.duration;
        }

        const left = start * pps;
        const width = Math.max(2, duration * pps);
        const isSelected = selected.has(clip.id);
        const classNames = ["timeline-clip-strip__clip"];
        if (isSelected) classNames.push("timeline-clip-strip__clip--selected");
        if (isDragging) classNames.push("timeline-clip-strip__clip--dragging");
        if (dragInvalid) classNames.push("timeline-clip-strip__clip--invalid");
        if (crossLaneOrigin) {
          classNames.push("timeline-clip-strip__clip--cross-lane-origin");
        }

        return (
          <div
            key={clip.id}
            role="button"
            tabIndex={disabled ? -1 : 0}
            className={classNames.join(" ")}
            data-testid="timeline-clip-strip"
            data-clip-id={clip.id}
            style={{ left, width, top: padY, height }}
            title={clip.name || clip.id}
            onPointerDown={(e) => beginMove(e, clip)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(selectionClips([clip.id]));
              }
            }}
          >
            {isSelected && !disabled ? (
              <>
                <span
                  className="timeline-clip-strip__handle timeline-clip-strip__handle--left"
                  onPointerDown={(e) => beginTrim(e, clip, "left")}
                />
                <span
                  className="timeline-clip-strip__handle timeline-clip-strip__handle--right"
                  onPointerDown={(e) => beginTrim(e, clip, "right")}
                />
              </>
            ) : null}
          </div>
        );
      })}
      {showTargetGhost && activeMove ? (
        <div
          className={
            activeMove.valid
              ? "timeline-clip-strip__clip timeline-clip-strip__clip--ghost"
              : "timeline-clip-strip__clip timeline-clip-strip__clip--ghost timeline-clip-strip__clip--invalid"
          }
          aria-hidden
          data-testid="timeline-clip-move-ghost"
          style={{
            left: activeMove.startTime * pps,
            width: Math.max(2, activeMove.duration * pps),
            top: padY,
            height,
          }}
        />
      ) : null}
    </div>
  );
}
