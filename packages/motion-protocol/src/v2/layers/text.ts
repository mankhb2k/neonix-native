import { z } from "zod";
import {
  V2ColorSchema,
  V2FiniteNumberSchema,
  V2IdSchema,
  V2PositiveNumberSchema,
} from "../common";
import { V2LayerBaseSchema } from "./base";
import { V2EffectListSchema } from "../effects";

/**
 * Task 10 MVP deliberately permits one deterministic layout surface only.
 * Word wrapping, clipping, RTL, variable axes, and rich text need separate
 * certification tickets after single-style text parity is locked.
 */
export const V2TextLayerSchema = V2LayerBaseSchema.extend({
  type: z.literal("text"),
  effects: V2EffectListSchema.optional(),
  payload: z
    .object({
      text: z.string().refine(
        (value) => value === value.normalize("NFC"),
        "Text V2 content must be NFC normalized",
      ),
      fontAssetId: V2IdSchema,
      fontSize: V2PositiveNumberSchema,
      lineHeight: V2PositiveNumberSchema,
      letterSpacing: V2FiniteNumberSchema,
      align: z.enum(["left", "center", "right"]),
      verticalAlign: z.enum(["top", "middle", "bottom"]),
      wrap: z.literal("none"),
      overflow: z.literal("visible"),
      direction: z.literal("ltr"),
      language: z.string().trim().min(1).max(35),
    })
    .strict(),
  style: z
    .object({
      fill: V2ColorSchema,
    })
    .strict(),
}).strict();

export type V2TextLayer = z.infer<typeof V2TextLayerSchema>;
