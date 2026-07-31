/**
 * Interactive clip strip — select / same-lane move / edge trim (Wave D).
 */

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  MIN_CLIP_SLICE_SEC,
  selectedClipIdsFrom,
  selectionClips,
  type EditorSelection,
  type TimelineClip,
  type TimelineCommand,
  type TimelineLane,
} from "@motionvideo/editor-core";
import { PointerSessionController } from "./interactions/pointer-session-controller";
import { shouldCommitPointerSession } from "./interactions/pointer-session";

const DRAG_THRESHOLD_PX = 3;

type TrackKind = "main" | "overlay" | "audio";

function trackForLane(lane: TimelineLane | undefined): TrackKind {
  if (!lane) return "main";
  if (lane.kind === "audio") return "audio";
  if (lane.role === "base") return "main";
  return "overlay";
}

type Preview =
  | { kind: "move"; clipId: string; startTime: number }
  | {
      kind: "trim";
      clipId: string;
      startTime: number;
      duration: number;
    };

type Props = {
  clips: TimelineClip[];
  lane: TimelineLane;
  pixelsPerSecond: number;
  laneHeight: number;
  selection: EditorSelection;
  disabled?: boolean;
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
  onSelect,
  onExecute,
}: Props) {
  const pps = Math.max(pixelsPerSecond, 0.001);
  const padY = 4;
  const height = Math.max(8, laneHeight - padY * 2);
  const selected = new Set(selectedClipIdsFrom(selection));
  const [preview, setPreview] = useState<Preview | null>(null);
  const sessionRef = useRef<PointerSessionController<unknown> | null>(null);

  const endSession = (reason: "pointerup" | "pointercancel" | "escape") => {
    const session = sessionRef.current;
    if (!session || !session.isRunning) return;
    session.flushPendingUpdate();
    if (shouldCommitPointerSession(reason)) {
      session.commit();
    } else {
      session.cancel();
    }
    sessionRef.current = null;
    setPreview(null);
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
    let dragged = false;

    type MoveState = { startTime: number; moved: boolean };
    const controller = new PointerSessionController<MoveState, void>({
      name: `move-${clip.id}`,
      onStart: () => ({ startTime: originStart, moved: false }),
      onUpdate: (pos, state) => {
        const dx = pos.x - originX;
        if (!state.moved && Math.abs(dx) < DRAG_THRESHOLD_PX) return state;
        const nextStart = Math.max(0, originStart + dx / pps);
        setPreview({ kind: "move", clipId: clip.id, startTime: nextStart });
        return { startTime: nextStart, moved: true };
      },
      onCommit: (state) => {
        if (!state.moved) return;
        onExecute(
          {
            type: "move-clip",
            clipId: clip.id,
            patch: {
              startTime: state.startTime,
              track: trackForLane(lane),
              laneId: lane.id,
            },
          },
          "Move clip",
        );
      },
      onCancel: () => setPreview(null),
    });

    if (!controller.start({ x: event.clientX, y: event.clientY })) return;
    sessionRef.current = controller as PointerSessionController<unknown>;
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);

    const onMove = (ev: PointerEvent) => {
      dragged = true;
      controller.update({ x: ev.clientX, y: ev.clientY });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey);
      endSession("pointerup");
      void dragged;
    };
    const onCancel = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey);
      endSession("pointercancel");
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey);
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
    const controller = new PointerSessionController<TrimState, void>({
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
        setPreview({ kind: "trim", clipId: clip.id, startTime, duration });
        return { startTime, duration };
      },
      onCommit: (state) => {
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
      onCancel: () => setPreview(null),
    });

    if (!controller.start({ x: event.clientX, y: event.clientY })) return;
    sessionRef.current = controller as PointerSessionController<unknown>;
    event.currentTarget.setPointerCapture(event.pointerId);

    const onMove = (ev: PointerEvent) =>
      controller.update({ x: ev.clientX, y: ev.clientY });
    const cleanup = (reason: "pointerup" | "pointercancel") => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey);
      endSession(reason);
    };
    const onUp = () => cleanup("pointerup");
    const onCancel = () => cleanup("pointercancel");
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey);
  };

  return (
    <div className="timeline-clip-strip" data-testid="timeline-clip-strip-root">
      {clips.map((clip) => {
        let start = clip.startTime;
        let duration = clip.duration;
        if (preview?.clipId === clip.id) {
          if (preview.kind === "move") start = preview.startTime;
          else {
            start = preview.startTime;
            duration = preview.duration;
          }
        }
        const left = start * pps;
        const width = Math.max(2, duration * pps);
        const isSelected = selected.has(clip.id);
        return (
          <div
            key={clip.id}
            role="button"
            tabIndex={disabled ? -1 : 0}
            className={
              isSelected
                ? "timeline-clip-strip__clip timeline-clip-strip__clip--selected"
                : "timeline-clip-strip__clip"
            }
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
    </div>
  );
}
