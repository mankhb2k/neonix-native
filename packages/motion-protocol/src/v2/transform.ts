import { z } from "zod";
import { V2FiniteNumberSchema } from "./common";

const Vec2Schema = z
  .object({ x: V2FiniteNumberSchema, y: V2FiniteNumberSchema })
  .strict();

const Vec3Schema = z
  .object({
    x: V2FiniteNumberSchema,
    y: V2FiniteNumberSchema,
    z: V2FiniteNumberSchema,
  })
  .strict();

export const V2TransformSchema = z
  .object({
    translate: Vec3Schema,
    scale: Vec3Schema,
    rotate: Vec3Schema,
    skew: Vec2Schema,
    /** Local-unit pivot; it may be inside or outside the layer bounds. */
    anchor: Vec3Schema,
  })
  .strict();

export type V2Transform = z.infer<typeof V2TransformSchema>;
