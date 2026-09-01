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

/** SVG's six-value affine matrix: x'=a*x+c*y+e, y'=b*x+d*y+f. */
export const V2SvgMatrixSchema = z.tuple([
  V2FiniteNumberSchema,
  V2FiniteNumberSchema,
  V2FiniteNumberSchema,
  V2FiniteNumberSchema,
  V2FiniteNumberSchema,
  V2FiniteNumberSchema,
]);

/** Canonical 4x4 matrix layout for the motion 3D extension. */
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

const V2SvgTranslateOperationSchema = z
  .object({ type: z.literal("translate"), x: V2FiniteNumberSchema, y: V2FiniteNumberSchema })
  .strict();
const V2SvgScaleOperationSchema = z
  .object({ type: z.literal("scale"), x: V2FiniteNumberSchema, y: V2FiniteNumberSchema })
  .strict();
const V2SvgRotateOperationSchema = z
  .object({
    type: z.literal("rotate"),
    angle: V2FiniteNumberSchema,
    center: V2Vec2Schema.optional(),
  })
  .strict();
const V2SvgSkewXOperationSchema = z
  .object({ type: z.literal("skewX"), angle: V2FiniteNumberSchema })
  .strict();
const V2SvgSkewYOperationSchema = z
  .object({ type: z.literal("skewY"), angle: V2FiniteNumberSchema })
  .strict();
const V2SvgMatrixOperationSchema = z
  .object({ type: z.literal("matrix"), values: V2SvgMatrixSchema })
  .strict();

export const V2SvgTransformOperationSchema = z.discriminatedUnion("type", [
  V2SvgTranslateOperationSchema,
  V2SvgScaleOperationSchema,
  V2SvgRotateOperationSchema,
  V2SvgSkewXOperationSchema,
  V2SvgSkewYOperationSchema,
  V2SvgMatrixOperationSchema,
]);

/**
 * Motion-only transform operations. They are explicit extensions so an SVG
 * transform list remains identifiable and exportable without guessing which
 * values are 3D.
 */
export const V2TransformExtensionOperationSchema = z.discriminatedUnion("name", [
  z.object({ type: z.literal("extension"), name: z.literal("motion.translate3d"), value: V2Vec3Schema }).strict(),
  z.object({ type: z.literal("extension"), name: z.literal("motion.scale3d"), value: V2Vec3Schema }).strict(),
  z.object({ type: z.literal("extension"), name: z.literal("motion.rotateX"), value: V2FiniteNumberSchema }).strict(),
  z.object({ type: z.literal("extension"), name: z.literal("motion.rotateY"), value: V2FiniteNumberSchema }).strict(),
  z.object({ type: z.literal("extension"), name: z.literal("motion.rotateZ"), value: V2FiniteNumberSchema }).strict(),
  z.object({ type: z.literal("extension"), name: z.literal("motion.perspective"), value: V2FiniteNumberSchema.positive() }).strict(),
  z.object({ type: z.literal("extension"), name: z.literal("motion.matrix4"), value: V2Mat4Schema }).strict(),
]);

export const V2TransformOperationSchema = z.union([
  V2SvgTransformOperationSchema,
  V2TransformExtensionOperationSchema,
]);

/** Transform-level extensions that are not ordered operations. */
export const V2TransformExtensionsSchema = z
  .object({
    /** Local pivot applied around the complete ordered operation list. */
    anchor: V2Vec3Schema.optional(),
  })
  .strict();

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
     * Ordered SVG transform list. The list order is semantically significant.
     * The component fields remain required for the current layer contract and
     * are used only when this list is absent.
     */
    operations: V2TransformOperationsSchema.optional(),
    /** Motion extension metadata, currently the local 3D pivot. */
    extensions: V2TransformExtensionsSchema.optional(),
  })
  .strict();

export type V2Transform = z.infer<typeof V2TransformSchema>;
export type V2Vec2 = z.infer<typeof V2Vec2Schema>;
export type V2Vec3 = z.infer<typeof V2Vec3Schema>;
export type V2Mat4 = z.infer<typeof V2Mat4Schema>;
export type V2SvgMatrix = z.infer<typeof V2SvgMatrixSchema>;
export type V2SvgTransformOperation = z.infer<typeof V2SvgTransformOperationSchema>;
export type V2TransformExtensionOperation = z.infer<typeof V2TransformExtensionOperationSchema>;
export type V2TransformOperation = z.infer<typeof V2TransformOperationSchema>;
export type V2TransformOperations = z.infer<typeof V2TransformOperationsSchema>;
export type V2TransformExtensions = z.infer<typeof V2TransformExtensionsSchema>;
