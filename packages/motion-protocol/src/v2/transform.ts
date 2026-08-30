import { z } from "zod";
import { V2FiniteNumberSchema } from "./common";

export const V2Vec2Schema = z
  .object({ x: V2FiniteNumberSchema, y: V2FiniteNumberSchema })
  .strict();

export const V2Vec3Schema = z
  .object({
    x: V2FiniteNumberSchema,
    y: V2FiniteNumberSchema,
    z: V2FiniteNumberSchema,
  })
  .strict();

/** Canonical 4x4 matrix layout: 16 values in column-major order (WebGL/runtime). */
export const V2Mat4Schema = z.tuple([
  V2FiniteNumberSchema,
  V2FiniteNumberSchema,
  V2FiniteNumberSchema,
  V2FiniteNumberSchema,
  V2FiniteNumberSchema,
  V2FiniteNumberSchema,
  V2FiniteNumberSchema,
  V2FiniteNumberSchema,
  V2FiniteNumberSchema,
  V2FiniteNumberSchema,
  V2FiniteNumberSchema,
  V2FiniteNumberSchema,
  V2FiniteNumberSchema,
  V2FiniteNumberSchema,
  V2FiniteNumberSchema,
  V2FiniteNumberSchema,
]);

const V2TranslateOperationSchema = z
  .object({ type: z.literal("translate"), value: V2Vec3Schema })
  .strict();
const V2RotateXOperationSchema = z
  .object({ type: z.literal("rotateX"), value: V2FiniteNumberSchema })
  .strict();
const V2RotateYOperationSchema = z
  .object({ type: z.literal("rotateY"), value: V2FiniteNumberSchema })
  .strict();
const V2RotateZOperationSchema = z
  .object({ type: z.literal("rotateZ"), value: V2FiniteNumberSchema })
  .strict();
const V2ScaleOperationSchema = z
  .object({ type: z.literal("scale"), value: V2Vec3Schema })
  .strict();
const V2SkewOperationSchema = z
  .object({ type: z.literal("skew"), value: V2Vec2Schema })
  .strict();
const V2PerspectiveOperationSchema = z
  .object({ type: z.literal("perspective"), value: V2FiniteNumberSchema.positive() })
  .strict();
const V2MatrixOperationSchema = z
  .object({ type: z.literal("matrix"), value: V2Mat4Schema })
  .strict();

/** One ordered transform operation. The list order is semantically significant. */
export const V2TransformOperationSchema = z.discriminatedUnion("type", [
  V2TranslateOperationSchema,
  V2RotateXOperationSchema,
  V2RotateYOperationSchema,
  V2RotateZOperationSchema,
  V2ScaleOperationSchema,
  V2SkewOperationSchema,
  V2PerspectiveOperationSchema,
  V2MatrixOperationSchema,
]);

export const V2TransformOperationsSchema = z.array(V2TransformOperationSchema);

export const V2TransformSchema = z
  .object({
    translate: V2Vec3Schema,
    scale: V2Vec3Schema,
    rotate: V2Vec3Schema,
    skew: V2Vec2Schema,
    /** Local-unit pivot; it may be inside or outside the layer bounds. */
    anchor: V2Vec3Schema,
    /**
     * Optional ordered form. When present, operations preserve CSS transform
     * order and are the canonical transform sequence for new producers.
     * The legacy component fields remain required for V2 compatibility.
     */
    operations: V2TransformOperationsSchema.optional(),
  })
  .strict();

export type V2Transform = z.infer<typeof V2TransformSchema>;
export type V2Vec2 = z.infer<typeof V2Vec2Schema>;
export type V2Vec3 = z.infer<typeof V2Vec3Schema>;
export type V2Mat4 = z.infer<typeof V2Mat4Schema>;
export type V2TransformOperation = z.infer<typeof V2TransformOperationSchema>;
export type V2TransformOperations = z.infer<typeof V2TransformOperationsSchema>;
