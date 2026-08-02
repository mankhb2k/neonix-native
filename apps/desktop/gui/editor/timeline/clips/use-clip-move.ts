/**
 * Clip move gesture controller (single + group, cross-lane, snap).
 */

import { useCallback } from "react";
import {
  createClipGroupMovePlan,
  selectedClipIdsFrom,
  selectionClips,
  type EditorSelection,
  type TimelineClip,
  type TimelineCommand,
  type TimelineLane,
} from "@motionvideo/editor-core";
import { autoScrollTimelineNearEdge } from "../drop/auto-scroll";
import {
  resolveClipMoveDropAtY,
  type TimelineDropTarget,
} from "../drop/lane-drop-target";
import {
  getTimelineDropHost,
  pointerContentXAtPoint,
} from "../drop/timeline-drop-host";
import type { BeginGesture } from "../interactions/use-pointer-session";
import { useTimelineInteractionPrefs } from "../timeline-interaction-prefs";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  collectClipEdgeSnapPoints,
  resolveClipMoveDrag,
  type ClipMoveDropTarget,
  type ClipMovePreview,
} from "./clip-move-geometry";

const DRAG_THRESHOLD_PX = 4;
const SNAP_THRESHOLD_PX = 8;

type TrackKind = "main" | "overlay" | "audio";

function trackForLane(lane: TimelineLane | undefined): TrackKind {
  if (!lane) return "main";
  if (lane.kind === "audio") return "audio";
  if (lane.role === "base") return "main";
  return "overlay";
}

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

export type UseClipMoveArgs = {
  clips: TimelineClip[];
  allClips?: TimelineClip[];
  lanes: TimelineLane[];
  lane: TimelineLane;
  pixelsPerSecond: number;
  selection: EditorSelection;
  disabled?: boolean;
  beginGesture: BeginGesture;
  onSelect: (selection: EditorSelection) => void;
  onExecute: (command: TimelineCommand, label: string) => void;
  onLocalPreview: (preview: ClipMovePreview | null) => void;
  onMovePreviewChange?: (preview: ClipMovePreview | null) => void;
};

export function useClipMove({
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
  onLocalPreview,
  onMovePreviewChange,
}: UseClipMoveArgs) {
  const pps = Math.max(pixelsPerSecond, 0.001);
  const autoSnapping = useTimelineInteractionPrefs((s) => s.autoSnapping);
  const selected = new Set(selectedClipIdsFrom(selection));

  const clearMovePreview = useCallback(() => {
    onLocalPreview(null);
    onMovePreviewChange?.(null);
  }, [onLocalPreview, onMovePreviewChange]);

  const beginMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>, clip: TimelineClip) => {
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
              onLocalPreview(preview);
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
            onLocalPreview(preview);
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
        event.currentTarget.parentElement ?? event.currentTarget,
        event.pointerId,
      );
    },
    [
      allClips,
      autoSnapping,
      beginGesture,
      clearMovePreview,
      clips,
      disabled,
      lane,
      lanes,
      onExecute,
      onLocalPreview,
      onMovePreviewChange,
      onSelect,
      pps,
      selected,
    ],
  );

  return { beginMove };
}
