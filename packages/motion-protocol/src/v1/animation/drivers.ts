/**
 * Driver thủ tục V1 — vocabulary đóng, evaluate ở Runtime IR.
 */

import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import { FiniteNumberSchema, IdSchema, PropertyPathSchema } from "../common";

export const ProceduralDriverSchema = z
  .discriminatedUnion("type", [
    z
      .object({
        id: IdSchema,
        type: z.literal("oscillator"),
        targetLayerId: IdSchema,
        targetProperty: PropertyPathSchema,
        frequency: FiniteNumberSchema.positive().max(60),
        amplitude: FiniteNumberSchema,
        phase: FiniteNumberSchema.default(0),
        waveform: z
          .enum(["sine", "triangle", "square", "sawtooth"])
          .default("sine"),
      })
      .strict(),
    z
      .object({
        id: IdSchema,
        type: z.literal("noise"),
        targetLayerId: IdSchema,
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
        targetLayerId: IdSchema,
        targetProperty: PropertyPathSchema,
        sourceLayerId: IdSchema,
        sourceProperty: PropertyPathSchema,
        multiplier: FiniteNumberSchema.default(1),
        offset: FiniteNumberSchema.default(0),
      })
      .strict(),
    z
      .object({
        id: IdSchema,
        type: z.literal("remap"),
        targetLayerId: IdSchema,
        targetProperty: PropertyPathSchema,
        sourceLayerId: IdSchema,
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
        targetLayerId: IdSchema,
        targetProperty: PropertyPathSchema,
        sourceLayerId: IdSchema,
        sourceProperty: PropertyPathSchema,
        min: FiniteNumberSchema,
        max: FiniteNumberSchema,
      })
      .strict(),
    z
      .object({
        id: IdSchema,
        type: z.literal("wrap"),
        targetLayerId: IdSchema,
        targetProperty: PropertyPathSchema,
        sourceLayerId: IdSchema,
        sourceProperty: PropertyPathSchema,
        min: FiniteNumberSchema,
        max: FiniteNumberSchema,
      })
      .strict(),
    z
      .object({
        id: IdSchema,
        type: z.literal("quantize"),
        targetLayerId: IdSchema,
        targetProperty: PropertyPathSchema,
        sourceLayerId: IdSchema,
        sourceProperty: PropertyPathSchema,
        step: FiniteNumberSchema.positive(),
      })
      .strict(),
    z
      .object({
        id: IdSchema,
        type: z.literal("delay-follow"),
        targetLayerId: IdSchema,
        targetProperty: PropertyPathSchema,
        sourceLayerId: IdSchema,
        sourceProperty: PropertyPathSchema,
        delay: FiniteNumberSchema.nonnegative().max(
          MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
        ),
      })
      .strict(),
    z
      .object({
        id: IdSchema,
        type: z.literal("spring-follow"),
        targetLayerId: IdSchema,
        targetProperty: PropertyPathSchema,
        sourceLayerId: IdSchema,
        sourceProperty: PropertyPathSchema,
        stiffness: FiniteNumberSchema.positive().max(10_000),
        damping: FiniteNumberSchema.nonnegative().max(1_000),
      })
      .strict(),
    z
      .object({
        id: IdSchema,
        type: z.literal("time-remap"),
        targetLayerId: IdSchema,
        targetProperty: PropertyPathSchema,
        scale: FiniteNumberSchema.positive().max(16).default(1),
        offset: FiniteNumberSchema.default(0),
      })
      .strict(),
  ])
  .superRefine((val, ctx) => {
    // M12: remap driver — inMin < inMax, outMin < outMax
    if (val.type === "remap") {
      if (val.inMin >= val.inMax) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `inMin (${val.inMin}) must be < inMax (${val.inMax})`,
          path: ["inMin"],
        });
      }
      if (val.outMin >= val.outMax) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `outMin (${val.outMin}) must be < outMax (${val.outMax})`,
          path: ["outMin"],
        });
      }
    }
    // M13: clamp & wrap drivers — min < max
    if (val.type === "clamp" || val.type === "wrap") {
      if (val.min >= val.max) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `min (${val.min}) must be < max (${val.max})`,
          path: ["min"],
        });
      }
    }
  });

export type ProceduralDriver = z.infer<typeof ProceduralDriverSchema>;
