/**
 * Transition frame fixtures — golden JSON digests for all 6 transition types.
 *
 * Each fixture captures the composition layer plan at 5 key frames:
 *   before, start, middle, end, after
 *
 * These serve as golden references for the evaluator and parity harness.
 */

import type {
  CompositionTransition,
  CompositionSceneInput,
  CompositionLayerPlan,
} from "./evaluate-composition-layers";

// ── Fixture scene setup ───────────────────────────────────────────────

function makeTwoScenes(transition: CompositionTransition): CompositionSceneInput[] {
  return [
    { sceneId: "scene-a", duration: 3, transition },
    { sceneId: "scene-b", duration: 3, transition: undefined },
  ];
}

// ── Golden frame keys ─────────────────────────────────────────────────

export const TRANSITION_FIXTURE_KEYS = [
  "before",
  "start",
  "middle",
  "end",
  "after",
] as const;

export type TransitionFixtureKey = (typeof TRANSITION_FIXTURE_KEYS)[number];

/**
 * Frame times relative to the transition window.
 *
 * Overlapping transitions (crossfade, slide, wipe, zoom, fade):
 *   The overlap starts `duration` seconds before scene A ends.
 *   - before: mid scene-a, no transition
 *   - start: transition overlap begins (scene-a contentEnd - overlap)
 *   - middle: midpoint of the overlap window
 *   - end: scene-a content end (overlap ends for scene A, B is now active)
 *   - after: mid scene-b, after transition
 *
 * Cut transitions (no overlap):
 *   - before: mid scene-a
 *   - start/end: identical — scene-a content end
 *   - middle: same as start/end
 *   - after: mid scene-b
 */
export function fixtureGlobalTimes(duration: number): Record<TransitionFixtureKey, number> {
  const overlap = duration;
  const sceneAEnd = 3.0;
  return {
    before: 1.5,
    start: sceneAEnd - overlap,           // transition overlap begins
    middle: sceneAEnd - overlap + overlap / 2, // midpoint of overlap
    end: sceneAEnd,                       // transition overlap ends
    after: sceneAEnd + overlap + 1.0,     // mid scene-b
  };
}

// ── Transition definitions ────────────────────────────────────────────

export type FixtureDefinition = {
  name: string;
  transition: CompositionTransition;
  description: string;
};

export const TRANSITION_FIXTURES: FixtureDefinition[] = [
  {
    name: "cut",
    transition: { type: "cut" },
    description: "Instant cut — no overlap. Scene B starts immediately after scene A.",
  },
  {
    name: "fade",
    transition: { type: "fade", duration: 0.5, color: "#000000", easing: "easeInOut" },
    description: "Fade through black. Scene A fades to black, scene B fades in from black.",
  },
  {
    name: "crossfade",
    transition: { type: "crossfade", duration: 0.5, easing: "linear" },
    description: "Cross-fade: scene A opacity 1→0, scene B opacity 0→1 simultaneously.",
  },
  {
    name: "slide-left",
    transition: { type: "slide", duration: 0.5, direction: "left", mode: "push", easing: "easeInOut" },
    description: "Slide left (push): scene A pushed left as scene B enters from right.",
  },
  {
    name: "wipe-right",
    transition: { type: "wipe", duration: 0.5, direction: "right", softness: 0.1, easing: "linear" },
    description: "Wipe right: scene B reveals from left to right with edge softness.",
  },
  {
    name: "zoom-in",
    transition: { type: "zoom", duration: 0.5, direction: "in", easing: "easeInOut" },
    description: "Zoom in: scene A shrinks while scene B scales to normal.",
  },
];

// ── Golden digest ─────────────────────────────────────────────────────

export type FixtureFrameDigest = {
  fixture: string;
  key: TransitionFixtureKey;
  globalTime: number;
  layers: Array<{
    sceneId: string;
    localTime: number;
    opacity: number;
    translateX: number;
    translateY: number;
    scale: number;
    zIndex: number;
    wipeProgress?: number;
    fadeOverlay?: number;
  }>;
};

/**
 * Generate golden JSON digests for all transition types at all fixture keys.
 * Used by the evaluator test to verify deterministic output.
 */
export function generateFixtureDigests(
  overrideDuration?: number,
): FixtureFrameDigest[] {
  const digests: FixtureFrameDigest[] = [];

  for (const fixture of TRANSITION_FIXTURES) {
    const transition = overrideDuration != null && "duration" in fixture.transition
      ? { ...fixture.transition, duration: overrideDuration } as CompositionTransition
      : fixture.transition;
    const scenes = makeTwoScenes(transition);
    const overlap = transition.type === "cut" ? 0
      : "duration" in transition ? transition.duration
      : 0;
    const times = fixtureGlobalTimes(overlap);
    // Total: scene-a 3s + overlap + scene-b 3s
    const totalDuration = overlap > 0 ? 3 + overlap + 3 : 3 + 3;

    for (const key of TRANSITION_FIXTURE_KEYS) {
      const globalTime = times[key];

      // Manual layer computation (matches evaluateCompositionLayers logic)
      const layers = computeFixtureLayers(scenes, globalTime, totalDuration);

      digests.push({
        fixture: fixture.name,
        key,
        globalTime: Math.round(globalTime * 1000) / 1000,
        layers: layers.map((l) => ({
          sceneId: l.sceneId,
          localTime: Math.round(l.localTime * 1000) / 1000,
          opacity: Math.round(l.opacity * 1000) / 1000,
          translateX: Math.round(l.translateX * 100) / 100,
          translateY: Math.round(l.translateY * 100) / 100,
          scale: Math.round(l.scale * 1000) / 1000,
          zIndex: l.zIndex,
          wipeProgress: l.wipeProgress != null ? Math.round(l.wipeProgress * 1000) / 1000 : undefined,
          fadeOverlay: l.fadeOverlay != null ? Math.round(l.fadeOverlay * 1000) / 1000 : undefined,
        })),
      });
    }
  }

  return digests;
}

// ── Minimal layer computation (mirrors evaluateCompositionLayers) ─────

function computeFixtureLayers(
  scenes: CompositionSceneInput[],
  globalTime: number,
  _totalDuration: number,
): CompositionLayerPlan[] {
  const layers: CompositionLayerPlan[] = [];
  let cursor = 0;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i]!;
    const next = scenes[i + 1];
    const transition = scene.transition;
    const overlap = transition?.type === "cut" ? 0
      : transition && "duration" in transition ? transition.duration
      : 0;

    const contentStart = cursor;
    const contentEnd = cursor + scene.duration;
    const transitionEnd = contentEnd + overlap;

    // Before this scene
    if (globalTime < contentStart) {
      cursor = transitionEnd;
      continue;
    }

    // Past this scene entirely
    if (globalTime >= transitionEnd) {
      cursor = transitionEnd;
      continue;
    }

    // Inside content zone
    const inContent = globalTime >= contentStart && globalTime < contentEnd;
    // Inside transition zone (after content, before transition ends)
    const inTransition = globalTime >= contentEnd && globalTime < transitionEnd;

    if (inContent || inTransition) {
      let t = 0;

      if (inContent && next && overlap > 0 && transition && transition.type !== "cut") {
        t = (globalTime - (contentEnd - overlap)) / overlap;
        t = Math.min(1, Math.max(0, t));
      } else if (inTransition && next && overlap > 0 && transition && transition.type !== "cut") {
        t = 1;
      }

      if (inContent) {
        // Scene A content (may be transitioning out)
        const base: CompositionLayerPlan = {
          sceneId: scene.sceneId,
          localTime: globalTime - contentStart,
          opacity: 1,
          translateX: 0,
          translateY: 0,
          scale: 1,
          zIndex: i,
        };

        if (t > 0) {
          applyTransitionOut(base, transition!, t);
        }

        layers.push(base);

        if (t > 0) {
          const bLayer = makeTransitionIn(next!, overlap, t, i + 1, transition!);
          if (bLayer) layers.push(bLayer);
        }
      } else if (inTransition) {
        // Scene B during transition gap (scene A content done, B at full strength)
        const bLayer: CompositionLayerPlan = {
          sceneId: next!.sceneId,
          localTime: overlap, // scene B is at the start of its content
          opacity: 1,
          translateX: 0,
          translateY: 0,
          scale: 1,
          zIndex: i + 1,
        };
        layers.push(bLayer);
      }
    }

    cursor = transitionEnd;
  }

  return layers;
}

function applyTransitionOut(
  layer: CompositionLayerPlan,
  transition: CompositionTransition,
  t: number,
): void {
  if (transition.type === "crossfade") {
    layer.opacity = 1 - t;
  } else if (transition.type === "fade") {
    layer.opacity = 1 - t;
    layer.fadeOverlay = t;
    layer.fadeColor = transition.color;
  } else if (transition.type === "slide") {
    const dir = transition.direction === "left" ? -1
      : transition.direction === "right" ? 1
      : transition.direction === "up" ? -1
      : 1;
    const isH = transition.direction === "left" || transition.direction === "right";
    layer.translateX = isH ? -t * 100 * dir : 0;
    layer.translateY = isH ? 0 : -t * 100 * dir;
  } else if (transition.type === "wipe") {
    layer.wipeProgress = t;
    layer.wipeDirection = transition.direction;
    layer.wipeSoftness = transition.softness;
  } else if (transition.type === "zoom") {
    layer.scale = transition.direction === "in" ? 1 + t * 0.3 : 1 - t * 0.3;
    layer.opacity = 1 - t;
  }
}

function makeTransitionIn(
  next: CompositionSceneInput,
  overlap: number,
  t: number,
  zIndex: number,
  transition: CompositionTransition,
): CompositionLayerPlan | null {
  const base: CompositionLayerPlan = {
    sceneId: next.sceneId,
    localTime: overlap * t,
    opacity: 1,
    translateX: 0,
    translateY: 0,
    scale: 1,
    zIndex,
  };

  if (transition.type === "crossfade") {
    base.opacity = t;
  } else if (transition.type === "fade") {
    base.opacity = t;
    base.fadeOverlay = 1 - t;
    base.fadeColor = transition.color;
  } else if (transition.type === "slide") {
    const dir = transition.direction === "left" ? -1
      : transition.direction === "right" ? 1
      : transition.direction === "up" ? -1
      : 1;
    const isH = transition.direction === "left" || transition.direction === "right";
    base.translateX = isH ? (1 - t) * 100 * dir : 0;
    base.translateY = isH ? 0 : (1 - t) * 100 * dir;
  }

  return base;
}
