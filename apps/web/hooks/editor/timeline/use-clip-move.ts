/**
 * Clip move gesture (single + group, cross-lane, snap) — controlled callbacks.
 */

import { useCallback } from "react";
import {
  createClipGroupMovePlan,
  selectedClipIdsFrom,
  selectionClips,
  type EditorSelection,
  type TimelineClip,
  type TimelineEdit,
  type TimelineLane,
  type TimelineTrackKind,
  collectClipEdgeSnapPoints,
  resolveClipMoveDrag,
  type ClipMoveDropTarget,
  type ClipMovePreview,
} from "@motionvideo/editor-core/timeline";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { BeginGesture } from "../pointer/use-pointer-session-host";
import type {
  ClipMoveHost,
  ClipMovePolicyTarget,
} from "./gesture-host";

const DRAG_THRESHOLD_PX = 4;
const SNAP_THRESHOLD_PX = 8;

function laneRoleOf(
  lane: Pick<TimelineLane, "kind" | "role"> | undefined,
): "base" | "overlay" | "audio" {
  if (!lane) return "overlay";
  if (lane.kind === "audio") return "audio";
  if (lane.role === "base") return "base";
  return "overlay";
}

function dropTargetFromPolicy(
  target: ClipMovePolicyTarget,
  lanes: TimelineLane[],
  originLaneId: string,
  scrollEl: HTMLElement,
): ClipMoveDropTarget {
  const contentTop = target.indicatorTop + scrollEl.scrollTop;
  const track: TimelineTrackKind =
    target.family === "audio"
      ? "audio"
      : target.overBaseBody
        ? "main"
        : "overlay";

  const laneTopContentY = (laneId: string): number | undefined => {
    const el = scrollEl.querySelector<HTMLElement>(
      `[data-lane-id="${CSS.escape(laneId)}"]`,
    );
    if (!el) return undefined;
    const scrollRect = scrollEl.getBoundingClientRect();
    return el.getBoundingClientRect().top - scrollRect.top + scrollEl.scrollTop;
  };

  const withLaneMeta = (
    partial: Omit<ClipMoveDropTarget, "laneRole" | "laneOrder"> & {
      laneRole?: ClipMoveDropTarget["laneRole"];
      laneOrder?: number;
    },
  ): ClipMoveDropTarget => {
    const lane = lanes.find((l) => l.id === partial.laneId);
    return {
      ...partial,
      laneRole: partial.laneRole ?? laneRoleOf(lane),
      laneOrder: partial.laneOrder ?? lane?.order ?? 0,
    };
  };

  if (target.isInsert) {
    return withLaneMeta({
      laneId: originLaneId,
      track: track === "main" ? "overlay" : track,
      insertNewLane: true,
      insertOrder: target.insertOrder,
      contentTop,
    });
  }

  if (target.laneId) {
    const lane = lanes.find((l) => l.id === target.laneId);
    return withLaneMeta({
      laneId: target.laneId,
      track,
      contentTop,
      laneOrder: lane?.order ?? 0,
      laneRole: laneRoleOf(lane),
      laneTopContentY: laneTopContentY(target.laneId),
    });
  }

  if (target.overBaseBody || track === "main") {
    const base = lanes.find((l) => l.kind === "visual" && l.role === "base");
    if (base) {
      return withLaneMeta({
        laneId: base.id,
        track: "main",
        contentTop,
        laneOrder: base.order,
        laneRole: "base",
        laneTopContentY: laneTopContentY(base.id),
      });
    }
  }

  return withLaneMeta({ laneId: originLaneId, track, contentTop });
}

export type UseClipMoveArgs = {
  clips: TimelineClip[];
  allClips?: TimelineClip[];
  lanes: TimelineLane[];
  lane: TimelineLane;
  laneHeightPx?: number;
  pixelsPerSecond: number;
  selection: EditorSelection;
  disabled?: boolean;
  autoSnapping?: boolean;
  beginGesture: BeginGesture;
  host: ClipMoveHost;
  onSelect: (selection: EditorSelection) => void;
  onCommand: (command: TimelineEdit, label: string) => void;
  onMovePreview: (preview: ClipMovePreview | null) => void;
};

export function useClipMove({
  clips,
  allClips,
  lanes,
  lane,
  laneHeightPx: laneHeightPxProp,
  pixelsPerSecond,
  selection,
  disabled,
  autoSnapping = true,
  beginGesture,
  host,
  onSelect,
  onCommand,
  onMovePreview,
}: UseClipMoveArgs) {
  const pps = Math.max(pixelsPerSecond, 0.001);
  const laneHeightPx = laneHeightPxProp ?? host.laneRowHeightPx(lane);
  const selected = new Set(selectedClipIdsFrom(selection));

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
      const clipRect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const grabOffsetY = originY - clipRect.top;

      const originStart = clip.startTime;
      const originLaneId = lane.id;
      const originTrack = host.trackForLane(lane);
      const duration = clip.duration;
      const originContentX = host.pointerContentXAtPoint(originX) ?? 0;
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
        track: TimelineTrackKind;
        moved: boolean;
        valid: boolean;
        groupDelta: number;
        insertNewLane: boolean;
        insertOrder: number | null;
        swapClipId: string | null;
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
            swapClipId: null,
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
            host.autoScrollNearEdge(pos.x, pos.y);
            const contentX = host.pointerContentXAtPoint(pos.x);
            const dropCtx = host.getDropContext();
            const hostLanes = dropCtx?.lanes ?? lanes;
            const scrollEl = dropCtx?.scrollEl;
            if (!scrollEl) {
              return { ...state, moved: true, valid: false };
            }

            const policyTarget = host.resolveDropAtY(
              scrollEl,
              pos.y,
              family,
              wasInsert,
              hostLanes,
              dropCtx?.laneHitLayout,
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
                trackKind: originTrack,
                label: clip.name || clip.id,
                clientX: pos.x,
                clientY: pos.y,
                grabOffsetY,
                laneHeightPx,
              };
              onMovePreview(preview);
              return {
                ...state,
                moved: true,
                valid: false,
                startTime: preview.startTime,
              };
            }
            wasInsert = policyTarget.isInsert;

            const drop = dropTargetFromPolicy(
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
              occupancyClips: isGroup ? undefined : catalog,
              clipsByLane: isGroup ? undefined : dropCtx?.clipsByLane,
              excludeIds: excludeSnapIds,
              lanes: isGroup ? undefined : hostLanes,
              siblingLaneRefs: isGroup ? undefined : dropCtx?.siblingLaneRefs,
              overlayLaneRefs: isGroup ? undefined : dropCtx?.overlayLaneRefs,
              audioLaneRefs: isGroup ? undefined : dropCtx?.audioLaneRefs,
              exclusiveRows: host.exclusiveRows,
            });
            const rawDelta = resolved.commit.startTime - originStart;
            const groupDelta = Math.max(rawDelta, -minStartInGroup);
            const primaryStart = originStart + groupDelta;
            let groupValid = resolved.commit.valid;
            const primaryLaneIndex = hostLanes.findIndex(
              (l) => l.id === originLaneId,
            );
            const primaryLaneTop = dropCtx?.laneHitLayout
              ? dropCtx.laneHitLayout.topPadding +
                (dropCtx.laneHitLayout.laneHeightPrefix[primaryLaneIndex] ?? 0)
              : 0;

            const members = isGroup
              ? groupIds
                  .filter((id) => id !== clip.id)
                  .map((id) => {
                    const c = catalogById.get(id);
                    if (!c || !c.laneId) return null;
                    const lIdx = hostLanes.findIndex((l) => l.id === c.laneId);
                    const lTop =
                      dropCtx?.laneHitLayout && lIdx >= 0
                        ? dropCtx.laneHitLayout.topPadding +
                          (dropCtx.laneHitLayout.laneHeightPrefix[lIdx] ?? 0)
                        : 0;
                    const mLane = hostLanes[lIdx];
                    return {
                      clipId: id,
                      laneId: c.laneId,
                      startTime: c.startTime + groupDelta,
                      duration: c.duration,
                      trackKind: mLane
                        ? host.trackForLane(mLane)
                        : ("overlay" as const),
                      offsetY: lTop - primaryLaneTop,
                      laneHeightPx: mLane
                        ? host.laneRowHeightPx(mLane)
                        : laneHeightPx,
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
              laneId: resolved.preview.laneId,
              valid: isGroup ? groupValid : resolved.commit.valid,
              trackKind: resolved.preview.trackKind,
              label: clip.name || clip.id,
              clientX: pos.x,
              clientY: pos.y,
              grabOffsetY,
              snapGuideTime,
              laneHeightPx,
              members,
            };
            onMovePreview(preview);
            return {
              startTime: primaryStart,
              laneId: resolved.commit.laneId,
              track: resolved.commit.track,
              moved: true,
              valid: isGroup ? groupValid : resolved.commit.valid,
              groupDelta,
              insertNewLane: Boolean(resolved.commit.insertNewLane),
              insertOrder: resolved.commit.insertOrder ?? null,
              swapClipId: resolved.commit.swapClipId ?? null,
            };
          },
          onCommit: (state) => {
            onMovePreview(null);
            if (!state.moved || !state.valid) return;
            if (!isGroup) {
              onCommand(
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
                    exclusiveRows: host.exclusiveRows || undefined,
                    swapClipId: state.swapClipId || undefined,
                  },
                },
                state.insertNewLane ? "Move clip to new lane" : "Move clip",
              );
              return;
            }
            onCommand(
              {
                type: "move-clips",
                clipIds: groupIds,
                deltaTime: state.groupDelta,
                targetLaneId: state.laneId,
                targetTrack: state.track,
                targetInsertNewLane: state.insertNewLane || undefined,
                targetInsertOrder: state.insertNewLane
                  ? (state.insertOrder ?? 0)
                  : undefined,
              },
              "Move clips",
            );
          },
          onCancel: () => onMovePreview(null),
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
      clips,
      disabled,
      host,
      lane,
      laneHeightPx,
      lanes,
      onCommand,
      onMovePreview,
      onSelect,
      pps,
      selected,
    ],
  );

  return { beginMove };
}
