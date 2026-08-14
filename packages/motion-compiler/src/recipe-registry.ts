/**
 * Deterministic motion recipe registry (R6).
 * Recipes bake to clips/tracks and/or procedural drivers — unknown id throws.
 */

export const MOTION_RECIPE_IDS = [
  "wiggle",
  "float",
  "pulse",
  "breathing",
  "drift",
  "shimmer",
  "follow",
  "counter",
  "stagger",
  "camera-shake",
] as const;

export type MotionRecipeId = (typeof MOTION_RECIPE_IDS)[number];

export function isMotionRecipe(id: string): id is MotionRecipeId {
  return (MOTION_RECIPE_IDS as readonly string[]).includes(id);
}

/** Typed ambient recipe params (Phase 1). Prefer these over free-form speed strings. */
export type AmbientRecipeParams = {
  frequencyHz?: number;
  intensity?: number;
  phase?: number;
  seed?: number;
};

export type RecipeBakeInput = {
  recipeId: MotionRecipeId;
  graphId: string;
  targetLayerId: string;
  duration: number;
  seed?: number;
  intensity?: number;
  frequencyHz?: number;
  phase?: number;
  /** For stagger: sibling node ids in order. */
  staggerLayerIds?: string[];
  /** For follow: source node to link from. */
  sourceLayerId?: string;
};

export type BakedRecipe = {
  drivers: Array<Record<string, unknown>>;
  tracks: Array<{
    layerId: string;
    property: string;
    keys: Array<{ t: number; v: number; easing?: string | Record<string, unknown> }>;
  }>;
};

export function bakeMotionRecipe(input: RecipeBakeInput): BakedRecipe {
  const intensity = input.intensity ?? 1;
  const seed = input.seed ?? 1;
  const end = Math.max(0.01, input.duration);
  const frequencyHz = input.frequencyHz;
  const phase = input.phase ?? 0;

  switch (input.recipeId) {
    case "wiggle":
      return {
        drivers: [
          {
            id: `drv.${input.targetLayerId}.wiggle`,
            type: "noise",
            targetLayerId: input.targetLayerId,
            targetProperty: "transform.rotation",
            frequency: frequencyHz ?? 3,
            amplitude: 8 * intensity,
            seed,
          },
        ],
        tracks: [],
      };
    case "float":
      return {
        drivers: [
          {
            id: `drv.${input.targetLayerId}.float`,
            type: "oscillator",
            targetLayerId: input.targetLayerId,
            targetProperty: "transform.y",
            frequency: frequencyHz ?? 0.6,
            amplitude: 24 * intensity,
            phase,
            waveform: "sine",
          },
        ],
        tracks: [],
      };
    case "pulse":
      return {
        drivers: [
          {
            id: `drv.${input.targetLayerId}.pulse`,
            type: "oscillator",
            targetLayerId: input.targetLayerId,
            targetProperty: "transform.scaleX",
            frequency: frequencyHz ?? 1.2,
            amplitude: 0.08 * intensity,
            phase,
            waveform: "sine",
          },
        ],
        tracks: [
          {
            layerId: input.targetLayerId,
            property: "transform.scaleY",
            keys: [
              { t: 0, v: 1 },
              { t: end, v: 1, easing: "linear" },
            ],
          },
        ],
      };
    case "breathing":
      return {
        drivers: [
          {
            id: `drv.${input.targetLayerId}.breathing`,
            type: "oscillator",
            targetLayerId: input.targetLayerId,
            targetProperty: "transform.scaleX",
            frequency: frequencyHz ?? 0.35,
            amplitude: 0.04 * intensity,
            phase,
            waveform: "sine",
          },
        ],
        tracks: [],
      };
    case "drift":
      return {
        drivers: [
          {
            id: `drv.${input.targetLayerId}.drift`,
            type: "oscillator",
            targetLayerId: input.targetLayerId,
            targetProperty: "transform.x",
            frequency: frequencyHz ?? 0.2,
            amplitude: 16 * intensity,
            phase,
            waveform: "sine",
          },
        ],
        tracks: [],
      };
    case "shimmer":
      return {
        drivers: [
          {
            id: `drv.${input.targetLayerId}.shimmer`,
            type: "oscillator",
            targetLayerId: input.targetLayerId,
            targetProperty: "transform.opacity",
            frequency: frequencyHz ?? 2.5,
            amplitude: 0.12 * intensity,
            phase,
            waveform: "sine",
          },
        ],
        tracks: [],
      };
    case "follow": {
      if (!input.sourceLayerId) throw new Error("follow recipe requires sourceLayerId");
      return {
        drivers: [
          {
            id: `drv.${input.targetLayerId}.follow`,
            type: "spring-follow",
            targetLayerId: input.targetLayerId,
            targetProperty: "transform.x",
            sourceLayerId: input.sourceLayerId,
            sourceProperty: "transform.x",
            stiffness: 180,
            damping: 18,
          },
        ],
        tracks: [],
      };
    }
    case "counter":
      return {
        drivers: [],
        tracks: [
          {
            layerId: input.targetLayerId,
            property: "payload.counterProgress",
            keys: [
              { t: 0, v: 0 },
              { t: end, v: 1, easing: "easeOut" },
            ],
          },
        ],
      };
    case "stagger": {
      const ids = input.staggerLayerIds ?? [input.targetLayerId];
      const tracks = ids.flatMap((id, index) => {
        const delay = index * 0.08;
        return [
          {
            layerId: id,
            property: "transform.opacity",
            keys: [
              { t: 0, v: 0 },
              { t: delay, v: 0, easing: "step" },
              { t: Math.min(end, delay + 0.35), v: 1, easing: "easeOut" },
            ],
          },
          {
            layerId: id,
            property: "transform.y",
            keys: [
              { t: 0, v: 40 },
              { t: delay, v: 40, easing: "step" },
              { t: Math.min(end, delay + 0.35), v: 0, easing: "easeOut" },
            ],
          },
        ];
      });
      return { drivers: [], tracks };
    }
    case "camera-shake":
      return {
        drivers: [
          {
            id: `drv.${input.targetLayerId}.shake.x`,
            type: "noise",
            targetLayerId: input.targetLayerId,
            targetProperty: "transform.x",
            frequency: frequencyHz ?? 8,
            amplitude: 12 * intensity,
            seed,
          },
          {
            id: `drv.${input.targetLayerId}.shake.y`,
            type: "noise",
            targetLayerId: input.targetLayerId,
            targetProperty: "transform.y",
            frequency: frequencyHz ?? 8,
            amplitude: 10 * intensity,
            seed: seed + 17,
          },
        ],
        tracks: [],
      };
    default: {
      const neverId: never = input.recipeId;
      throw new Error(`Unknown motion recipe: ${String(neverId)}`);
    }
  }
}
