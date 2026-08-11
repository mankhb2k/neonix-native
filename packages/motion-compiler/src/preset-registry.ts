/**
 * Typed motion preset registry — finite entrance/exit/emphasis expand to tracks.
 * Ambient motion remains in recipe-registry (drivers).
 */

import { z } from "zod";
import {
  KeyframeEasingSchema,
  MOTION_PROTOCOL_LIMITS,
} from "@motionvideo/motion-protocol";

type KeyframeEasing = z.infer<typeof KeyframeEasingSchema>;

export const DirectionalPresetParamsSchema = z
  .object({
    distance: z
      .number()
      .finite()
      .min(0)
      .max(MOTION_PROTOCOL_LIMITS.presetDistance)
      .optional(),
    easing: KeyframeEasingSchema.optional(),
    overshoot: z
      .number()
      .finite()
      .min(0)
      .max(MOTION_PROTOCOL_LIMITS.presetOvershoot)
      .optional(),
  })
  .strict();

export const ScalePresetParamsSchema = z
  .object({
    fromScale: z
      .number()
      .finite()
      .min(0)
      .max(MOTION_PROTOCOL_LIMITS.transformScale)
      .optional(),
    easing: KeyframeEasingSchema.optional(),
    overshoot: z
      .number()
      .finite()
      .min(0)
      .max(MOTION_PROTOCOL_LIMITS.presetOvershoot)
      .optional(),
  })
  .strict();

export const EmptyPresetParamsSchema = z.object({}).strict();

export type DirectionalPresetParams = z.infer<
  typeof DirectionalPresetParamsSchema
>;
export type ScalePresetParams = z.infer<typeof ScalePresetParamsSchema>;

export type RuntimeTrackBake = {
  targetId: string;
  property: string;
  keys: Array<{ t: number; v: number; easing?: KeyframeEasing }>;
};

export type PresetExpandInput<TParams> = {
  nodeId: string;
  start: number;
  end: number;
  transform: {
    x: number;
    y: number;
    opacity: number;
    scaleX: number;
    scaleY: number;
  };
  params: TParams;
};

export type MotionPresetDefinition<TParams> = {
  id: string;
  version: number;
  category: "entrance" | "exit" | "emphasis";
  paramsSchema: z.ZodType<TParams>;
  compatibleNodeTypes: readonly string[] | "all-visual";
  expand(input: PresetExpandInput<TParams>): RuntimeTrackBake[];
};

function easingOf(
  params: { easing?: KeyframeEasing },
  fallback: KeyframeEasing = "easeOut",
): KeyframeEasing {
  return params.easing ?? fallback;
}

function opacityTrack(
  nodeId: string,
  start: number,
  end: number,
  from: number,
  to: number,
  easing: KeyframeEasing,
): RuntimeTrackBake {
  return {
    targetId: nodeId,
    property: "transform.opacity",
    keys: [
      { t: start, v: from },
      { t: end, v: to, easing },
    ],
  };
}

function axisTrack(
  nodeId: string,
  property: "transform.x" | "transform.y",
  start: number,
  end: number,
  from: number,
  to: number,
  easing: KeyframeEasing,
): RuntimeTrackBake {
  return {
    targetId: nodeId,
    property,
    keys: [
      { t: start, v: from },
      { t: end, v: to, easing },
    ],
  };
}

function scaleTracks(
  nodeId: string,
  start: number,
  end: number,
  from: number,
  toX: number,
  toY: number,
  easing: KeyframeEasing,
): RuntimeTrackBake[] {
  return [
    {
      targetId: nodeId,
      property: "transform.scaleX",
      keys: [
        { t: start, v: from },
        { t: end, v: toX, easing },
      ],
    },
    {
      targetId: nodeId,
      property: "transform.scaleY",
      keys: [
        { t: start, v: from },
        { t: end, v: toY, easing },
      ],
    },
  ];
}

function directionalEntrance(
  id: string,
  axis: "x" | "y",
  sign: 1 | -1,
  defaultDistance: number,
): MotionPresetDefinition<DirectionalPresetParams> {
  return {
    id,
    version: 1,
    category: "entrance",
    paramsSchema: DirectionalPresetParamsSchema,
    compatibleNodeTypes: "all-visual",
    expand({ nodeId, start, end, transform, params }) {
      const distance = params.distance ?? defaultDistance;
      const easing = easingOf(params);
      const rest = axis === "x" ? transform.x : transform.y;
      const from = rest + sign * distance;
      return [
        opacityTrack(nodeId, start, end, 0, transform.opacity, easing),
        axisTrack(
          nodeId,
          axis === "x" ? "transform.x" : "transform.y",
          start,
          end,
          from,
          rest,
          easing,
        ),
      ];
    },
  };
}

function directionalExit(
  id: string,
  axis: "x" | "y",
  sign: 1 | -1,
  defaultDistance: number,
): MotionPresetDefinition<DirectionalPresetParams> {
  return {
    id,
    version: 1,
    category: "exit",
    paramsSchema: DirectionalPresetParamsSchema,
    compatibleNodeTypes: "all-visual",
    expand({ nodeId, start, end, transform, params }) {
      const distance = params.distance ?? defaultDistance;
      const easing = easingOf(params, "easeIn");
      const rest = axis === "x" ? transform.x : transform.y;
      return [
        opacityTrack(nodeId, start, end, transform.opacity, 0, easing),
        axisTrack(
          nodeId,
          axis === "x" ? "transform.x" : "transform.y",
          start,
          end,
          rest,
          rest + sign * distance,
          easing,
        ),
      ];
    },
  };
}

const PRESETS: MotionPresetDefinition<unknown>[] = [
  {
    id: "fade-in",
    version: 1,
    category: "entrance",
    paramsSchema: DirectionalPresetParamsSchema,
    compatibleNodeTypes: "all-visual",
    expand({ nodeId, start, end, transform, params }) {
      return [
        opacityTrack(
          nodeId,
          start,
          end,
          0,
          transform.opacity,
          easingOf(params as DirectionalPresetParams),
        ),
      ];
    },
  },
  directionalEntrance("fade-up", "y", 1, 48),
  directionalEntrance("fade-down", "y", -1, 48),
  directionalEntrance("fade-left", "x", 1, 48),
  directionalEntrance("fade-right", "x", -1, 48),
  directionalEntrance("slide-up", "y", 1, 120),
  directionalEntrance("slide-left", "x", 1, 120),
  directionalEntrance("slide-right", "x", -1, 120),
  {
    id: "scale-in",
    version: 1,
    category: "entrance",
    paramsSchema: ScalePresetParamsSchema,
    compatibleNodeTypes: "all-visual",
    expand({ nodeId, start, end, transform, params }) {
      const p = params as ScalePresetParams;
      const from = p.fromScale ?? 0.65;
      const easing = easingOf(p);
      return [
        opacityTrack(nodeId, start, end, 0, transform.opacity, easing),
        ...scaleTracks(
          nodeId,
          start,
          end,
          from,
          transform.scaleX,
          transform.scaleY,
          easing,
        ),
      ];
    },
  },
  {
    id: "zoom-in",
    version: 1,
    category: "entrance",
    paramsSchema: ScalePresetParamsSchema,
    compatibleNodeTypes: "all-visual",
    expand({ nodeId, start, end, transform, params }) {
      const p = params as ScalePresetParams;
      const from = p.fromScale ?? 0.65;
      const easing = easingOf(p);
      return [
        opacityTrack(nodeId, start, end, 0, transform.opacity, easing),
        ...scaleTracks(
          nodeId,
          start,
          end,
          from,
          transform.scaleX,
          transform.scaleY,
          easing,
        ),
      ];
    },
  },
  {
    id: "pop",
    version: 1,
    category: "entrance",
    paramsSchema: ScalePresetParamsSchema,
    compatibleNodeTypes: "all-visual",
    expand({ nodeId, start, end, transform, params }) {
      const p = params as ScalePresetParams;
      const from = p.fromScale ?? 0.65;
      const easing = easingOf(p, "spring");
      return [
        opacityTrack(nodeId, start, end, 0, transform.opacity, easing),
        ...scaleTracks(
          nodeId,
          start,
          end,
          from,
          transform.scaleX,
          transform.scaleY,
          easing,
        ),
      ];
    },
  },
  {
    id: "counter",
    version: 1,
    category: "emphasis",
    paramsSchema: EmptyPresetParamsSchema,
    compatibleNodeTypes: ["text"],
    expand({ nodeId, start, end }) {
      return [
        {
          targetId: nodeId,
          property: "payload.counterProgress",
          keys: [
            { t: start, v: 0 },
            { t: end, v: 1, easing: "easeOut" },
          ],
        },
      ];
    },
  },
  {
    id: "fade-out",
    version: 1,
    category: "exit",
    paramsSchema: DirectionalPresetParamsSchema,
    compatibleNodeTypes: "all-visual",
    expand({ nodeId, start, end, transform, params }) {
      return [
        opacityTrack(
          nodeId,
          start,
          end,
          transform.opacity,
          0,
          easingOf(params as DirectionalPresetParams, "easeIn"),
        ),
      ];
    },
  },
  directionalExit("fade-down-out", "y", 1, 48),
  directionalExit("slide-left-out", "x", -1, 120),
  directionalExit("slide-right-out", "x", 1, 120),
  {
    id: "scale-out",
    version: 1,
    category: "exit",
    paramsSchema: ScalePresetParamsSchema,
    compatibleNodeTypes: "all-visual",
    expand({ nodeId, start, end, transform, params }) {
      const p = params as ScalePresetParams;
      const to = p.fromScale ?? 0.65;
      const easing = easingOf(p, "easeIn");
      return [
        opacityTrack(nodeId, start, end, transform.opacity, 0, easing),
        ...scaleTracks(nodeId, start, end, transform.scaleX, to, to, easing),
      ];
    },
  },
  {
    id: "zoom-out",
    version: 1,
    category: "exit",
    paramsSchema: ScalePresetParamsSchema,
    compatibleNodeTypes: "all-visual",
    expand({ nodeId, start, end, transform, params }) {
      const p = params as ScalePresetParams;
      const to = p.fromScale ?? 0.35;
      const easing = easingOf(p, "easeIn");
      return [
        opacityTrack(nodeId, start, end, transform.opacity, 0, easing),
        ...scaleTracks(nodeId, start, end, transform.scaleX, to, to, easing),
      ];
    },
  },
  {
    id: "bounce",
    version: 1,
    category: "emphasis",
    paramsSchema: DirectionalPresetParamsSchema,
    compatibleNodeTypes: "all-visual",
    expand({ nodeId, start, end, transform, params }) {
      const distance = (params as DirectionalPresetParams).distance ?? 24;
      const mid = start + (end - start) * 0.5;
      const easing = easingOf(params as DirectionalPresetParams, "easeOut");
      return [
        {
          targetId: nodeId,
          property: "transform.y",
          keys: [
            { t: start, v: transform.y },
            { t: mid, v: transform.y - distance, easing },
            { t: end, v: transform.y, easing: "easeIn" },
          ],
        },
      ];
    },
  },
  {
    id: "flash",
    version: 1,
    category: "emphasis",
    paramsSchema: EmptyPresetParamsSchema,
    compatibleNodeTypes: "all-visual",
    expand({ nodeId, start, end, transform }) {
      const mid = start + (end - start) * 0.5;
      return [
        {
          targetId: nodeId,
          property: "transform.opacity",
          keys: [
            { t: start, v: transform.opacity },
            {
              t: mid,
              v: Math.min(1, transform.opacity + 0.35),
              easing: "easeOut",
            },
            { t: end, v: transform.opacity, easing: "easeIn" },
          ],
        },
      ];
    },
  },
  {
    id: "shake-hit",
    version: 1,
    category: "emphasis",
    paramsSchema: DirectionalPresetParamsSchema,
    compatibleNodeTypes: "all-visual",
    expand({ nodeId, start, end, transform, params }) {
      const distance = (params as DirectionalPresetParams).distance ?? 12;
      const q1 = start + (end - start) * 0.25;
      const q2 = start + (end - start) * 0.5;
      const q3 = start + (end - start) * 0.75;
      return [
        {
          targetId: nodeId,
          property: "transform.x",
          keys: [
            { t: start, v: transform.x },
            { t: q1, v: transform.x + distance },
            { t: q2, v: transform.x - distance },
            { t: q3, v: transform.x + distance * 0.5 },
            { t: end, v: transform.x },
          ],
        },
      ];
    },
  },
];

const BY_ID = new Map(PRESETS.map((preset) => [preset.id, preset]));

export const COMPILED_PRESET_IDS = Object.freeze(
  PRESETS.map((preset) => preset.id),
);

export type CompiledPresetId = (typeof COMPILED_PRESET_IDS)[number];

export function isCompiledPreset(
  presetId: string,
): presetId is CompiledPresetId {
  return BY_ID.has(presetId);
}

export function getMotionPreset(
  presetId: string,
): MotionPresetDefinition<unknown> | undefined {
  return BY_ID.get(presetId);
}

export function parsePresetParams(
  presetId: string,
  params: Record<string, unknown> | undefined,
): { ok: true; params: unknown } | { ok: false; message: string } {
  const def = BY_ID.get(presetId);
  if (!def) return { ok: false, message: `Unknown preset: ${presetId}` };
  const parsed = def.paramsSchema.safeParse(params ?? {});
  if (!parsed.success) {
    return {
      ok: false,
      message: `Invalid params for preset ${presetId}: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
    };
  }
  return { ok: true, params: parsed.data };
}

export function expandMotionPreset(input: {
  presetId: string;
  nodeId: string;
  start: number;
  end: number;
  transform: PresetExpandInput<unknown>["transform"];
  params?: Record<string, unknown>;
}): RuntimeTrackBake[] {
  const def = BY_ID.get(input.presetId);
  if (!def) throw new Error(`Unknown preset: ${input.presetId}`);
  const parsed = parsePresetParams(input.presetId, input.params);
  if (!parsed.ok) throw new Error(parsed.message);
  return def.expand({
    nodeId: input.nodeId,
    start: input.start,
    end: input.end,
    transform: input.transform,
    params: parsed.params,
  });
}

/** Document ownership when IDs overlap preset vs recipe surfaces. */
export const PRESET_RECIPE_OWNERSHIP = {
  counter:
    "both — preset is finite progress bake; recipe is driver/track recipe API",
  stagger: "recipe-only",
} as const;
