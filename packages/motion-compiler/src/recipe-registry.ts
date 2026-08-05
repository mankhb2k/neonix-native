/**
 * Deterministic motion recipe registry (R6).
 * Recipes bake to clips/tracks and/or procedural drivers — unknown id throws.
 */

export const MOTION_RECIPE_IDS = [
  "wiggle",
  "float",
  "pulse",
  "follow",
  "counter",
  "stagger",
  "camera-shake",
] as const;

export type MotionRecipeId = (typeof MOTION_RECIPE_IDS)[number];

export function isMotionRecipe(id: string): id is MotionRecipeId {
  return (MOTION_RECIPE_IDS as readonly string[]).includes(id);
}

export type RecipeBakeInput = {
  recipeId: MotionRecipeId;
  sceneId: string;
  targetNodeId: string;
  duration: number;
  seed?: number;
  intensity?: number;
  /** For stagger: sibling node ids in order. */
  staggerNodeIds?: string[];
  /** For follow: source node to link from. */
  sourceNodeId?: string;
};

export type BakedRecipe = {
  drivers: Array<Record<string, unknown>>;
  tracks: Array<{
    targetId: string;
    property: string;
    keys: Array<{ t: number; v: number; easing?: string | Record<string, unknown> }>;
  }>;
};

export function bakeMotionRecipe(input: RecipeBakeInput): BakedRecipe {
  const intensity = input.intensity ?? 1;
  const seed = input.seed ?? 1;
  const end = Math.max(0.01, input.duration);

  switch (input.recipeId) {
    case "wiggle":
      return {
        drivers: [
          {
            id: `drv.${input.targetNodeId}.wiggle`,
            type: "noise",
            targetNodeId: input.targetNodeId,
            targetProperty: "transform.rotation",
            frequency: 3,
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
            id: `drv.${input.targetNodeId}.float`,
            type: "oscillator",
            targetNodeId: input.targetNodeId,
            targetProperty: "transform.y",
            frequency: 0.6,
            amplitude: 24 * intensity,
            phase: 0,
            waveform: "sine",
          },
        ],
        tracks: [],
      };
    case "pulse":
      return {
        drivers: [
          {
            id: `drv.${input.targetNodeId}.pulse`,
            type: "oscillator",
            targetNodeId: input.targetNodeId,
            targetProperty: "transform.scaleX",
            frequency: 1.2,
            amplitude: 0.08 * intensity,
            waveform: "sine",
          },
        ],
        tracks: [
          {
            targetId: input.targetNodeId,
            property: "transform.scaleY",
            keys: [
              { t: 0, v: 1 },
              { t: end, v: 1, easing: "linear" },
            ],
          },
        ],
      };
    case "follow": {
      if (!input.sourceNodeId) throw new Error("follow recipe requires sourceNodeId");
      return {
        drivers: [
          {
            id: `drv.${input.targetNodeId}.follow`,
            type: "spring-follow",
            targetNodeId: input.targetNodeId,
            targetProperty: "transform.x",
            sourceNodeId: input.sourceNodeId,
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
            targetId: input.targetNodeId,
            property: "payload.counterProgress",
            keys: [
              { t: 0, v: 0 },
              { t: end, v: 1, easing: "easeOut" },
            ],
          },
        ],
      };
    case "stagger": {
      const ids = input.staggerNodeIds ?? [input.targetNodeId];
      const tracks = ids.flatMap((nodeId, index) => {
        const delay = index * 0.08;
        return [
          {
            targetId: nodeId,
            property: "transform.opacity",
            keys: [
              { t: 0, v: 0 },
              { t: delay, v: 0, easing: "step" },
              { t: Math.min(end, delay + 0.35), v: 1, easing: "easeOut" },
            ],
          },
          {
            targetId: nodeId,
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
            id: `drv.${input.targetNodeId}.shake.x`,
            type: "noise",
            targetNodeId: input.targetNodeId,
            targetProperty: "transform.x",
            frequency: 8,
            amplitude: 12 * intensity,
            seed,
          },
          {
            id: `drv.${input.targetNodeId}.shake.y`,
            type: "noise",
            targetNodeId: input.targetNodeId,
            targetProperty: "transform.y",
            frequency: 8,
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
