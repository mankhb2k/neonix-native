import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import {
  FiniteNumberSchema,
  IdSchema,
  LocaleIdentifierSchema,
} from "../common";
import { ColorHexSchema } from "../../v1/common";
import { KeyframeEasingNamedSchema } from "../../v1/animation/easing";
import { normalizeTextPayloadInput as normalizeTextPayloadInputV1 } from "../../v1/layers/text-content";
import { LayerBaseSchema } from "./base";
import { PaintStyleSchema } from "./paint";

const TextAnimatorSchema = z
  .object({
    id: IdSchema,
    unit: z.enum(["grapheme", "word", "line"]),
    locale: LocaleIdentifierSchema.optional(),
    selector: z
      .object({
        start: FiniteNumberSchema.min(0).max(1),
        end: FiniteNumberSchema.min(0).max(1),
      })
      .strict(),
    startTime: FiniteNumberSchema.nonnegative().max(
      MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
    ),
    duration: FiniteNumberSchema.positive().max(
      MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
    ),
    stagger: FiniteNumberSchema.nonnegative().max(
      MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
    ),
    easing: KeyframeEasingNamedSchema.default("easeOut"),
    properties: z
      .object({
        offsetX: FiniteNumberSchema.optional(),
        offsetY: FiniteNumberSchema.optional(),
        rotation: FiniteNumberSchema.optional(),
        scale: FiniteNumberSchema.nonnegative()
          .max(MOTION_PROTOCOL_LIMITS.transformScale)
          .optional(),
        opacity: FiniteNumberSchema.min(0).max(1).optional(),
        fill: z.string().min(1).optional(),
      })
      .strict(),
  })
  .strict()
  .superRefine((animator, context) => {
    if (animator.selector.start > animator.selector.end)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["selector", "end"],
        message: "Text Animator selector end must be >= start",
      });
    if (Object.keys(animator.properties).length === 0)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["properties"],
        message: "Text Animator requires at least one property",
      });
  });

export {
  segmentTextUnits,
  getTextPayloadPlain,
  setTextPayloadPlain,
} from "../../v1/layers/text-content";

export type TextLayerPayload = {
  text: string;
  fontAssetId?: string;
  fontSize: number;
  color?: string;
  alignment?: "left" | "center" | "right";
  wrap?: "none" | "word" | "character";
  lineHeight?: number;
  letterSpacing?: number;
  maxLines?: number;
  overflow?: "visible" | "clip" | "ellipsis";
  counterProgress?: number;
  fitText?: { minFontSize: number; maxFontSize: number };
};

export function normalizeTextPayloadInput(raw: unknown): unknown {
  const normalized = normalizeTextPayloadInputV1(raw);
  if (
    !normalized ||
    typeof normalized !== "object" ||
    Array.isArray(normalized)
  ) {
    return normalized;
  }
  const payload = normalized as Record<string, unknown>;
  if (payload.align != null && payload.alignment == null) {
    payload.alignment = payload.align;
  }
  delete payload.align;
  return payload;
}

const TextPayloadFieldsSchema = z
  .object({
    text: z.string(),
    fontAssetId: IdSchema.optional(),
    fontSize: FiniteNumberSchema.positive().max(
      MOTION_PROTOCOL_LIMITS.layerDimension,
    ),
    color: ColorHexSchema.optional(),
    alignment: z.enum(["left", "center", "right"]).optional(),
    wrap: z.enum(["none", "word", "character"]).optional(),
    lineHeight: FiniteNumberSchema.positive()
      .max(MOTION_PROTOCOL_LIMITS.layerDimension)
      .optional(),
    letterSpacing: FiniteNumberSchema.optional(),
    maxLines: FiniteNumberSchema.int().positive().optional(),
    overflow: z.enum(["visible", "clip", "ellipsis"]).optional(),
    counterProgress: FiniteNumberSchema.min(0).max(1).optional(),
    fitText: z
      .object({
        minFontSize: FiniteNumberSchema.positive().max(
          MOTION_PROTOCOL_LIMITS.layerDimension,
        ),
        maxFontSize: FiniteNumberSchema.positive().max(
          MOTION_PROTOCOL_LIMITS.layerDimension,
        ),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.fitText && val.fitText.minFontSize >= val.fitText.maxFontSize) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `fitText.minFontSize (${val.fitText.minFontSize}) must be < maxFontSize (${val.fitText.maxFontSize})`,
        path: ["fitText", "minFontSize"],
      });
    }
  });

export const TextPayloadSchema = z.preprocess(
  normalizeTextPayloadInput,
  TextPayloadFieldsSchema,
);

export const TextLayerSchema = LayerBaseSchema.extend({
  type: z.literal("text"),
  textAnimator: TextAnimatorSchema.optional(),
  payload: TextPayloadSchema,
  style: PaintStyleSchema.optional(),
}).strict();
