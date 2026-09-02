import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";
import { PREVIEW_LAB_CASES } from "./preview-lab";

export type SkiaPreviewFixture = {
  id: string;
  label: string;
  purpose: string;
  project: MotionProtocolV2;
  expected: readonly string[];
  svgReference: string;
};

const sourceById = new Map(PREVIEW_LAB_CASES.map((item) => [item.id, item]));

function fixture(id: string, purpose: string, expected: readonly string[]): SkiaPreviewFixture {
  const source = sourceById.get(id);
  if (!source) throw new Error(`Missing Skia preview source fixture: ${id}`);
  return { id, label: source.label, purpose, project: source.project, expected, svgReference: `/preview/skia/${id}.svg` };
}

/** Dedicated Skia parity fixtures. The project payload remains Protocol V2;
 * compiler/runtime are intentionally exercised by the lab for every case. */
export const SKIA_PREVIEW_CASES: readonly SkiaPreviewFixture[] = [
  fixture("path.geometry.cubic", "Closed cubic contour with solid fill.", ["drawPath", "cubic", "fill"]),
  fixture("path.geometry.line", "Open line contour with basic stroke.", ["drawPath", "line", "stroke"]),
  fixture("path.geometry.open-contour", "Open contour with cubic segment and stroke.", ["drawPath", "open-contour", "stroke"]),
  fixture("shape.stroke-cap", "Path stroke cap semantics.", ["drawPath", "strokeCap"]),
  fixture("path.geometry.arc-closed", "Closed elliptical contour with fill and stroke.", ["drawPath", "closed-contour", "arc", "fill", "stroke"]),
  fixture("path.geometry.multiple-contours", "Multiple contours and fill rule.", ["drawPath", "multiple-contours", "fillRule"]),
  fixture("path.gradient", "Gradient paint on a path.", ["drawPath", "gradient"]),
  fixture("path.geometry.arc", "Elliptical arc contour.", ["drawPath", "arc"]),
];

/** Phase 3 paint contract fixtures sourced from the existing Protocol V2 lab. */
export const SKIA_GRADIENT_CASES: readonly SkiaPreviewFixture[] = [
  fixture("shape.linear-gradient", "Linear gradient on a shape.", ["drawShape", "linear-gradient", "stops"]),
  fixture("shape.radial-gradient", "Radial gradient on a shape.", ["drawShape", "radial-gradient"]),
  fixture("shape.radial-focus", "Radial gradient with focal point and radius.", ["drawShape", "radial-focus", "stopOpacity"]),
  fixture("shape.gradient-many-stops", "Linear gradient with many stops.", ["drawShape", "many-stops"]),
  fixture("shape.conic-gradient", "Sweep/conic gradient on a shape.", ["drawShape", "conic-gradient"]),
  fixture("shape.gradient-spread", "Reflect spread method.", ["drawShape", "reflect"]),
  fixture("shape.gradient-user-space", "User-space gradient transform.", ["drawShape", "userSpaceOnUse", "gradientTransform"]),
  fixture("shape.stroke-gradient", "Gradient reused for stroke paint.", ["drawShape", "strokePaint"]),
];

/** Phase 4 text fixtures. They intentionally reuse the Protocol V2 text
 * projects already covered by the Runtime text shaper, including Arabic RTL
 * shaping, color emoji fallback, emoji-only, ZWJ and variation-selector
 * clusters. */
export const SKIA_TEXT_CASES: readonly SkiaPreviewFixture[] = [
  fixture("text.single-line.alignment", "Runtime-shaped Noto Sans glyph outlines.", ["drawText", "glyphs", "font"]),
  fixture("text.left.alignment", "Left-aligned glyph placement.", ["drawText", "alignment"]),
  fixture("text.right.alignment", "Right-aligned glyph placement.", ["drawText", "alignment"]),
  fixture("text.paragraph.multiline", "Multiple Runtime-shaped text lines.", ["drawText", "lines"]),
  fixture("text.text-length", "Runtime-resolved textLength geometry.", ["drawText", "textLength"]),
  fixture("text.positioning.dx-dy-rotate", "Per-glyph positioning and rotation.", ["drawText", "rotation"]),
  fixture("text.text-path", "Glyphs positioned along a Runtime path.", ["drawText", "textPath"]),
  fixture("text.writing-mode.vertical", "Vertical glyph layout.", ["drawText", "vertical"]),
  fixture("text.decoration-stroke", "Glyph stroke and decoration paints.", ["drawText", "stroke", "decoration"]),
  fixture("text.arabic.rtl", "Arabic joining forms shaped right-to-left by Runtime.", ["drawText", "Arabic", "rtl", "HarfBuzz"]),
  fixture("text.arabic.lam-alef", "Arabic lam-alef contextual shaping.", ["drawText", "Arabic", "ligature", "rtl"]),
  fixture("text.arabic.marks", "Arabic combining-mark positioning.", ["drawText", "Arabic", "marks", "rtl"]),
  fixture("text.emoji-fallback", "Noto Sans plus Noto Color Emoji fallback.", ["drawText", "emoji", "fallback"]),
  fixture("text.emoji-only", "Color emoji-only glyph run.", ["drawText", "emoji"]),
  fixture("text.emoji-zwj", "Family emoji ZWJ cluster.", ["drawText", "emoji", "ZWJ"]),
  fixture("text.emoji-variation", "Emoji variation-selector sequences.", ["drawText", "emoji", "variation"]),
];

export const SKIA_PREVIEW_DEFAULT_CASE = SKIA_PREVIEW_CASES[0]!;
