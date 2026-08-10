/**
 * V3 text node.
 *
 * Content reuses v2 rich text (plain | runs). `color`/`alignment` live on
 * the payload directly instead of v2's style object.
 */
import { z } from "zod";
import { MOTION_V2_LIMITS } from "../../capabilities";
import {
  TextContentSchema,
} from "../../v2/nodes/text";
import { ColorHexSchema, IdSchema, PositiveNumberSchema } from "../common";
import { NodeBaseV3Schema } from "./base";

export const TextNodeV3Schema = NodeBaseV3Schema.extend({
  type: z.literal("text"),
  payload: z
    .object({
      content: TextContentSchema,
      fontAssetId: IdSchema.optional(),
      fontSize: PositiveNumberSchema.max(MOTION_V2_LIMITS.nodeDimension),
      color: ColorHexSchema.default("#000000"),
      alignment: z.enum(["left", "center", "right"]).default("left"),
      wrap: z.enum(["none", "word", "character"]).default("word"),
      lineHeight: PositiveNumberSchema.optional(),
      letterSpacing: z.number().finite().optional(),
      maxLines: z.number().int().positive().max(64).optional(),
      overflow: z.enum(["visible", "clip", "ellipsis"]).default("visible"),
    })
    .strict(),
}).strict();
