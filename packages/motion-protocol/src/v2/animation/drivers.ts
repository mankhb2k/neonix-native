import { z } from "zod";
import { MOTION_V2_LIMITS } from "../../capabilities";
import { FiniteNumberSchema, IdSchema, PropertyPathSchema } from "../common";

/** Closed procedural driver vocabulary (R6). Evaluated in Runtime IR. */
export const ProceduralDriverSchema = z.discriminatedUnion("type", [
  z
    .object({
      id: IdSchema,
      type: z.literal("oscillator"),
      targetNodeId: IdSchema,
      targetProperty: PropertyPathSchema,
      frequency: FiniteNumberSchema.positive().max(60),
      amplitude: FiniteNumberSchema,
      phase: FiniteNumberSchema.default(0),
      waveform: z.enum(["sine", "triangle", "square", "sawtooth"]).default("sine"),
    })
    .strict(),
  z
    .object({
      id: IdSchema,
      type: z.literal("noise"),
      targetNodeId: IdSchema,
      targetProperty: PropertyPathSchema,
      frequency: FiniteNumberSchema.positive().max(60),
      amplitude: FiniteNumberSchema,
      seed: FiniteNumberSchema.int().nonnegative(),
    })
    .strict(),
  z
    .object({
      id: IdSchema,
      type: z.literal("link"),
      targetNodeId: IdSchema,
      targetProperty: PropertyPathSchema,
      sourceNodeId: IdSchema,
      sourceProperty: PropertyPathSchema,
      multiplier: FiniteNumberSchema.default(1),
      offset: FiniteNumberSchema.default(0),
    })
    .strict(),
  z
    .object({
      id: IdSchema,
      type: z.literal("remap"),
      targetNodeId: IdSchema,
      targetProperty: PropertyPathSchema,
      sourceNodeId: IdSchema,
      sourceProperty: PropertyPathSchema,
      inMin: FiniteNumberSchema,
      inMax: FiniteNumberSchema,
      outMin: FiniteNumberSchema,
      outMax: FiniteNumberSchema,
    })
    .strict(),
  z
    .object({
      id: IdSchema,
      type: z.literal("clamp"),
      targetNodeId: IdSchema,
      targetProperty: PropertyPathSchema,
      sourceNodeId: IdSchema,
      sourceProperty: PropertyPathSchema,
      min: FiniteNumberSchema,
      max: FiniteNumberSchema,
    })
    .strict(),
  z
    .object({
      id: IdSchema,
      type: z.literal("wrap"),
      targetNodeId: IdSchema,
      targetProperty: PropertyPathSchema,
      sourceNodeId: IdSchema,
      sourceProperty: PropertyPathSchema,
      min: FiniteNumberSchema,
      max: FiniteNumberSchema,
    })
    .strict(),
  z
    .object({
      id: IdSchema,
      type: z.literal("quantize"),
      targetNodeId: IdSchema,
      targetProperty: PropertyPathSchema,
      sourceNodeId: IdSchema,
      sourceProperty: PropertyPathSchema,
      step: FiniteNumberSchema.positive(),
    })
    .strict(),
  z
    .object({
      id: IdSchema,
      type: z.literal("delay-follow"),
      targetNodeId: IdSchema,
      targetProperty: PropertyPathSchema,
      sourceNodeId: IdSchema,
      sourceProperty: PropertyPathSchema,
      delay: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.mediaDurationSeconds),
    })
    .strict(),
  z
    .object({
      id: IdSchema,
      type: z.literal("spring-follow"),
      targetNodeId: IdSchema,
      targetProperty: PropertyPathSchema,
      sourceNodeId: IdSchema,
      sourceProperty: PropertyPathSchema,
      stiffness: FiniteNumberSchema.positive().max(10_000),
      damping: FiniteNumberSchema.nonnegative().max(1_000),
    })
    .strict(),
  z
    .object({
      id: IdSchema,
      type: z.literal("time-remap"),
      targetNodeId: IdSchema,
      targetProperty: PropertyPathSchema,
      scale: FiniteNumberSchema.positive().max(16).default(1),
      offset: FiniteNumberSchema.default(0),
    })
    .strict(),
]);

export type ProceduralDriverV2 = z.infer<typeof ProceduralDriverSchema>;
