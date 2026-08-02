/**
 * Interactive clip strip — select / move (incl. cross-lane) / edge trim.
 */

import { memo, useState } from "react";
import {
  MIN_CLIP_SLICE_SEC,
  createClipGroupMovePlan,
  selectedClipIdsFrom,
  selectionClips,
  type EditorSelection,
  type TimelineClip,
  type TimelineCommand,
  type TimelineLane,
} from "@motionvideo/editor-core";
import {
  collectClipEdgeSnapPoints,
  resolveClipMoveDrag,
  type ClipMoveDropTarget,
  type ClipMovePreview,
} from "../clips/clip-move-geometry";
import {
  autoScrollTimelineNearEdge,
  getTimelineDropHost,
  pointerContentXAtPoint,
} from "./drop-host";
import {
  resolveClipMoveDropAtY,
  type TimelineDropTarget,
} from "./lane-drop-target";
import type { BeginGesture } from "../interactions/use-pointer-session";
import { useTimelineInteractionPrefs } from "../timeline-interaction-prefs";
import { cn } from "../../../ui";
import type { PointerEvent as ReactPointerEvent } from "react";

export type { ClipMovePreview };

const DRAG_THRESHOLD_PX = 4; // web MOVE_THRESHOLD_PX
/** CapCut-ish magnet distance for live edge snap while moving. */
const SNAP_THRESHOLD_PX = 8;

type TrackKind = "main" | "overlay" | "audio";

function trackForLane(lane: TimelineLane | undefined): TrackKind {
  if (!lane) return "main";
  if (lane.kind === "audio") return "audio";
  if (lane.role === "base") return "main";
  return "overlay";
}

/** Map web TimelineDropTarget → clip-move drop (resolve main laneId). */
function dropTargetFromPolicy(
  target: TimelineDropTarget,
  lanes: TimelineLane[],
  originLaneId: string,
  scrollEl: HTMLElement,
): ClipMoveDropTarget {
  const contentTop = target.indicatorTop + scrollEl.scrollTop;
  const track: TrackKind =
    target.family === "audio"
      ? "audio"
      : target.overBaseBody
        ? "main"
        : "overlay";

  if (target.isInsert) {
    return {
      laneId: originLaneId,
      track: track === "main" ? "overlay" : track,
      insertNewLane: true,
      insertOrder: target.insertOrder,
      contentTop,
    };
  }

  if (target.laneId) {
    return { laneId: target.laneId, track, contentTop };
  }

  if (target.overBaseBody || track === "main") {
    const base = lanes.find((l) => l.kind === "visual" && l.role === "base");
    if (base) return { laneId: base.id, track: "main", contentTop };
  }

  return { laneId: originLaneId, track, contentTop };
}

function clipClassName(
  trackKind: TrackKind,
  selected: boolean,
): string {
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
  return cn(base, selectedCls, "cursor-grab");
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
  /** Full document clips for multi-select move. */
  allClips?: TimelineClip[];
  /** Full lane list for group collision preview. */
  lanes: TimelineLane[];
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

/** Receives visibility-culled `clips` only — parent owns full document arrays. */
export const ClipStrip = memo(function ClipStrip({
  clips,
  allClips,
  lanes,
  lane,
  pixelsPerSecond,
  laneHeight: _laneHeight,
  selection,
  disabled,
  movePreview = null,
  onMovePreviewChange,
  beginGesture,
  onSelect,
  onExecute,
}: Props) {
  const pps = Math.max(pixelsPerSecond, 0.001);
  const autoSnapping = useTimelineInteractionPrefs((s) => s.autoSnapping);
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
    let nextSelected = [...selected];
    if (additive) {
      nextSelected = already
        ? nextSelected.filter((id) => id !== clip.id)
        : [...nextSelected, clip.id];
      onSelect(selectionClips(nextSelected));
    } else if (!already) {
      nextSelected = [clip.id];
      onSelect(selectionClips(nextSelected));
    }
    if (!nextSelected.includes(clip.id)) {
      nextSelected = [clip.id];
    }
    /** Freeze group at gesture start (primary first). */
    const groupIds = [
      clip.id,
      ...nextSelected.filter((id) => id !== clip.id),
    ];
    const isGroup = groupIds.length > 1;

    const originX = event.clientX;
    const originY = event.clientY;
    const originStart = clip.startTime;
    const originLaneId = lane.id;
    const originTrack = trackForLane(lane);
    const duration = clip.duration;
    const originContentX = pointerContentXAtPoint(originX) ?? 0;
    const grabOffsetSec = originContentX / pps - originStart;
    const catalog = allClips ?? clips;
    const catalogById = new Map(catalog.map((c) => [c.id, c]));
    const minStartInGroup = Math.min(
      ...groupIds.map(
        (id) => catalogById.get(id)?.startTime ?? originStart,
      ),
    );
    const groupPlan = isGroup
      ? createClipGroupMovePlan({ clips: catalog, lanes }, groupIds)
      : null;
    const excludeSnapIds = new Set(groupIds);
    const snapPoints = autoSnapping
      ? collectClipEdgeSnapPoints(catalog, excludeSnapIds)
      : [];
    const snapThresholdSec = SNAP_THRESHOLD_PX / pps;

    /** Web hysteresis — local to this gesture (not shared with library drop). */
    let wasInsert = false;
    const family: "visual" | "audio" =
      clip.kind === "audio" ? "audio" : "visual";

    type MoveState = {
      startTime: number;
      laneId: string;
      track: TrackKind;
      moved: boolean;
      valid: boolean;
      groupDelta: number;
      insertNewLane: boolean;
      insertOrder: number | null;
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
          groupDelta: 0,
          insertNewLane: false,
          insertOrder: null,
        }),
        onUpdate: (pos, state) => {
          const dx = pos.x - originX;
          const dy = pos.y - originY;
          if (
            !state.moved &&
            dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX
          ) {
            return state;
          }
          autoScrollTimelineNearEdge(pos.x, pos.y);
          const contentX = pointerContentXAtPoint(pos.x);
          const host = getTimelineDropHost();
          const hostLanes = host?.lanes ?? lanes;
          const scrollEl = host?.scrollEl;
          if (!scrollEl) {
            return { ...state, moved: true, valid: false };
          }

          const policyTarget = resolveClipMoveDropAtY(
            scrollEl,
            pos.y,
            family,
            wasInsert,
            hostLanes,
          );
          if (!policyTarget) {
            wasInsert = false;
            const preview: ClipMovePreview = {
              clipId: clip.id,
              originLaneId,
              laneId: originLaneId,
              startTime: Math.max(
                0,
                (contentX ?? originContentX) / pps - grabOffsetSec,
              ),
              duration,
              valid: false,
              label: clip.name || clip.id,
              clientX: pos.x,
              clientY: pos.y,
            };
            setLocalPreview(preview);
            onMovePreviewChange?.(preview);
            return {
              ...state,
              moved: true,
              valid: false,
              startTime: preview.startTime,
            };
          }
          wasInsert = policyTarget.isInsert;

          const drop = isGroup
            ? {
                laneId: originLaneId,
                track: originTrack,
                contentTop:
                  policyTarget.indicatorTop + scrollEl.scrollTop,
              }
            : dropTargetFromPolicy(
                policyTarget,
                hostLanes,
                originLaneId,
                scrollEl,
              );

          const resolved = resolveClipMoveDrag({
            clipId: clip.id,
            clip,
            originStartTime: originStart,
            originLaneId,
            originTrack,
            grabOffsetSec,
            pointerContentX: contentX ?? originContentX,
            pixelsPerSecond: pps,
            duration,
            drop,
            snapPoints,
            snapThresholdSec,
          });
          const rawDelta = resolved.commit.startTime - originStart;
          const groupDelta = Math.max(rawDelta, -minStartInGroup);
          const primaryStart = originStart + groupDelta;
          let groupValid = resolved.commit.valid;
          const members = isGroup
            ? groupIds
                .filter((id) => id !== clip.id)
                .map((id) => {
                  const c = catalogById.get(id);
                  if (!c || !c.laneId) return null;
                  return {
                    clipId: id,
                    laneId: c.laneId,
                    startTime: c.startTime + groupDelta,
                    duration: c.duration,
                  };
                })
                .filter((m): m is NonNullable<typeof m> => m != null)
            : undefined;
          if (isGroup && groupValid && groupPlan) {
            const core = groupPlan.resolve(groupDelta);
            groupValid = core.valid && resolved.commit.valid;
          }
          const snapGuideTime =
            primaryStart === resolved.commit.startTime
              ? (resolved.preview.snapGuideTime ?? null)
              : null;
          const preview: ClipMovePreview = {
            ...resolved.preview,
            startTime: primaryStart,
            laneId: isGroup ? originLaneId : resolved.preview.laneId,
            valid: isGroup ? groupValid : resolved.commit.valid,
            label: clip.name || clip.id,
            clientX: pos.x,
            clientY: pos.y,
            snapGuideTime,
            members,
          };
          setLocalPreview(preview);
          onMovePreviewChange?.(preview);
          return {
            startTime: primaryStart,
            laneId: isGroup ? originLaneId : resolved.commit.laneId,
            track: isGroup ? originTrack : resolved.commit.track,
            moved: true,
            valid: isGroup ? groupValid : resolved.commit.valid,
            groupDelta,
            insertNewLane: isGroup
              ? false
              : Boolean(resolved.commit.insertNewLane),
            insertOrder: isGroup
              ? null
              : (resolved.commit.insertOrder ?? null),
          };
        },
        onCommit: (state) => {
          clearMovePreview();
          if (!state.moved || !state.valid) return;
          if (!isGroup) {
            onExecute(
              {
                type: "move-clip",
                clipId: clip.id,
                patch: {
                  startTime: state.startTime,
                  track: state.track,
                  laneId: state.insertNewLane ? null : state.laneId,
                  insertNewLane: state.insertNewLane || undefined,
                  insertOrder: state.insertNewLane
                    ? (state.insertOrder ?? 0)
                    : undefined,
                },
              },
              state.insertNewLane ? "Move clip to new lane" : "Move clip",
            );
            return;
          }
          onExecute(
            {
              type: "move-clips",
              clipIds: groupIds,
              deltaTime: state.groupDelta,
            },
            "Move clips",
          );
        },
        onCancel: () => clearMovePreview(),
      },
      { x: event.clientX, y: event.clientY },
      // Capture on strip root — survives hiding the clip (web keeps listeners on window).
      event.currentTarget.parentElement ?? event.currentTarget,
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
            // Keep mounted while moving — unmounting breaks pointer capture (web hides via null only because listeners are on window).
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
          {/* Gray lane ghost only — web TrackLane (teal cursor is fixed in viewport). */}
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
