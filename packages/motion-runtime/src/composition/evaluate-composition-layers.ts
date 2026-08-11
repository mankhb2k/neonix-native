/**
 * Shared multi-scene composition layer plan.
 * Used by preview and export so Pixi/Remotion never diverge on transitions.
 */

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
  duration: number;
  transitionOut?: CompositionTransition;
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
  contentStart: number;
  contentDuration: number;
  transitionOut?: CompositionTransition;
};

function buildSegments(scenes: CompositionSceneInput[]): {
  segments: Segment[];
  totalDuration: number;
} {
  const segments: Segment[] = [];
  let cursor = 0;
  for (let i = 0; i < scenes.length; i += 1) {
    const scene = scenes[i]!;
    if (i > 0) {
      const prev = scenes[i - 1]!;
      const prevOut = prev.transitionOut;
      const overlap =
        prevOut && prevOut.type !== "cut" ? Math.max(0, prevOut.duration) : 0;
      if (overlap > 0) cursor = Math.max(0, cursor - overlap);
    }
    segments.push({
      sceneId: scene.sceneId,
      contentStart: cursor,
      contentDuration: scene.duration,
      transitionOut: scene.transitionOut,
    });
    cursor += scene.duration;
  }
  return { segments, totalDuration: cursor };
}

/**
 * Evaluate which scene layers are visible at a global time and how they composite.
 */
export function evaluateCompositionLayers(
  scenes: CompositionSceneInput[],
  globalTime: number,
  width: number,
  height: number,
): CompositionFramePlan {
  const { segments, totalDuration } = buildSegments(scenes);
  const t = Number.isFinite(globalTime) ? Math.max(0, globalTime) : 0;
  const layers: CompositionLayerPlan[] = [];

  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i]!;
    const next = segments[i + 1];
    const localTime = t - seg.contentStart;
    const inContent =
      localTime >= -1e-9 && localTime < seg.contentDuration + 1e-9;

    const outgoing = seg.transitionOut;
    const overlap =
      outgoing && outgoing.type !== "cut" ? Math.max(0, outgoing.duration) : 0;
    const transitionStart = seg.contentStart + seg.contentDuration - overlap;
    const inOutgoingTransition =
      overlap > 0 &&
      t >= transitionStart &&
      t < transitionStart + overlap &&
      next != null;
    const inIncomingTransition =
      i > 0 &&
      segments[i - 1]!.transitionOut &&
      segments[i - 1]!.transitionOut!.type !== "cut" &&
      (() => {
        const prev = segments[i - 1]!;
        const prevOut = prev.transitionOut!;
        const prevOverlap = Math.max(0, prevOut.duration);
        const start = prev.contentStart + prev.contentDuration - prevOverlap;
        return t >= start && t < start + prevOverlap;
      })();

    if (!inContent && !inOutgoingTransition && !inIncomingTransition) continue;

    const base: CompositionLayerPlan = {
      sceneId: seg.sceneId,
      localTime: Math.min(
        Math.max(0, localTime),
        Math.max(0, seg.contentDuration - 1e-6),
      ),
      opacity: 1,
      translateX: 0,
      translateY: 0,
      scale: 1,
      zIndex: i,
    };

    if (inOutgoingTransition && outgoing && next) {
      const u = ease(
        (t - transitionStart) / Math.max(1e-6, overlap),
        "easing" in outgoing ? outgoing.easing : undefined,
      );
      applyOutgoing(base, outgoing, u, width, height);
    } else if (inIncomingTransition) {
      const prev = segments[i - 1]!;
      const tr = prev.transitionOut!;
      const prevOverlap = Math.max(0, (tr as { duration: number }).duration);
      const start = prev.contentStart + prev.contentDuration - prevOverlap;
      const u = ease(
        (t - start) / Math.max(1e-6, prevOverlap),
        "easing" in tr ? tr.easing : undefined,
      );
      applyIncoming(base, tr, u, width, height);
    }

    layers.push(base);
  }

  // Hard-cut fallback: if nothing matched (e.g. empty), pick last segment.
  if (layers.length === 0 && segments.length > 0) {
    const last = segments[segments.length - 1]!;
    layers.push({
      sceneId: last.sceneId,
      localTime: Math.min(
        last.contentDuration,
        Math.max(0, t - last.contentStart),
      ),
      opacity: 1,
      translateX: 0,
      translateY: 0,
      scale: 1,
      zIndex: 0,
    });
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
