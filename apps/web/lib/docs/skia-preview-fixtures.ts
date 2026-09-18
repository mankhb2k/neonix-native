import { PREVIEW_LAB_CASES } from "./preview-lab";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

export type SkiaPreviewFixture = {
  id: string;
  label: string;
  purpose: string;
  project: MotionProtocolV2;
  previewTime?: number;
  expected: readonly string[];
  svgReference: string;
};

const sourceById = new Map(PREVIEW_LAB_CASES.map((item) => [item.id, item]));

function fixture(id: string, purpose: string, expected: readonly string[]): SkiaPreviewFixture {
  const source = sourceById.get(id);
  if (!source) throw new Error(`Missing Skia preview source fixture: ${id}`);
  return { id, label: source.label, purpose, project: source.project, previewTime: source.previewTime, expected, svgReference: `/preview/skia/${id}.svg` };
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

/** Transform parity fixtures. These deliberately use the canonical Preview
 * Lab projects so the browser SVG and Skia panels receive the same compiled
 * RuntimeFrameV3 transform matrices. */
export const SKIA_TRANSFORM_CASES: readonly SkiaPreviewFixture[] = [
  fixture("rectangle.transform.translate", "2D translation lowered to the Runtime transform.", ["setTransform", "translate", "drawShape"]),
  fixture("rectangle.transform.scale", "Scale around the rectangle transform origin.", ["setTransform", "scale", "drawShape"]),
  fixture("rectangle.transform.rotate", "Z rotation around the normalized center anchor.", ["setTransform", "rotate", "anchor"]),
  fixture("rectangle.transform.skew", "X-axis skew lowered to the Runtime transform.", ["setTransform", "skew", "drawShape"]),
  fixture("group.nested-transform", "Nested parent and child 2D transforms composed by Runtime.", ["beginGroup", "setTransform", "nested"]),
];

/** Phase 3/4 projective surface fixtures. These deliberately cross the
 * Runtime canonical near plane so a browser/SVG reference cannot hide a
 * backend that divides by w before clipping. */
export const SKIA_PROJECTIVE_CASES: readonly SkiaPreviewFixture[] = [
  fixture("rectangle.mat4.near-plane.rotate-y", "Near-plane crossing rectangle clipped as a projective surface.", ["Matrix4", "rotateY", "near-plane", "tessellation"]),
  fixture("rectangle.mat4.near-plane.rotate-x", "Near-plane crossing rectangle with the orthogonal cut orientation.", ["Matrix4", "rotateX", "near-plane", "tessellation"]),
  fixture("rectangle.mat4.near-plane.ellipse", "Near-plane crossing ellipse tessellated before projection.", ["Matrix4", "ellipse", "near-plane", "tessellation"]),
];

/** Protocol V2 animation fixtures. Their `tracks[]` and local-millisecond
 * keyframes are sampled by the Skia Runtime Lab on every playback tick. */
export const SKIA_ANIMATION_CASES: readonly SkiaPreviewFixture[] = [
  fixture("animation.transform-keyframes", "JSON tracks animate translation, rotation, and scale.", ["tracks", "translate", "rotate", "scale"]),
  fixture("animation.opacity", "A numeric JSON opacity track fades a layer.", ["tracks", "opacity"]),
  fixture("animation.path-morph", "A JSON progress track morphs one path topology into another.", ["tracks", "morph", "drawPath"]),
  fixture("animation.timing-stagger", "Layer timing windows create a staggered sequence.", ["timing", "drawShape"]),
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

/** Phase 5 static resources. These projects resolve their asset URIs from
 * apps/web/public/preview through the normal Protocol V2 resource loader. */
export const SKIA_IMAGE_CASES: readonly SkiaPreviewFixture[] = [
  fixture("image.preserve-aspect-ratio.meet", "Landscape image contained in its viewport.", ["drawImage", "contain", "preview/image"]),
  fixture("image.preserve-aspect-ratio.slice", "Portrait image covering and clipping its viewport.", ["drawImage", "cover", "preview/image"]),
  fixture("image.preserve-aspect-ratio.none", "Image stretched to an explicit viewport.", ["drawImage", "none", "preview/image"]),
  fixture("image.preserve-aspect-ratio.alignment", "Image meet alignment at xMinYMin.", ["drawImage", "alignment", "preview/image"]),
  fixture("image.image-rendering.pixelated", "Transparent PNG with pixelated sampling policy.", ["drawImage", "pixelated", "preview/image"]),
  fixture("image.nested-svg", "SVG image resource from the preview asset directory.", ["drawImage", "image/svg+xml", "preview/svg"]),
  fixture("image.missing-asset", "Missing resource fail-closed diagnostic.", ["drawImage", "missing", "diagnostic"]),
];

/** Phase 5 video resources. The MP4 source is the existing
 * apps/web/public/preview/video/demo-video.mp4 asset. */
export const SKIA_VIDEO_CASES: readonly SkiaPreviewFixture[] = [
  fixture("video.frame-seek", "Runtime-selected video frame.", ["drawVideo", "mediaTime", "preview/video"]),
  fixture("video.trim", "Video source trim range.", ["drawVideo", "trim", "preview/video"]),
  fixture("video.frame-policy", "Ceil frame policy after Runtime evaluation.", ["drawVideo", "ceil", "preview/video"]),
  fixture("video.multi-instance", "Two instances sharing one decoded asset.", ["drawVideo", "multi-instance", "preview/video"]),
];

/** Phase 4 text fixtures. They intentionally reuse the Protocol V2 text
 * projects already covered by the Runtime text shaper, including Arabic RTL
 * shaping, color emoji fallback, emoji-only, ZWJ and variation-selector
 * clusters. */
export const SKIA_TEXT_CASES: readonly SkiaPreviewFixture[] = [
  fixture("text.linear-gradient", "Text fill gradient carried through Runtime and PaintCommandBuffer.", ["drawText", "fillPaint", "linear-gradient"]),
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

/** Phase 6 compositing fixtures. They are intentionally sourced from the
 * canonical Preview Lab so the dropdown still exercises Protocol V2 ->
 * Compiler -> Runtime rather than a renderer-only scene. */
export const SKIA_COMPOSITING_CASES: readonly SkiaPreviewFixture[] = [
  ...(["normal", "darken", "multiply", "color-burn", "lighten", "screen", "color-dodge", "overlay", "soft-light", "hard-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"] as const).map((mode) => fixture(`composite.blend.${mode}`, `Runtime ${mode} blend mode.`, ["beginLayer", "saveLayer", mode])),
  fixture("group.explicit-isolation", "Explicit isolated group with source-over children.", ["beginLayer", "isolation"]),
  fixture("group.isolation.opacity", "Group opacity composited once at the layer boundary.", ["beginLayer", "compositeAlpha"]),
];

export const SKIA_CLIP_CASES: readonly SkiaPreviewFixture[] = [
  fixture("clip.svg.user-space", "Runtime-lowered user-space clipPath.", ["beginLayer", "clipPath", "clipPath.source"]),
  fixture("clip.svg.object-bounding-box", "Runtime-lowered objectBoundingBox clipPath.", ["beginLayer", "clipPath", "objectBoundingBox"]),
];

/** Masks and effect graphs remain visible in the matrix. Path-source masks are
 * replayed by the Skia layer and effect programs are exercised from Runtime. */
export const SKIA_MASK_CASES: readonly SkiaPreviewFixture[] = [
  fixture("mask.svg.alpha", "Runtime alpha mask applied with DstIn coverage.", ["beginLayer", "mask", "alpha", "DstIn"]),
  fixture("mask.svg.luminance", "Runtime luminance mask converted to coverage.", ["beginLayer", "mask", "luma", "DstIn"]),
];

export const SKIA_EFFECT_CASES: readonly SkiaPreviewFixture[] = [
  fixture("effect.color-adjust", "Runtime color matrix adjustment.", ["beginLayer", "effectProgram", "color-adjust"]),
  fixture("effect.blur", "Runtime blur effect with default radius.", ["beginLayer", "effectProgram", "blur"]),
  fixture("effect.blur.stroke", "Runtime blur over fill and stroke coverage.", ["beginLayer", "effectProgram", "blur", "stroke"]),
  fixture("effect.drop-shadow", "Runtime drop shadow from captured alpha.", ["beginLayer", "effectProgram", "drop-shadow"]),
  fixture("effect.drop-shadow.negative-offset", "Runtime drop shadow with negative offset.", ["beginLayer", "effectProgram", "drop-shadow", "negative"]),
  fixture("effect.drop-shadow.zero-blur", "Runtime crisp zero-radius drop shadow.", ["beginLayer", "effectProgram", "drop-shadow", "zero"]),
  fixture("effect.drop-shadow.alpha-color", "Runtime drop shadow with alpha color.", ["beginLayer", "effectProgram", "drop-shadow", "alpha"]),
  fixture("effect.drop-shadow.stroke-source", "Runtime drop shadow from fill and stroke.", ["beginLayer", "effectProgram", "drop-shadow", "stroke"]),
  fixture("effect.outer-glow", "Runtime outer glow behind the source.", ["beginLayer", "effectProgram", "outer-glow"]),
  fixture("effect.outer-glow.stroke-source", "Runtime outer glow from fill and stroke.", ["beginLayer", "effectProgram", "outer-glow", "stroke"]),
  fixture("effect.outer-glow.perspective", "Runtime projected outer glow.", ["beginLayer", "effectProgram", "outer-glow", "perspective"]),
  fixture("effect.inner-glow", "Runtime inner glow from alpha difference.", ["beginLayer", "effectProgram", "inner-glow"]),
  fixture("effect.noise", "Runtime deterministic noise effect.", ["beginLayer", "effectProgram", "noise"]),
  fixture("effect.order", "Runtime ordered color-adjust and blur operators.", ["beginLayer", "effectProgram", "order"]),
  fixture("effect.blur-chain", "Runtime ordered blur chain.", ["beginLayer", "effectProgram", "blur-chain"]),
  fixture("effect.blur.radius-4", "Runtime blur effect at 4px.", ["beginLayer", "effectProgram", "blur", "4"]),
  fixture("effect.blur.radius-40", "Runtime blur effect at 40px.", ["beginLayer", "effectProgram", "blur", "40"]),
  fixture("effect.blur.radius-256", "Runtime blur effect at 256px.", ["beginLayer", "effectProgram", "blur", "256"]),
];

export const SKIA_PREVIEW_DEFAULT_CASE = SKIA_PREVIEW_CASES[0];
