/**
 * Payload chữ V1 — một đoạn, một style. Không rich text / runs.
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import { FiniteNumberSchema, IdSchema, ColorHexSchema } from "../common";

export function segmentTextUnits(
  text: string,
  unit: "grapheme" | "word" | "line",
  locale = "vi",
): string[] {
  if (unit === "line") return text.split(/\r?\n/);
  const segments = [
    ...new Intl.Segmenter(locale, { granularity: unit }).segment(text),
  ];
  return unit === "word"
    ? segments
        .map((segment) => segment.segment)
        .filter((segment) => segment.trim().length > 0)
    : segments.map((segment) => segment.segment);
}

export type TextLayerPayload = {
  text: string;
  fontAssetId?: string;
  fontSize: number;
  color: string;
  alignment: "left" | "center" | "right";
  wrap: "none" | "word" | "character";
  lineHeight?: number;
  letterSpacing?: number;
  maxLines?: number;
  overflow: "visible" | "clip" | "ellipsis";
};

export function getTextPayloadPlain(payload: {
  text?: string;
}): string {
  return typeof payload.text === "string" ? payload.text : "";
}

export function setTextPayloadPlain<T extends { text?: string }>(
  payload: T,
  text: string,
): T & { text: string } {
  return { ...payload, text };
}

/**
 * Lift legacy `{ content: { kind: "plain", text } }` to `{ text }`.
 * Runs / content.kind khác plain bị giữ lại để schema reject.
 */
export function normalizeTextPayloadInput(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const payload = { ...(raw as Record<string, unknown>) };
  const content = payload.content;
  if (
    content !== null &&
    typeof content === "object" &&
    !Array.isArray(content) &&
    (content as Record<string, unknown>).kind === "plain" &&
    typeof (content as Record<string, unknown>).text === "string"
  ) {
    if (typeof payload.text !== "string") {
      payload.text = (content as Record<string, unknown>).text;
    }
    delete payload.content;
  }
  return payload;
}

export const TextPayloadSchema = z.preprocess(
  normalizeTextPayloadInput,
  z
    .object({
      text: z.string(),
      fontAssetId: IdSchema.optional(),
      fontSize: FiniteNumberSchema.positive().max(
        MOTION_PROTOCOL_LIMITS.layerDimension,
      ),
      color: ColorHexSchema.default("#000000"),
      alignment: z.enum(["left", "center", "right"]).default("left"),
      wrap: z.enum(["none", "word", "character"]).default("word"),
      lineHeight: FiniteNumberSchema.positive()
        .max(MOTION_PROTOCOL_LIMITS.layerDimension)
        .optional(),
      letterSpacing: FiniteNumberSchema.optional(),
      maxLines: FiniteNumberSchema.int().positive().optional(),
      overflow: z.enum(["visible", "clip", "ellipsis"]).default("clip"),
    })
    .strict(),
);
