/**
 * Shared multi-scene composition layer plan.
 * Used by preview and export so Pixi/Remotion never diverge on transitions.
 */

import { resolveMediaTiming } from "../media-timing";

export type CompositionEasing =
  | "linear"
  | "step"
  | "easeIn"
  | "easeOut"
  | "easeInOut"
  | "spring";

export type CompositionTransition =
  | { type: "cut"; duration?: 0 }
  | {
      type: "fade";
      duration: number;
      color?: string;
      easing?: CompositionEasing;
    }
  | { type: "crossfade"; duration: number; easing?: CompositionEasing }
  | {
      type: "slide";
      duration: number;
      direction: "left" | "right" | "up" | "down";
      mode: "push" | "cover";
      easing?: CompositionEasing;
    }
  | {
      type: "wipe";
      duration: number;
      direction: "left" | "right" | "up" | "down";
      softness?: number;
      easing?: CompositionEasing;
    }
  | {
      type: "zoom";
      duration: number;
      direction: "in" | "out";
      easing?: CompositionEasing;
    };

export type CompositionSceneInput = {
  sceneId: string;
  /** Absolute global timeline start (seconds) — the source of truth, never
   * reconstructed from a cursor. */
  start: number;
  duration: number;
  /** Source trim offset applied when mapping composition → scene local time. */
  trimStart?: number;
  /** Playback rate applied to composition-local time (default 1). */
  playbackRate?: number;
  /** When true, loop within the source window while the clip is active. */
  loop?: boolean;
  /** Source media/scene duration used for loop wrapping (seconds). */
  sourceDuration?: number;
  transitionIn?: CompositionTransition;
  transitionOut?: CompositionTransition;
  trackId?: string;
  trackOrder?: number;
};

export type CompositionLayerPlan = {
  sceneId: string;
  localTime: number;
  opacity: number;
  /** Translate in composition pixels (width/height normalized by caller). */
  translateX: number;
  translateY: number;
  scale: number;
  /** Optional wipe progress 0..1 when transition is wipe. */
  wipeProgress?: number;
  wipeDirection?: "left" | "right" | "up" | "down";
  wipeSoftness?: number;
  /** Fade-to-color overlay strength 0..1 for fade transitions. */
  fadeOverlay?: number;
  fadeColor?: string;
  zIndex: number;
};

export type CompositionFramePlan = {
  globalTime: number;
  width: number;
  height: number;
  layers: CompositionLayerPlan[];
  /** Total timeline duration including transition overlaps (shared audio clock). */
  totalDuration: number;
};

function ease(t: number, easing: CompositionEasing = "easeInOut"): number {
  const x = Math.min(1, Math.max(0, t));
  switch (easing) {
    case "linear":
      return x;
    case "step":
      return x < 1 ? 0 : 1;
    case "easeIn":
      return x * x;
    case "easeOut":
      return 1 - (1 - x) * (1 - x);
    case "spring":
      return 1 - Math.pow(1 - x, 3) * Math.cos(x * Math.PI * 2);
    case "easeInOut":
    default:
      return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  }
}

type Segment = {
  sceneId: string;
  start: number;
  duration: number;
  trimStart?: number;
  playbackRate?: number;
  loop?: boolean;
  sourceDuration?: number;
  transitionIn?: CompositionTransition;
  transitionOut?: CompositionTransition;
  trackId?: string;
  trackOrder?: number;
};

function buildSegments(scenes: CompositionSceneInput[]): {
  segments: Segment[];
  totalDuration: number;
} {
  // Clip `start` is ABSOLUTE global timeline time. Preserve caller ordering
  // (already sorted by role/track/start) and assign zIndex by position so
  // overlays drawn later composite on top.
  const segments: Segment[] = scenes.map((scene) => ({
    sceneId: scene.sceneId,
    start: scene.start,
    duration: scene.duration,
    trimStart: scene.trimStart,
    playbackRate: scene.playbackRate,
    loop: scene.loop,
    sourceDuration: scene.sourceDuration,
    transitionIn: scene.transitionIn,
    transitionOut: scene.transitionOut,
    trackId: scene.trackId,
    trackOrder: scene.trackOrder,
  }));
  const totalDuration = segments.reduce(
    (max, s) => Math.max(max, s.start + s.duration),
    0,
  );
  return { segments, totalDuration };
}

/**
 * Map composition-window time → scene/media local time.
 * Active window stays `start..start+duration`; trim/rate/loop only affect
 * the local clock fed into scene evaluation.
 */
function effectiveLocalTime(
  seg: Segment,
  compositionLocalTime: number,
  fps: number,
): number {
  return resolveMediaTiming({
    mediaTimeSeconds: compositionLocalTime,
    fps,
    trimStartSeconds: seg.trimStart ?? 0,
    playbackRate: seg.playbackRate ?? 1,
    loop: seg.loop ?? false,
    sourceDurationSeconds: seg.sourceDuration ?? seg.duration,
  }).mediaTimeSeconds;
}

/**
 * Evaluate which scene layers are visible at a global time and how they composite.
 *
 * A clip is active when `globalTime >= start && globalTime < start + duration`.
 * Scene `localTime` applies trimStart / playbackRate / loop via media-timing.
 * Transitions are ramped around the clip's own fixed boundaries (no cursor):
 *  - `transitionIn` fades/slides/wipes in over the first `duration` seconds.
 *  - `transitionOut` fades/slides/wipes out over the last `duration` seconds.
 * Gaps and manual tail produce no layers.
 */
export function evaluateCompositionLayers(
  scenes: CompositionSceneInput[],
  globalTime: number,
  width: number,
  height: number,
  fps = 30,
): CompositionFramePlan {
  const { segments, totalDuration } = buildSegments(scenes);
  const t = Number.isFinite(globalTime) ? Math.max(0, globalTime) : 0;
  const safeFps = Math.max(1, fps);
  const layers: CompositionLayerPlan[] = [];

  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i]!;
    const compositionLocalTime = t - seg.start;
    const inContent =
      compositionLocalTime >= -1e-9 && compositionLocalTime < seg.duration;

    const outgoing = seg.transitionOut;
    const overlapOut =
      outgoing && outgoing.type !== "cut" ? Math.max(0, outgoing.duration) : 0;
    const inOutgoing =
      overlapOut > 0 &&
      t >= seg.start + seg.duration - overlapOut &&
      t < seg.start + seg.duration;

    const incoming = seg.transitionIn;
    const overlapIn =
      incoming && incoming.type !== "cut" ? Math.max(0, incoming.duration) : 0;
    const inIncoming =
      overlapIn > 0 && t >= seg.start && t < seg.start + overlapIn;

    if (!inContent) continue;

    const base: CompositionLayerPlan = {
      sceneId: seg.sceneId,
      localTime: effectiveLocalTime(seg, compositionLocalTime, safeFps),
      opacity: 1,
      translateX: 0,
      translateY: 0,
      scale: 1,
      zIndex: i,
    };

    if (inOutgoing && outgoing) {
      const u = ease(
        (t - (seg.start + seg.duration - overlapOut)) /
          Math.max(1e-6, overlapOut),
        "easing" in outgoing ? outgoing.easing : undefined,
      );
      applyOutgoing(base, outgoing, u, width, height);
    } else if (inIncoming && incoming) {
      const u = ease(
        (t - seg.start) / Math.max(1e-6, overlapIn),
        "easing" in incoming ? incoming.easing : undefined,
      );
      applyIncoming(base, incoming, u, width, height);
    }

    layers.push(base);
  }

  layers.sort((a, b) => a.zIndex - b.zIndex);
  return { globalTime: t, width, height, layers, totalDuration };
}

function applyOutgoing(
  layer: CompositionLayerPlan,
  transition: CompositionTransition,
  u: number,
  width: number,
  height: number,
): void {
  switch (transition.type) {
    case "cut":
      return;
    case "fade":
      layer.opacity = 1 - u;
      layer.fadeOverlay = u;
      layer.fadeColor = transition.color ?? "#000000";
      return;
    case "crossfade":
      layer.opacity = 1 - u;
      return;
    case "slide": {
      const dist =
        transition.direction === "left" || transition.direction === "right"
          ? width
          : height;
      const sign =
        transition.direction === "left" || transition.direction === "up"
          ? -1
          : 1;
      if (transition.direction === "left" || transition.direction === "right") {
        layer.translateX = sign * dist * u;
      } else {
        layer.translateY = sign * dist * u;
      }
      if (transition.mode === "cover") layer.opacity = 1;
      return;
    }
    case "wipe":
      layer.wipeProgress = u;
      layer.wipeDirection = transition.direction;
      layer.wipeSoftness = transition.softness ?? 0;
      return;
    case "zoom":
      layer.scale =
        transition.direction === "out" ? 1 + 0.25 * u : 1 - 0.15 * u;
      layer.opacity = 1 - u * 0.5;
      return;
  }
}

function applyIncoming(
  layer: CompositionLayerPlan,
  transition: CompositionTransition,
  u: number,
  width: number,
  height: number,
): void {
  switch (transition.type) {
    case "cut":
      return;
    case "fade":
      layer.opacity = u;
      layer.fadeOverlay = 1 - u;
      layer.fadeColor = transition.color ?? "#000000";
      return;
    case "crossfade":
      layer.opacity = u;
      return;
    case "slide": {
      const dist =
        transition.direction === "left" || transition.direction === "right"
          ? width
          : height;
      const from =
        transition.direction === "left" || transition.direction === "up"
          ? dist
          : -dist;
      if (transition.direction === "left" || transition.direction === "right") {
        layer.translateX = from * (1 - u);
      } else {
        layer.translateY = from * (1 - u);
      }
      return;
    }
    case "wipe":
      layer.wipeProgress = u;
      layer.wipeDirection = transition.direction;
      layer.wipeSoftness = transition.softness ?? 0;
      return;
    case "zoom":
      layer.scale =
        transition.direction === "in" ? 0.85 + 0.15 * u : 1.25 - 0.25 * u;
      layer.opacity = Math.min(1, 0.5 + 0.5 * u);
      return;
  }
}

export function compositionTotalDuration(
  scenes: CompositionSceneInput[],
): number {
  return buildSegments(scenes).totalDuration;
}
