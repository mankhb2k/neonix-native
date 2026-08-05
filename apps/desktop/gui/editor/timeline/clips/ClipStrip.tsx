/**
 * Interactive clip strip — select / move (incl. cross-lane) / edge trim.
 * Layer mode: node select + time/row move + edge trim (video capped to media).
 * Gesture controllers: use-clip-move / use-clip-trim (track),
 * use-layer-move / use-layer-trim (layer).
 */

import { memo, useCallback, useState } from "react";
import {
  selectedClipIdsFrom,
  selectionClips,
  selectionNode,
  type DocumentPropertyCommand,
  type EditorSelection,
  type TimelineClip,
  type TimelineCommand,
  type TimelineLane,
} from "@motionvideo/editor-core";
import { useMovePreviewForLane, useMarqueeSelectionIds } from "../interactions/timeline-preview-session";
import type { BeginGesture } from "../interactions/use-pointer-session";
import { cn } from "../../../ui";
import { useEditorUiSession } from "../../session/editor-ui-session";
import type { ClipMovePreview } from "./clip-move-geometry";
import {
  trackForLane,
  type TimelineTrackKind,
} from "../lanes/track-kind";
import { useClipMove } from "./use-clip-move";
import { useClipTrim, type ClipTrimPreview } from "./use-clip-trim";
import {
  useLayerMove,
  type LayerMoveSession,
} from "./use-layer-move";
import { useLayerTrim } from "./use-layer-trim";

export type { ClipMovePreview };

export type ClipStripLayerSession = LayerMoveSession;

export function clipVisualClassName(trackKind: TimelineTrackKind, selected: boolean): string {
  const selectedCls = selected
    ? trackKind === "main"
      ? "border-2 border-white text-white shadow-md"
      : "border-2 border-white"
    : "";
  const base =
    trackKind === "main"
      ? "overflow-hidden rounded px-2 text-left text-[11px] flex flex-col justify-center bg-[var(--timeline-clip-frame)] text-white/90"
      : trackKind === "audio"
        ? "flex items-center overflow-hidden rounded bg-[var(--timeline-clip-audio)] px-2 text-[10px] font-medium text-white shadow-sm"
        : "flex items-center overflow-hidden rounded bg-[#0F766E] px-2 text-[10px] font-semibold text-white shadow-sm";
  return cn(base, selectedCls);
}

function clipClassName(trackKind: TimelineTrackKind, selected: boolean): string {
  return cn(
    "absolute top-0 bottom-0 my-auto h-[96%] cursor-default select-none transition-opacity duration-150",
    selected && "z-10",
    clipVisualClassName(trackKind, selected),
  );
}

type Props = {
  clips: TimelineClip[];
  /** Full document clips for multi-select move. */
  allClips?: TimelineClip[];
  /** Full lane list for group collision preview. */
  lanes: TimelineLane[];
  lane: TimelineLane;
  /** Lane body height — float bubble matches strip (track 48 / layer 24|32). */
  laneHeightPx?: number;
  pixelsPerSecond: number;
  selection: EditorSelection;
  disabled?: boolean;
  /** Track + layer mode (layer video capped via layerSession.mediaMax). */
  trimEnabled?: boolean;
  /** When set, strip is a scene node (layer mode). */
  layerSession?: ClipStripLayerSession | null;
  beginGesture: BeginGesture;
  onSelect: (selection: EditorSelection) => void;
  onExecute: (command: TimelineCommand, label: string) => void;
  onExecuteProperty?: (input: {
    command: DocumentPropertyCommand;
    label: string;
    coalesceKey?: string;
  }) => void;
};

/** Receives visibility-culled `clips` only — parent owns full document arrays. */
export const ClipStrip = memo(function ClipStrip({
  clips,
  allClips,
  lanes,
  lane,
  laneHeightPx,
  pixelsPerSecond,
  selection,
  disabled,
  trimEnabled = true,
  layerSession = null,
  beginGesture,
  onSelect,
  onExecute,
  onExecuteProperty,
}: Props) {
  const pps = Math.max(pixelsPerSecond, 0.001);
  const marqueeSelectionIds = useMarqueeSelectionIds();
  const timelineMode = useEditorUiSession((s) => s.timelineMode);
  const activeContainerClipId = useEditorUiSession((s) => s.activeContainerClipId);
  const enterLayerMode = useEditorUiSession((s) => s.enterLayerMode);
  const inLayerSession = layerSession != null;

  const selected = new Set(
    marqueeSelectionIds ?? selectedClipIdsFrom(selection),
  );
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
    laneHeightPx,
    pixelsPerSecond,
    selection,
    disabled: disabled || inLayerSession,
    beginGesture,
    onSelect,
    onExecute,
  });

  const { beginTrim } = useClipTrim({
    pixelsPerSecond,
    disabled: disabled || !trimEnabled || inLayerSession,
    beginGesture,
    onSelect,
    onExecute,
    onLocalPreview,
  });

  const { beginLayerMove } = useLayerMove({
    pixelsPerSecond,
    disabled,
    laneHeightPx,
    layerSession,
    beginGesture,
    onSelect,
    onExecuteProperty,
  });

  const { beginLayerTrim } = useLayerTrim({
    pixelsPerSecond,
    disabled: disabled || !trimEnabled || !inLayerSession,
    layerSession,
    beginGesture,
    onSelect,
    onExecuteProperty,
    onLocalPreview,
  });

  /** Layer mode: float + cyan gap only — never park a body ghost on a row. */
  const showMoveGhost =
    !inLayerSession &&
    activeMove != null &&
    activeMove.laneId === lane.id &&
    !activeMove.isInsert;

  const showTrimHandles = trimEnabled;

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
        const isSelected = inLayerSession
          ? (selection.kind === "node" &&
              selection.sceneId === layerSession.sceneId &&
              selection.nodeId === clip.id) ||
            selected.has(clip.id)
          : selected.has(clip.id);
        const trackKind = trackForLane(lane);

        const isDimmed =
          !inLayerSession &&
          timelineMode === "layer" &&
          clip.id !== activeContainerClipId;

        return (
          <div
            key={clip.id}
            role="button"
            tabIndex={disabled ? -1 : 0}
            className={cn(
              clipClassName(trackKind, isSelected),
              isMovingSource && "invisible pointer-events-none",
              isDimmed && "opacity-35 pointer-events-none filter grayscale-[30%]",
            )}
            data-testid={inLayerSession ? "timeline-layer-strip" : "timeline-clip-strip"}
            data-clip-id={clip.id}
            data-node-id={inLayerSession ? clip.id : undefined}
            data-start-time={String(start)}
            style={{ left, width }}
            title={clip.name || clip.id}
            onPointerDown={(e) => {
              if (isDimmed) return;
              if (inLayerSession) {
                beginLayerMove(e, clip);
                return;
              }
              if (e.button === 0 && e.detail === 2) {
                e.preventDefault();
                e.stopPropagation();
                enterLayerMode(clip.id, allClips ?? clips);
                return;
              }
              beginMove(e, clip);
            }}
            onDoubleClick={(e) => {
              if (inLayerSession) return;
              e.preventDefault();
              e.stopPropagation();
              enterLayerMode(clip.id, allClips ?? clips);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (inLayerSession && layerSession) {
                  onSelect(selectionNode(layerSession.sceneId, clip.id));
                } else {
                  onSelect(selectionClips([clip.id]));
                }
              }
            }}
          >
            <span className="min-w-0 truncate font-semibold leading-tight pointer-events-none">
              {clip.name || clip.id}
            </span>
            {isSelected && !disabled && !isMovingSource && showTrimHandles ? (
              <>
                <span
                  className="absolute inset-y-0 left-0 z-[2] w-1.5 cursor-ew-resize"
                  data-testid="timeline-clip-trim-left"
                  onPointerDown={(e) =>
                    inLayerSession
                      ? beginLayerTrim(e, clip, "left")
                      : beginTrim(e, clip, "left")
                  }
                />
                <span
                  className="absolute inset-y-0 right-0 z-[2] w-1.5 cursor-ew-resize"
                  data-testid="timeline-clip-trim-right"
                  onPointerDown={(e) =>
                    inLayerSession
                      ? beginLayerTrim(e, clip, "right")
                      : beginTrim(e, clip, "right")
                  }
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
                className={cn(
                  "pointer-events-none absolute top-0 bottom-0 z-[20] my-auto h-[96%] overflow-hidden rounded border border-[#4a4a52] bg-[#38383e] opacity-80 shadow-md will-change-[left]",
                  !activeMove.valid && "border-[var(--danger)] bg-[var(--danger)]/40",
                )}
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
