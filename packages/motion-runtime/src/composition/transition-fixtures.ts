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
import { evaluateCompositionLayers } from "./evaluate-composition-layers";

// ── Fixture scene setup ───────────────────────────────────────────────

function makeTwoScenes(
  transitionOut: CompositionTransition,
): CompositionSceneInput[] {
  const overlap =
    transitionOut.type === "cut"
      ? 0
      : "duration" in transitionOut
        ? transitionOut.duration
        : 0;
  const transitionIn: CompositionTransition | undefined =
    transitionOut.type === "cut" ? undefined : { ...transitionOut };
  return [
    { sceneId: "scene-a", start: 0, duration: 3, transitionOut },
    {
      sceneId: "scene-b",
      start: 3 - overlap,
      duration: 3,
      transitionIn,
      transitionOut: undefined,
    },
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
export function fixtureGlobalTimes(
  duration: number,
): Record<TransitionFixtureKey, number> {
  const overlap = duration;
  const sceneAEnd = 3.0;
  return {
    before: 1.5,
    start: sceneAEnd - overlap, // transition overlap begins
    middle: sceneAEnd - overlap + overlap / 2, // midpoint of overlap
    end: sceneAEnd, // transition overlap ends
    after: sceneAEnd + overlap + 1.0, // mid scene-b
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
    description:
      "Instant cut — no overlap. Scene B starts immediately after scene A.",
  },
  {
    name: "fade",
    transition: {
      type: "fade",
      duration: 0.5,
      color: "#000000",
      easing: "easeInOut",
    },
    description:
      "Fade through black. Scene A fades to black, scene B fades in from black.",
  },
  {
    name: "crossfade",
    transition: { type: "crossfade", duration: 0.5, easing: "linear" },
    description:
      "Cross-fade: scene A opacity 1→0, scene B opacity 0→1 simultaneously.",
  },
  {
    name: "slide-left",
    transition: {
      type: "slide",
      duration: 0.5,
      direction: "left",
      mode: "push",
      easing: "easeInOut",
    },
    description:
      "Slide left (push): scene A pushed left as scene B enters from right.",
  },
  {
    name: "wipe-right",
    transition: {
      type: "wipe",
      duration: 0.5,
      direction: "right",
      softness: 0.1,
      easing: "linear",
    },
    description:
      "Wipe right: scene B reveals from left to right with edge softness.",
  },
  {
    name: "zoom-in",
    transition: {
      type: "zoom",
      duration: 0.5,
      direction: "in",
      easing: "easeInOut",
    },
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
    const transition =
      overrideDuration != null && "duration" in fixture.transition
        ? ({
            ...fixture.transition,
            duration: overrideDuration,
          } as CompositionTransition)
        : fixture.transition;
    const scenes = makeTwoScenes(transition);
    const overlap =
      transition.type === "cut"
        ? 0
        : "duration" in transition
          ? transition.duration
          : 0;
    const times = fixtureGlobalTimes(overlap);

    for (const key of TRANSITION_FIXTURE_KEYS) {
      const globalTime = times[key];

      // Layer computation delegates to the canonical evaluator.
      const layers = computeFixtureLayers(scenes, globalTime);

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
          wipeProgress:
            l.wipeProgress != null
              ? Math.round(l.wipeProgress * 1000) / 1000
              : undefined,
          fadeOverlay:
            l.fadeOverlay != null
              ? Math.round(l.fadeOverlay * 1000) / 1000
              : undefined,
        })),
      });
    }
  }

  return digests;
}

// ── Layer computation (delegates to the canonical evaluator) ──────────

function computeFixtureLayers(
  scenes: CompositionSceneInput[],
  globalTime: number,
): CompositionLayerPlan[] {
  return evaluateCompositionLayers(scenes, globalTime, 1080, 1920).layers;
}
