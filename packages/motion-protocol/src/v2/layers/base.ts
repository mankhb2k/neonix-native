import { z } from "zod";
import {
  V2FiniteNumberSchema,
  V2IdSchema,
  V2NonNegativeNumberSchema,
  V2PositiveNumberSchema,
} from "../common";
import { V2TimingSchema } from "../timing";
import { V2TransformSchema } from "../transform";

export const V2FrameSchema = z
  .object({
    width: V2PositiveNumberSchema,
    height: V2PositiveNumberSchema,
  })
  .strict();

export const V2LayerBaseSchema = z
  .object({
    id: V2IdSchema,
    parentLayerId: V2IdSchema.nullable(),
    zIndex: V2NonNegativeNumberSchema.int(),
    frame: V2FrameSchema,
    transform: V2TransformSchema,
    opacity: V2FiniteNumberSchema.min(0).max(100),
    timing: V2TimingSchema,
  })
  .strict();

export type V2Frame = z.infer<typeof V2FrameSchema>;
