import { z } from "zod";
import { V2FiniteNumberSchema, V2IdSchema } from "./common";
import {
  V2ClipPathNodeSchema,
  V2SvgDefinitionTransformSchema,
  type V2SvgDefinitionNode,
} from "./clip";

/** SVG mask units. The default follows SVG/usvg: objectBoundingBox. */
export const V2MaskUnitsSchema = z.enum(["userSpaceOnUse", "objectBoundingBox"]);
export const V2MaskContentUnitsSchema = z.enum(["userSpaceOnUse", "objectBoundingBox"]);
export const V2MaskTypeSchema = z.enum(["alpha", "luminance"]);

/** A number is a user-space/unit value; an object explicitly represents an SVG percentage. */
export const V2MaskLengthSchema = z.union([
  V2FiniteNumberSchema,
  z.object({ value: V2FiniteNumberSchema, unit: z.literal("percent") }).strict(),
]);

export const V2MaskSchema = z
  .object({
    id: V2IdSchema,
    maskUnits: V2MaskUnitsSchema.default("objectBoundingBox"),
    maskContentUnits: V2MaskContentUnitsSchema.default("userSpaceOnUse"),
    maskType: V2MaskTypeSchema.default("luminance"),
    x: V2MaskLengthSchema.optional(),
    y: V2MaskLengthSchema.optional(),
    width: V2MaskLengthSchema.optional(),
    height: V2MaskLengthSchema.optional(),
    transform: V2SvgDefinitionTransformSchema.optional(),
    children: z.array(V2ClipPathNodeSchema).min(1),
  })
  .strict();

export const V2MaskListSchema = z
  .array(V2MaskSchema)
  .max(256)
  .superRefine((masks, ctx) => {
    const ids = new Set<string>();
    masks.forEach((mask, index) => {
      if (ids.has(mask.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate mask id: ${mask.id}`, path: [index, "id"] });
      ids.add(mask.id);
    });
  });

export type V2MaskLength = z.infer<typeof V2MaskLengthSchema>;
export type V2MaskUnits = z.infer<typeof V2MaskUnitsSchema>;
export type V2MaskContentUnits = z.infer<typeof V2MaskContentUnitsSchema>;
export type V2MaskType = z.infer<typeof V2MaskTypeSchema>;
export type V2Mask = z.infer<typeof V2MaskSchema>;
export type V2MaskList = z.infer<typeof V2MaskListSchema>;
export type V2MaskContentNode = V2SvgDefinitionNode;
