import { z } from "zod";
import {
  MOTION_V2_LIMITS,
  motionEffectPropertyCapability,
  motionPropertyCapability,
  motionPropertyValueError,
  motionVariableTypeMatchesValueKind,
} from "./capabilities";

export const MOTION_PROJECT_FORMAT_VERSION = 2 as const;
export const MOTION_COMPONENT_FORMAT_VERSION = 2 as const;
export const MOTION_PATCH_FORMAT_VERSION = 1 as const;

export const AspectRatioSchema = z.enum(["9:16", "16:9", "1:1"]);

const IdSchema = z.string().min(1).max(MOTION_V2_LIMITS.idLength);
const PropertyPathSchema = z.string().min(1);
const SemverSchema = z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, "Expected semantic version");
const FiniteNumberSchema = z.number().finite();
const LocaleIdentifierSchema = z.string().min(1).refine((locale) => {
  try { return Intl.getCanonicalLocales(locale).length === 1; } catch { return false; }
}, "Invalid locale identifier");

export const JsonValueSchema: z.ZodType<
  string | number | boolean | null | Array<unknown> | Record<string, unknown>
> = z.lazy(() =>
  z.union([
    z.string(),
    FiniteNumberSchema,
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(JsonValueSchema),
  ]),
);

export const VariableReferenceSchema = z.object({
  ref: z.object({ kind: z.literal("variable"), id: IdSchema }),
  map: z
    .object({ scale: FiniteNumberSchema.optional(), offset: FiniteNumberSchema.optional() })
    .strict()
    .optional(),
});

const EffectIdSchema = IdSchema;

/**
 * Ordered pixel effects. Effects are intentionally literal authoring data;
 * animation addresses use `effects.<id>.<field>` and are validated against
 * the concrete effect instance in the reference pass below.
 */
export const EffectV2Schema = z.discriminatedUnion("type", [
  z.object({
    id: EffectIdSchema,
    type: z.literal("blur"),
    radius: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.effectRadius),
  }).strict(),
  z.object({
    id: EffectIdSchema,
    type: z.literal("shadow"),
    offsetX: FiniteNumberSchema.min(-MOTION_V2_LIMITS.effectOffset).max(MOTION_V2_LIMITS.effectOffset),
    offsetY: FiniteNumberSchema.min(-MOTION_V2_LIMITS.effectOffset).max(MOTION_V2_LIMITS.effectOffset),
    blur: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.effectRadius),
    color: z.string().min(1),
    opacity: FiniteNumberSchema.min(0).max(1).default(1),
  }).strict(),
  z.object({
    id: EffectIdSchema,
    type: z.literal("glow"),
    radius: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.effectRadius),
    intensity: FiniteNumberSchema.min(0).max(MOTION_V2_LIMITS.effectIntensity),
    color: z.string().min(1),
    opacity: FiniteNumberSchema.min(0).max(1).default(1),
  }).strict(),
  z.object({
    id: EffectIdSchema,
    type: z.literal("color-adjust"),
    brightness: FiniteNumberSchema.min(-1).max(1).default(0),
    contrast: FiniteNumberSchema.min(0).max(4).default(1),
    saturation: FiniteNumberSchema.min(0).max(4).default(1),
  }).strict(),
]);

export const ResolvableValueSchema = z.union([JsonValueSchema, VariableReferenceSchema]);

function isVariableReference(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(isVariableReference);
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (
    record.ref !== null &&
    typeof record.ref === "object" &&
    (record.ref as Record<string, unknown>).kind === "variable" &&
    typeof (record.ref as Record<string, unknown>).id === "string"
  ) return true;
  return Object.values(record).some(isVariableReference);
}

export const LiteralValueSchema = JsonValueSchema.superRefine((value, context) => {
  if (isVariableReference(value)) context.addIssue({ code: z.ZodIssueCode.custom, message: "Runtime values must be literal" });
});

export const SemanticSchema = z
  .object({
    role: IdSchema,
    key: IdSchema.optional(),
    tags: z.array(IdSchema).max(MOTION_V2_LIMITS.semanticTags).default([]),
  })
  .strict();

export const TransformV2Schema = z
  .object({
    x: FiniteNumberSchema,
    y: FiniteNumberSchema,
    depth: FiniteNumberSchema.optional(),
    width: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.nodeDimension),
    height: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.nodeDimension),
    rotation: FiniteNumberSchema,
    scaleX: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.transformScale),
    scaleY: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.transformScale),
    anchorX: FiniteNumberSchema.min(0).max(1),
    anchorY: FiniteNumberSchema.min(0).max(1),
    opacity: FiniteNumberSchema.min(0).max(1),
    visible: z.boolean(),
    flipX: z.boolean(),
    flipY: z.boolean(),
  })
  .strict();

const AssetBaseSchema = z.object({
  id: IdSchema,
  uri: z.string().min(1),
  integrity: z.string().min(1).optional(),
});

const AssetDimensionSchema = FiniteNumberSchema.int().positive().max(MOTION_V2_LIMITS.assetDimension);

function pixelFormatHasAlpha(pixelFormat: string): boolean {
  return /(?:rgba|bgra|argb|abgr|yuva|graya)/i.test(pixelFormat);
}

export const ImageAssetV2Schema = AssetBaseSchema.extend({
  assetType: z.literal("image"),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  width: AssetDimensionSchema,
  height: AssetDimensionSchema,
  pixelFormat: z.string().min(1),
  hasAlpha: z.boolean(),
}).strict();

export const SvgAssetV2Schema = AssetBaseSchema.extend({
  assetType: z.literal("svg"),
  mimeType: z.literal("image/svg+xml"),
  width: AssetDimensionSchema,
  height: AssetDimensionSchema,
  viewBox: z.string().min(1),
  sanitized: z.literal(true),
}).strict();

export const VideoAssetV2Schema = AssetBaseSchema.extend({
  assetType: z.literal("video"),
  mimeType: z.enum(["video/mp4", "video/webm"]),
  width: AssetDimensionSchema,
  height: AssetDimensionSchema,
  duration: FiniteNumberSchema.positive().max(MOTION_V2_LIMITS.mediaDurationSeconds),
  fps: FiniteNumberSchema.positive().max(MOTION_V2_LIMITS.frameRate),
  videoCodec: z.string().min(1),
  pixelFormat: z.string().min(1),
  hasAudio: z.boolean(),
  audioCodec: z.string().min(1).optional(),
  sampleRate: FiniteNumberSchema.int().positive().max(MOTION_V2_LIMITS.sampleRate).optional(),
  channels: FiniteNumberSchema.int().positive().max(MOTION_V2_LIMITS.audioChannels).optional(),
}).strict();

export const AudioAssetV2Schema = AssetBaseSchema.extend({
  assetType: z.literal("audio"),
  mimeType: z.enum(["audio/mpeg", "audio/wav", "audio/aac", "audio/ogg"]),
  duration: FiniteNumberSchema.positive().max(MOTION_V2_LIMITS.mediaDurationSeconds),
  codec: z.string().min(1),
  sampleRate: FiniteNumberSchema.int().positive().max(MOTION_V2_LIMITS.sampleRate),
  channels: FiniteNumberSchema.int().positive().max(MOTION_V2_LIMITS.audioChannels),
}).strict();

export const FontAssetV2Schema = AssetBaseSchema.extend({
  assetType: z.literal("font"),
  mimeType: z.enum(["font/ttf", "font/otf", "font/woff", "font/woff2"]),
  family: z.string().min(1),
  weight: FiniteNumberSchema.int().min(1).max(1000),
  style: z.enum(["normal", "italic"]),
  localeCoverage: z.array(IdSchema).min(1).max(MOTION_V2_LIMITS.localeCoverage),
}).strict();

export const AssetV2Schema = z.discriminatedUnion("assetType", [
  ImageAssetV2Schema,
  SvgAssetV2Schema,
  VideoAssetV2Schema,
  AudioAssetV2Schema,
  FontAssetV2Schema,
]).superRefine((asset, context) => {
  if (asset.assetType === "image" && asset.hasAlpha !== pixelFormatHasAlpha(asset.pixelFormat)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["hasAlpha"], message: "Image hasAlpha does not match pixelFormat" });
  }
  if (asset.assetType !== "video") return;
  const audioFields = [asset.audioCodec, asset.sampleRate, asset.channels];
  if (asset.hasAudio && audioFields.some((value) => value === undefined)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["hasAudio"], message: "Video with audio requires audioCodec, sampleRate and channels" });
  }
  if (!asset.hasAudio && audioFields.some((value) => value !== undefined)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["hasAudio"], message: "Silent video must not declare audio metadata" });
  }
});

const ScalarVariableSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
});

const ObjectFieldSchema = z.object({
  type: z.enum(["string", "color", "number", "boolean", "image"]),
});

export const VariableV2Schema = z.discriminatedUnion("type", [
  ScalarVariableSchema.extend({ type: z.literal("string"), value: z.string() }).strict(),
  ScalarVariableSchema.extend({ type: z.literal("color"), value: z.string().min(1) }).strict(),
  ScalarVariableSchema.extend({
    type: z.literal("number"),
    value: FiniteNumberSchema,
    min: FiniteNumberSchema.optional(),
    max: FiniteNumberSchema.optional(),
  }).strict(),
  ScalarVariableSchema.extend({ type: z.literal("boolean"), value: z.boolean() }).strict(),
  ScalarVariableSchema.extend({ type: z.literal("image"), value: IdSchema }).strict(),
  ScalarVariableSchema.extend({
    type: z.literal("enum"),
    value: z.string(),
    options: z.array(z.string()).min(1).max(MOTION_V2_LIMITS.enumOptions),
  }).strict(),
  ScalarVariableSchema.extend({
    type: z.literal("list"),
    itemSchema: z
      .object({ type: z.literal("object"), fields: z.record(ObjectFieldSchema) })
      .strict(),
    value: z.array(z.record(JsonValueSchema)).max(MOTION_V2_LIMITS.listItems),
  }).strict(),
]);

const RepeatSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("list"), variableId: IdSchema, keyPath: PropertyPathSchema }).strict(),
  z.object({ kind: z.literal("count"), count: FiniteNumberSchema.int().positive().max(MOTION_V2_LIMITS.repeaterInstances), keyPrefix: IdSchema.default("item") }).strict(),
]);

const RepeatLayoutSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }).strict(),
  z.object({ kind: z.literal("linear"), offsetX: FiniteNumberSchema, offsetY: FiniteNumberSchema }).strict(),
  z.object({ kind: z.literal("grid"), columns: FiniteNumberSchema.int().positive().max(MOTION_V2_LIMITS.repeaterGridColumns), gapX: FiniteNumberSchema, gapY: FiniteNumberSchema }).strict(),
  z.object({ kind: z.literal("radial"), radius: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.nodeDimension), startAngle: FiniteNumberSchema, endAngle: FiniteNumberSchema, orientToAngle: z.boolean().default(false) }).strict(),
]);

const RepeaterSchema = z.object({
  source: RepeatSourceSchema,
  itemAlias: IdSchema.default("item"),
  indexAlias: IdSchema.default("index"),
  layout: RepeatLayoutSchema,
  timeStagger: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.mediaDurationSeconds).default(0),
}).strict();

const MotionModifierSchema = z.discriminatedUnion("type", [
  z.object({
    id: IdSchema,
    type: z.literal("motion-path"),
    pathNodeId: IdSchema,
    contourId: IdSchema,
    progress: FiniteNumberSchema.min(0).max(1),
    orientToPath: z.boolean(),
    rotationOffset: FiniteNumberSchema,
    startOffset: FiniteNumberSchema.min(0).max(1).default(0),
    endOffset: FiniteNumberSchema.min(0).max(1).default(1),
  }).strict(),
  z.object({
    id: IdSchema,
    type: z.literal("path-morph"),
    from: z.union([z.literal("base"), IdSchema]),
    to: IdSchema,
    progress: ResolvableValueSchema,
  }).strict(),
  z.object({
    id: IdSchema,
    type: z.literal("secondary-motion"),
    driverNodeId: IdSchema,
    chainNodeIds: z.array(IdSchema).min(1).max(MOTION_V2_LIMITS.secondaryMotionChainLength),
    stiffness: FiniteNumberSchema.positive(),
    damping: FiniteNumberSchema.nonnegative(),
    lag: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.mediaDurationSeconds),
    amplitude: FiniteNumberSchema,
    axis: z.enum(["rotation", "position"]),
  }).strict(),
  z.object({
    id: IdSchema,
    type: z.literal("trim-path"),
    start: FiniteNumberSchema.min(0).max(1),
    end: FiniteNumberSchema.min(0).max(1),
    offset: FiniteNumberSchema.default(0),
  }).strict(),
  z.object({
    id: IdSchema,
    type: z.literal("path-bend"),
    amount: FiniteNumberSchema.min(-MOTION_V2_LIMITS.pathBendAmount).max(MOTION_V2_LIMITS.pathBendAmount),
  }).strict(),
  z.object({
    id: IdSchema,
    type: z.literal("constraint"),
    kind: z.enum(["look-at", "copy-position", "copy-rotation"]),
    targetNodeId: IdSchema,
    weight: FiniteNumberSchema.min(0).max(1).default(1),
  }).strict(),
  z.object({
    id: IdSchema,
    type: z.literal("parallax"),
    factor: FiniteNumberSchema.default(1),
    focalDepth: FiniteNumberSchema.default(0),
  }).strict(),
]);

const NodeBaseSchema = z.object({
  id: IdSchema,
  type: IdSchema,
  name: z.string().min(1).optional(),
  parentId: IdSchema.nullable(),
  zIndex: FiniteNumberSchema.int().optional(),
  transform: TransformV2Schema,
  semantic: SemanticSchema.optional(),
  repeat: RepeaterSchema.optional(),
  modifiers: z.array(MotionModifierSchema).max(MOTION_V2_LIMITS.modifiersPerNode).optional(),
  effects: z.array(EffectV2Schema).max(MOTION_V2_LIMITS.effectsPerNode).optional(),
  blendMode: z.enum(["normal", "multiply", "screen", "add"]).optional(),
  inheritPosition: z.boolean().optional(),
  inheritRotation: z.boolean().optional(),
  inheritScale: z.boolean().optional(),
  inheritOpacity: z.boolean().optional(),
  mask: z.object({
    sourceNodeId: IdSchema,
    mode: z.enum(["clip", "alpha", "inverse-alpha", "luma", "inverse-luma"]),
    sourceVisibility: z.enum(["mask-only", "content-and-mask"]),
  }).strict().optional(),
});

const FitSchema = z.enum(["contain", "cover", "fill", "none"]);

const CropSchema = z.object({
  x: FiniteNumberSchema.min(0).max(1),
  y: FiniteNumberSchema.min(0).max(1),
  width: FiniteNumberSchema.positive().max(1),
  height: FiniteNumberSchema.positive().max(1),
}).strict();

const GradientStopSchema = z.object({
  id: IdSchema,
  offset: FiniteNumberSchema.min(0).max(1),
  color: z.string().min(1),
}).strict();

const GradientPaintSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("linear-gradient"),
    angle: FiniteNumberSchema.optional(),
    stops: z.array(GradientStopSchema).min(2).max(MOTION_V2_LIMITS.gradientStops),
  }).strict(),
  z.object({
    type: z.literal("radial-gradient"),
    cx: FiniteNumberSchema.min(0).max(1),
    cy: FiniteNumberSchema.min(0).max(1),
    radius: FiniteNumberSchema.positive().max(2),
    stops: z.array(GradientStopSchema).min(2).max(MOTION_V2_LIMITS.gradientStops),
  }).strict(),
]);

export const PaintStyleSchema = z.object({
  fill: z.union([z.string().min(1), GradientPaintSchema]).optional(),
  fillOpacity: FiniteNumberSchema.min(0).max(1).optional(),
  stroke: z.string().min(1).optional(),
  strokeWidth: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.nodeDimension).optional(),
  strokeOpacity: FiniteNumberSchema.min(0).max(1).optional(),
  lineCap: z.enum(["butt", "round", "square"]).optional(),
  lineJoin: z.enum(["miter", "round", "bevel"]).optional(),
  miterLimit: FiniteNumberSchema.positive().max(MOTION_V2_LIMITS.nodeDimension).optional(),
  dash: z.array(FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.dashLength)).min(1).max(MOTION_V2_LIMITS.dashSegments).optional(),
  dashOffset: FiniteNumberSchema.min(-MOTION_V2_LIMITS.dashLength).max(MOTION_V2_LIMITS.dashLength).optional(),
}).strict().superRefine((style, context) => {
  const fill = style.fill;
  if (fill && typeof fill === "object" && "stops" in fill) {
    for (let index = 1; index < fill.stops.length; index += 1) {
      if (fill.stops[index]!.offset < fill.stops[index - 1]!.offset) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fill", "stops", index, "offset"],
          message: "Gradient stop offsets must be non-decreasing",
        });
      }
    }
  }
});

export const PointV2Schema = z.object({
  x: FiniteNumberSchema.min(-MOTION_V2_LIMITS.nodeDimension).max(MOTION_V2_LIMITS.nodeDimension),
  y: FiniteNumberSchema.min(-MOTION_V2_LIMITS.nodeDimension).max(MOTION_V2_LIMITS.nodeDimension),
}).strict();

export const GroupNodeV2Schema = NodeBaseSchema.extend({
  type: z.literal("group"),
}).strict();

export const BoneNodeV2Schema = NodeBaseSchema.extend({
  type: z.literal("bone"),
  payload: z.object({
    length: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.nodeDimension),
    restRotation: FiniteNumberSchema.optional(),
    rotationLimits: z.object({ min: FiniteNumberSchema, max: FiniteNumberSchema }).strict().optional(),
  }).strict(),
}).strict();

const TextAnimatorSchema = z.object({
  id: IdSchema,
  unit: z.enum(["grapheme", "word", "line"]),
  locale: LocaleIdentifierSchema.optional(),
  selector: z.object({ start: FiniteNumberSchema.min(0).max(1), end: FiniteNumberSchema.min(0).max(1) }).strict(),
  startTime: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.mediaDurationSeconds),
  duration: FiniteNumberSchema.positive().max(MOTION_V2_LIMITS.mediaDurationSeconds),
  stagger: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.mediaDurationSeconds),
  easing: z.enum(["linear", "step", "easeIn", "easeOut", "easeInOut", "spring"]).default("easeOut"),
  properties: z.object({
    offsetX: FiniteNumberSchema.optional(),
    offsetY: FiniteNumberSchema.optional(),
    rotation: FiniteNumberSchema.optional(),
    scale: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.transformScale).optional(),
    opacity: FiniteNumberSchema.min(0).max(1).optional(),
    fill: z.string().min(1).optional(),
  }).strict(),
}).strict().superRefine((animator, context) => {
  if (animator.selector.start > animator.selector.end) context.addIssue({ code: z.ZodIssueCode.custom, path: ["selector", "end"], message: "Text Animator selector end must be >= start" });
  if (Object.keys(animator.properties).length === 0) context.addIssue({ code: z.ZodIssueCode.custom, path: ["properties"], message: "Text Animator requires at least one property" });
});

export function segmentTextUnits(text: string, unit: "grapheme" | "word" | "line", locale = "vi"): string[] {
  if (unit === "line") return text.split(/\r?\n/);
  const segments = [...new Intl.Segmenter(locale, { granularity: unit }).segment(text)];
  return unit === "word"
    ? segments.map((segment) => segment.segment).filter((segment) => segment.trim().length > 0)
    : segments.map((segment) => segment.segment);
}

export const TextNodeV2Schema = NodeBaseSchema.extend({
  type: z.literal("text"),
  textAnimator: TextAnimatorSchema.optional(),
  payload: z.object({
    text: z.string(),
    fontAssetId: IdSchema.optional(),
    fontSize: FiniteNumberSchema.positive().max(MOTION_V2_LIMITS.nodeDimension),
    fontWeight: FiniteNumberSchema.int().min(1).max(1000).optional(),
    align: z.enum(["left", "center", "right"]).optional(),
    wrap: z.enum(["none", "word", "character"]).optional(),
    lineHeight: FiniteNumberSchema.positive().max(MOTION_V2_LIMITS.nodeDimension).optional(),
    letterSpacing: FiniteNumberSchema.optional(),
    maxLines: FiniteNumberSchema.int().positive().optional(),
    counterProgress: FiniteNumberSchema.min(0).max(1).optional(),
  }).strict(),
  style: PaintStyleSchema.optional(),
}).strict();

const ShapePayloadSchema = z.discriminatedUnion("shape", [
  z.object({ shape: z.literal("rectangle"), cornerRadius: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.nodeDimension).optional() }).strict(),
  z.object({ shape: z.literal("ellipse") }).strict(),
  z.object({
    shape: z.literal("polygon"),
    points: z.array(PointV2Schema).min(3).max(MOTION_V2_LIMITS.polygonPoints),
  }).strict(),
]);

export const ShapeNodeV2Schema = NodeBaseSchema.extend({
  type: z.literal("shape"),
  payload: ShapePayloadSchema,
  style: PaintStyleSchema.optional(),
}).strict();

export const PathSegmentV2Schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("line"), to: PointV2Schema }).strict(),
  z.object({
    kind: z.literal("cubic"),
    control1: PointV2Schema,
    control2: PointV2Schema,
    to: PointV2Schema,
  }).strict(),
]);

export const PathContourV2Schema = z.object({
  id: IdSchema,
  start: PointV2Schema,
  segments: z.array(PathSegmentV2Schema).min(1).max(MOTION_V2_LIMITS.pathSegmentsPerContour),
  closed: z.boolean(),
}).strict();

export const PathMorphTargetV2Schema = z.object({
  id: IdSchema,
  contours: z.array(PathContourV2Schema).min(1).max(MOTION_V2_LIMITS.pathContours),
}).strict();

export const PathNodeV2Schema = NodeBaseSchema.extend({
  type: z.literal("path"),
  payload: z.object({
    contours: z.array(PathContourV2Schema).min(1).max(MOTION_V2_LIMITS.pathContours),
    fillRule: z.enum(["nonzero", "evenodd"]).default("nonzero"),
    morphTargets: z.array(PathMorphTargetV2Schema).max(MOTION_V2_LIMITS.pathMorphTargets).optional(),
  }).strict(),
  style: PaintStyleSchema.optional(),
}).strict();

export const ImageNodeV2Schema = NodeBaseSchema.extend({
  type: z.literal("image"),
  payload: z.object({
    assetId: IdSchema,
    fit: FitSchema.optional(),
    crop: CropSchema.optional(),
  }).strict(),
}).strict();

export const SvgNodeV2Schema = NodeBaseSchema.extend({
  type: z.literal("svg"),
  payload: z.object({
    assetId: IdSchema,
    fit: FitSchema.optional(),
    crop: CropSchema.optional(),
  }).strict(),
  style: PaintStyleSchema.optional(),
}).strict();

export const VideoNodeV2Schema = NodeBaseSchema.extend({
  type: z.literal("video"),
  payload: z.object({
    assetId: IdSchema,
    fit: FitSchema.optional(),
    trimStart: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.mediaDurationSeconds).optional(),
    trimEnd: FiniteNumberSchema.positive().max(MOTION_V2_LIMITS.mediaDurationSeconds).optional(),
    loop: z.boolean().optional(),
    muted: z.boolean().optional(),
    framePolicy: z.enum(["hold", "transparent", "loop"]).optional(),
  }).strict(),
}).strict();

export const CameraNodeV2Schema = NodeBaseSchema.extend({
  type: z.literal("camera"),
  payload: z.object({
    zoom: FiniteNumberSchema.positive().max(MOTION_V2_LIMITS.transformScale),
    projection: z.literal("orthographic").optional(),
  }).strict(),
}).strict();

export const ComponentNodeV2Schema = NodeBaseSchema.extend({
  type: z.literal("component"),
  payload: z
    .object({
      componentId: IdSchema,
      componentVersion: SemverSchema,
      props: z.record(JsonValueSchema),
    })
    .strict(),
}).strict();

export const SolidNodeV2Schema = NodeBaseSchema.extend({
  type: z.literal("solid"),
  payload: z.object({
    width: FiniteNumberSchema.positive().max(MOTION_V2_LIMITS.nodeDimension),
    height: FiniteNumberSchema.positive().max(MOTION_V2_LIMITS.nodeDimension),
    color: z.string().min(1),
  }).strict(),
}).strict();

export const AdjustmentNodeV2Schema = NodeBaseSchema.extend({
  type: z.literal("adjustment"),
}).strict();

export const NodeV2Schema = z.discriminatedUnion("type", [
  GroupNodeV2Schema,
  BoneNodeV2Schema,
  TextNodeV2Schema,
  ShapeNodeV2Schema,
  PathNodeV2Schema,
  ImageNodeV2Schema,
  SvgNodeV2Schema,
  VideoNodeV2Schema,
  CameraNodeV2Schema,
  ComponentNodeV2Schema,
  SolidNodeV2Schema,
  AdjustmentNodeV2Schema,
]);

export const ClipScheduleSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("absolute"), at: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.mediaDurationSeconds) }).strict(),
  z.object({ kind: z.literal("after"), clipId: IdSchema, offset: FiniteNumberSchema.optional() }).strict(),
  z.object({ kind: z.literal("with"), clipId: IdSchema, offset: FiniteNumberSchema.optional() }).strict(),
]);

export const PlaybackSchema = z
  .object({
    iterations: z.union([FiniteNumberSchema.int().positive().max(MOTION_V2_LIMITS.playbackIterations), z.literal("infinite")]).default(1),
    direction: z.enum(["normal", "reverse", "alternate"]).default("normal"),
    rate: ResolvableValueSchema.default(1),
  })
  .strict()
  .superRefine((playback, context) => {
    if (typeof playback.rate === "number" && !(playback.rate > 0)) {
      context.addIssue({
        code: z.ZodIssueCode.too_small,
        minimum: Number.MIN_VALUE,
        inclusive: false,
        type: "number",
        path: ["rate"],
        message: "Number must be greater than 0",
      });
    }
  });

export const KeyframeEasingV2Schema = z.enum(["linear", "easeIn", "easeOut", "easeInOut", "spring", "step"]);

export const ValueKindSchema = z.enum(["number", "angle", "vec2", "color", "boolean", "string", "asset", "path", "gradient"]);

export const ExtrapolationBehaviorSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("clamp") }).strict(),
  z.object({ type: z.literal("cycle"), mode: z.enum(["repeat", "pingpong"]).optional() }).strict(),
  z.object({ type: z.literal("pingpong") }).strict(),
  z.object({ type: z.literal("offset-cycle") }).strict(),
  z.object({ type: z.literal("continue") }).strict(),
]);

const PropertyTrackSchema = z
  .object({
    targetId: IdSchema,
    property: PropertyPathSchema,
    valueKind: ValueKindSchema.optional(),
    preBehavior: ExtrapolationBehaviorSchema.optional(),
    postBehavior: ExtrapolationBehaviorSchema.optional(),
    keys: z
      .array(
        z
          .object({
            t: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.mediaDurationSeconds),
            v: ResolvableValueSchema,
            easing: KeyframeEasingV2Schema.optional(),
          })
          .strict(),
      )
      .min(1)
      .max(MOTION_V2_LIMITS.keysPerTrack),
  })
  .strict();

const ClipSourceSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("preset"), presetId: IdSchema, params: z.record(ResolvableValueSchema).optional() })
    .strict(),
  z.object({ kind: z.literal("tracks"), tracks: z.array(PropertyTrackSchema).min(1).max(MOTION_V2_LIMITS.tracksPerClip) }).strict(),
  z.object({
    kind: z.literal("component-action"),
    actionId: IdSchema,
    params: z.record(ResolvableValueSchema).optional(),
  }).strict(),
]);

export const ClipV2Schema = z
  .object({
    id: IdSchema,
    targetId: IdSchema.optional(),
    schedule: ClipScheduleSchema,
    duration: FiniteNumberSchema.positive().max(MOTION_V2_LIMITS.mediaDurationSeconds),
    playback: PlaybackSchema.default({}),
    source: ClipSourceSchema,
  })
  .strict();

const VariableBindingSourceSchema = z.object({ kind: z.literal("variable"), variableId: IdSchema }).strict();
const ContextBindingSourceSchema = z.object({ kind: z.literal("context"), path: PropertyPathSchema }).strict();

export const ComponentBindingSchema = z
  .object({
    id: IdSchema,
    source: z.union([VariableBindingSourceSchema, ContextBindingSourceSchema]),
    target: z.object({ nodeId: IdSchema, property: PropertyPathSchema }).strict(),
  })
  .strict();

export const ProjectBindingSchema = z
  .object({
    id: IdSchema,
    source: VariableBindingSourceSchema,
    target: z.object({ sceneId: IdSchema, nodeId: IdSchema, property: PropertyPathSchema }).strict(),
  })
  .strict();

export const PublicParamV2Schema = z
  .object({
    id: IdSchema,
    name: z.string().min(1).optional(),
    type: z.enum(["string", "color", "number", "boolean", "image", "enum", "list"]),
    label: z.string().min(1).optional(),
    variableId: IdSchema,
    semantic: SemanticSchema.optional(),
    min: FiniteNumberSchema.optional(),
    max: FiniteNumberSchema.optional(),
    step: FiniteNumberSchema.positive().optional(),
    previewHint: z.string().optional(),
    options: z.array(z.string()).min(1).max(MOTION_V2_LIMITS.enumOptions).optional(),
    group: z.enum(["content", "style", "motion", "layout", "audio"]).optional(),
    control: z.enum(["text", "textarea", "color-picker", "slider", "toggle", "asset-picker", "enum"]).optional(),
    capability: z.enum(["basic", "advanced", "designer-only"]).optional(),
  })
  .strict();

export const PublicParamSchema = PublicParamV2Schema;

const SvgSourceImportSchema = z.object({
  id: IdSchema,
  kind: z.literal("svg"),
  sourceAssetId: IdSchema,
  sourceIntegrity: z.string().min(1),
  parts: z.array(z.object({
    id: IdSchema,
    sourceElementIds: z.array(IdSchema).min(1).max(MOTION_V2_LIMITS.sourceElementIdsPerPart),
    structuralFingerprint: z.string().min(1),
    nodeId: IdSchema,
    outputAssetId: IdSchema,
    originalName: z.string().min(1).optional(),
  }).strict()).max(MOTION_V2_LIMITS.sourcePartsPerImport),
}).strict();

const CutoutVariantSlotSchema = z.object({
  id: IdSchema,
  nodeId: IdSchema,
  semanticRole: IdSchema,
  defaultVariantId: IdSchema,
  variants: z.array(z.object({
    id: IdSchema,
    assetId: IdSchema,
    semantic: IdSchema.optional(),
  }).strict()).min(1).max(MOTION_V2_LIMITS.variantsPerSlot),
}).strict();

const CutoutRigSchema = z.object({
  id: IdSchema,
  kind: z.literal("cutout"),
  rootNodeId: IdSchema,
  slots: z.array(CutoutVariantSlotSchema).max(MOTION_V2_LIMITS.variantSlotsPerRig),
}).strict();

export const LipSyncCueSchema = z.object({
  id: IdSchema,
  at: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.mediaDurationSeconds),
  variantId: IdSchema,
}).strict();

export const LipSyncSchema = z.object({
  slotId: IdSchema,
  cues: z.array(LipSyncCueSchema).min(1).max(MOTION_V2_LIMITS.lipSyncCuesPerAction),
}).strict();

const MotionActionSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  duration: FiniteNumberSchema.positive().max(MOTION_V2_LIMITS.mediaDurationSeconds),
  loop: z.boolean().default(false),
  clips: z.array(ClipV2Schema).max(MOTION_V2_LIMITS.clipsPerAction),
  lipSync: LipSyncSchema.optional(),
}).strict().superRefine((action, context) => {
  if (action.clips.length === 0 && !action.lipSync) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["clips"], message: "Action requires clips or lipSync" });
  }
});

export const MotionComponentV2Schema = z
  .object({
    format: z.literal("motion-component"),
    formatVersion: z.literal(MOTION_COMPONENT_FORMAT_VERSION),
    componentId: IdSchema,
    componentVersion: SemverSchema,
    metadata: z.record(JsonValueSchema),
    assets: z.array(AssetV2Schema).max(MOTION_V2_LIMITS.assetsPerArtifact).default([]),
    variables: z.array(VariableV2Schema).max(MOTION_V2_LIMITS.variablesPerArtifact),
    publicAPI: z.array(PublicParamSchema).max(MOTION_V2_LIMITS.publicParamsPerComponent),
    nodes: z.array(NodeV2Schema).min(1).max(MOTION_V2_LIMITS.nodesPerComponent),
    bindings: z.array(ComponentBindingSchema).max(MOTION_V2_LIMITS.bindingsPerArtifact).default([]),
    clips: z.array(ClipV2Schema).max(MOTION_V2_LIMITS.clipsPerComponent).default([]),
    sourceImports: z.array(SvgSourceImportSchema).max(MOTION_V2_LIMITS.sourceImportsPerComponent).default([]),
    cutoutRigs: z.array(CutoutRigSchema).max(MOTION_V2_LIMITS.cutoutRigsPerComponent).default([]),
    actions: z.array(MotionActionSchema).max(MOTION_V2_LIMITS.actionsPerComponent).default([]),
  })
  .strict();

const ComponentDependencySchema = z
  .object({
    componentId: IdSchema,
    version: SemverSchema,
    source: IdSchema,
    integrity: z.string().min(1),
  })
  .strict();

const AudioTrackSchema = z
  .object({
    id: IdSchema,
    role: z.enum(["bgm", "voiceover", "sfx"]),
    assetId: IdSchema,
    start: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.mediaDurationSeconds),
    trimStart: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.mediaDurationSeconds).default(0),
    volume: FiniteNumberSchema.min(0).max(1).default(1),
    loop: z.boolean().default(false),
    fadeIn: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.mediaDurationSeconds).default(0),
    fadeOut: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.mediaDurationSeconds).default(0),
  })
  .strict();

export const SceneTransitionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("cut"), duration: z.literal(0).optional() }).strict(),
  z.object({
    type: z.enum(["fade", "crossfade"]),
    duration: FiniteNumberSchema.positive().max(MOTION_V2_LIMITS.mediaDurationSeconds),
  }).strict(),
]);

const SceneV2Schema = z
  .object({
    id: IdSchema,
    name: z.string().min(1).optional(),
    duration: FiniteNumberSchema.positive().max(MOTION_V2_LIMITS.mediaDurationSeconds),
    semantic: SemanticSchema.optional(),
    nodes: z.array(NodeV2Schema).max(MOTION_V2_LIMITS.nodesPerScene),
    clips: z.array(ClipV2Schema).max(MOTION_V2_LIMITS.clipsPerScene),
    activeCameraId: IdSchema.optional(),
    transition: SceneTransitionSchema.optional(),
  })
  .strict();

export const BrandV2Schema = z
  .object({
    name: z.string().min(1),
    primaryColor: z.string().optional(),
    secondaryColor: z.string().optional(),
    logoAssetId: IdSchema.optional(),
    fontFamily: z.string().optional(),
  })
  .strict();

export const ProjectMetadataV2Schema = z
  .object({
    id: IdSchema,
    name: z.string().min(1),
    aspectRatio: AspectRatioSchema,
    fps: FiniteNumberSchema.int().positive().max(MOTION_V2_LIMITS.frameRate),
    locale: z.literal("vi-VN"),
    industry: z.string().optional(),
    brand: BrandV2Schema,
    description: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .strict();

export const MotionProjectV2Schema = z
  .object({
    format: z.literal("motion-project"),
    formatVersion: z.literal(MOTION_PROJECT_FORMAT_VERSION),
    metadata: ProjectMetadataV2Schema,
    dependencies: z.object({ components: z.array(ComponentDependencySchema).max(MOTION_V2_LIMITS.dependenciesPerProject) }).strict(),
    assets: z.array(AssetV2Schema).max(MOTION_V2_LIMITS.assetsPerArtifact),
    variables: z.array(VariableV2Schema).max(MOTION_V2_LIMITS.variablesPerArtifact),
    timeline: z
      .object({
        sceneOrder: z.array(IdSchema).max(MOTION_V2_LIMITS.scenesPerProject),
        audioTracks: z.array(AudioTrackSchema).max(MOTION_V2_LIMITS.audioTracksPerProject).default([]),
      })
      .strict(),
    scenes: z.array(SceneV2Schema).max(MOTION_V2_LIMITS.scenesPerProject),
    bindings: z.array(ProjectBindingSchema).max(MOTION_V2_LIMITS.bindingsPerArtifact).default([]),
    extensions: z
      .object({
        constraints: z.array(JsonValueSchema).max(MOTION_V2_LIMITS.extensionEntries).default([]),
        events: z.array(JsonValueSchema).max(MOTION_V2_LIMITS.extensionEntries).default([]),
      })
      .strict()
      .default({}),
  })
  .strict();

const PatchTargetSchema = z.union([
  z.object({ variableId: IdSchema }).strict(),
  z.object({ sceneId: IdSchema, nodeId: IdSchema, property: PropertyPathSchema }).strict(),
]);

export const MotionPatchSchema = z
  .object({
    format: z.literal("motion-patch"),
    formatVersion: z.literal(MOTION_PATCH_FORMAT_VERSION),
    baseRevision: FiniteNumberSchema.int().nonnegative(),
    operations: z.array(z.object({ op: z.literal("set"), target: PatchTargetSchema, value: JsonValueSchema }).strict()).max(MOTION_V2_LIMITS.patchOperations),
  })
  .strict();

const RuntimeNodeSchema = z.discriminatedUnion("type", [
  GroupNodeV2Schema.omit({ repeat: true }),
  BoneNodeV2Schema.omit({ repeat: true }),
  TextNodeV2Schema.omit({ repeat: true, textAnimator: true }),
  ShapeNodeV2Schema.omit({ repeat: true }),
  PathNodeV2Schema.omit({ repeat: true }),
  ImageNodeV2Schema.omit({ repeat: true }),
  SvgNodeV2Schema.omit({ repeat: true }),
  VideoNodeV2Schema.omit({ repeat: true }),
  CameraNodeV2Schema.omit({ repeat: true }),
  SolidNodeV2Schema.omit({ repeat: true }),
  AdjustmentNodeV2Schema.omit({ repeat: true }),
]);

const RuntimeTrackSchema = z
  .object({
    targetId: IdSchema,
    property: PropertyPathSchema,
    valueKind: ValueKindSchema.optional(),
    preBehavior: ExtrapolationBehaviorSchema.optional(),
    postBehavior: ExtrapolationBehaviorSchema.optional(),
    keys: z.array(z.object({ t: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.mediaDurationSeconds), v: LiteralValueSchema, easing: KeyframeEasingV2Schema.optional() }).strict()).min(1).max(MOTION_V2_LIMITS.keysPerTrack),
  })
  .strict();

const NormalizedMotionProjectV2BaseSchema = z
  .object({
    format: z.literal("motion-runtime"),
    formatVersion: z.literal(MOTION_PROJECT_FORMAT_VERSION),
    metadata: ProjectMetadataV2Schema,
    assets: z.array(AssetV2Schema).max(MOTION_V2_LIMITS.assetsPerArtifact),
    timeline: z.object({
      sceneOrder: z.array(IdSchema).max(MOTION_V2_LIMITS.scenesPerProject),
      audioTracks: z.array(AudioTrackSchema).max(MOTION_V2_LIMITS.audioTracksPerProject),
    }).strict(),
    scenes: z.array(
      z.object({
        id: IdSchema,
        duration: FiniteNumberSchema.positive().max(MOTION_V2_LIMITS.mediaDurationSeconds),
        activeCameraId: IdSchema.optional(),
        transition: SceneTransitionSchema.optional(),
        nodes: z.array(RuntimeNodeSchema).max(MOTION_V2_LIMITS.nodesPerScene),
        tracks: z.array(RuntimeTrackSchema).max(MOTION_V2_LIMITS.clipsPerScene * MOTION_V2_LIMITS.tracksPerClip),
      }).strict(),
    ).max(MOTION_V2_LIMITS.scenesPerProject),
  })
  .strict();

export const NormalizedMotionProjectV2Schema = NormalizedMotionProjectV2BaseSchema.superRefine((runtime, context) => {
  for (let sceneIndex = 0; sceneIndex < runtime.scenes.length; sceneIndex += 1) {
    const scene = runtime.scenes[sceneIndex]!;
    const nodeById = new Map(scene.nodes.map((node) => [node.id, node]));
    if (scene.activeCameraId) {
      const camera = nodeById.get(scene.activeCameraId);
      if (!camera) context.addIssue({ code: z.ZodIssueCode.custom, path: ["scenes", sceneIndex, "activeCameraId"], message: `Unknown runtime camera: ${scene.activeCameraId}` });
      else if (camera.type !== "camera") context.addIssue({ code: z.ZodIssueCode.custom, path: ["scenes", sceneIndex, "activeCameraId"], message: `Runtime node ${scene.activeCameraId} has type ${camera.type}, expected camera` });
    }
    const secondaryChainOwners = new Map<string, string>();
    for (let nodeIndex = 0; nodeIndex < scene.nodes.length; nodeIndex += 1) {
      const node = scene.nodes[nodeIndex]!;
      const modifiers = node.modifiers ?? [];
      const effects = node.effects ?? [];
      for (const effectId of new Set(duplicates(effects.map((effect) => effect.id)))) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["scenes", sceneIndex, "nodes", nodeIndex, "effects"], message: `Duplicate runtime effect id: ${effectId}` });
      }
      for (const modifierId of new Set(duplicates(modifiers.map((modifier) => modifier.id)))) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["scenes", sceneIndex, "nodes", nodeIndex, "modifiers"], message: `Duplicate runtime modifier id: ${modifierId}` });
      }
      if (node.type === "path") {
        const morphTargets = node.payload.morphTargets ?? [];
        for (const targetId of new Set(duplicates(morphTargets.map((target) => target.id)))) {
          context.addIssue({ code: z.ZodIssueCode.custom, path: ["scenes", sceneIndex, "nodes", nodeIndex, "payload", "morphTargets"], message: `Duplicate runtime Path Morph target id: ${targetId}` });
        }
        for (const modifier of modifiers.filter((candidate) => candidate.type === "path-morph")) {
          const targetById = new Map(morphTargets.map((target) => [target.id, target]));
          const fromContours = modifier.from === "base" ? node.payload.contours : targetById.get(modifier.from)?.contours;
          const toContours = targetById.get(modifier.to)?.contours;
          if (modifier.from !== "base" && !fromContours) context.addIssue({ code: z.ZodIssueCode.custom, path: ["scenes", sceneIndex, "nodes", nodeIndex, "modifiers"], message: `Unknown runtime Path Morph target: ${modifier.from}` });
          if (!toContours) context.addIssue({ code: z.ZodIssueCode.custom, path: ["scenes", sceneIndex, "nodes", nodeIndex, "modifiers"], message: `Unknown runtime Path Morph target: ${modifier.to}` });
          if (fromContours && toContours) {
            const mismatch = morphTopologyMismatch(fromContours, toContours);
            if (mismatch) context.addIssue({ code: z.ZodIssueCode.custom, path: ["scenes", sceneIndex, "nodes", nodeIndex, "modifiers"], message: mismatch });
          }
        }
      } else if (modifiers.some((modifier) => modifier.type === "path-morph")) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["scenes", sceneIndex, "nodes", nodeIndex, "modifiers"], message: "Runtime Path Morph modifier requires a path node" });
      }
      if (modifiers.some((modifier) => modifier.type === "trim-path") && node.type !== "path") {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["scenes", sceneIndex, "nodes", nodeIndex, "modifiers"], message: "Runtime Trim Path modifier requires a path node" });
      }
      if (modifiers.some((modifier) => modifier.type === "path-bend") && node.type !== "path") {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["scenes", sceneIndex, "nodes", nodeIndex, "modifiers"], message: "Runtime Path Bend modifier requires a path node" });
      }
      if (modifiers.filter((modifier) => modifier.type === "motion-path").length > 1) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["scenes", sceneIndex, "nodes", nodeIndex, "modifiers"], message: "Only one runtime motion-path modifier is allowed per node" });
      }
      for (let modifierIndex = 0; modifierIndex < modifiers.length; modifierIndex += 1) {
        const modifier = modifiers[modifierIndex]!;
        const path = ["scenes", sceneIndex, "nodes", nodeIndex, "modifiers", modifierIndex] as Array<string | number>;
        if (modifier.type === "trim-path" && modifier.start > modifier.end) {
          context.addIssue({ code: z.ZodIssueCode.custom, path, message: "Runtime Trim Path end must be >= start" });
        }
        if (modifier.type === "constraint") {
          const target = nodeById.get(modifier.targetNodeId);
          if (!target) context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "targetNodeId"], message: `Unknown runtime constraint target: ${modifier.targetNodeId}` });
          else if (modifier.targetNodeId === node.id) context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "targetNodeId"], message: "Runtime Constraint cannot target itself" });
        }
        if (modifier.type !== "secondary-motion") continue;
        if (modifier.axis !== "rotation") context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "axis"], message: "Runtime Secondary Motion supports rotation axis only" });
        const driver = nodeById.get(modifier.driverNodeId);
        if (!driver) context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "driverNodeId"], message: `Unknown runtime Secondary Motion driver: ${modifier.driverNodeId}` });
        else if (driver.type !== "bone") context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "driverNodeId"], message: `Runtime Secondary Motion driver must be bone: ${modifier.driverNodeId}` });
        if (modifier.driverNodeId !== node.id) context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "driverNodeId"], message: "Runtime Secondary Motion modifier must live on its driver node" });
        for (const chainNodeId of modifier.chainNodeIds) {
          const chainNode = nodeById.get(chainNodeId);
          if (!chainNode) context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "chainNodeIds"], message: `Unknown runtime Secondary Motion chain node: ${chainNodeId}` });
          else if (chainNode.type !== "bone") context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "chainNodeIds"], message: `Runtime Secondary Motion chain node must be bone: ${chainNodeId}` });
          const owner = secondaryChainOwners.get(chainNodeId);
          if (owner) context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "chainNodeIds"], message: `Runtime Secondary Motion chain node already owned: ${chainNodeId}` });
          else secondaryChainOwners.set(chainNodeId, modifier.id);
        }
        for (const chainNodeId of new Set(duplicates(modifier.chainNodeIds))) {
          context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "chainNodeIds"], message: `Duplicate runtime Secondary Motion chain node: ${chainNodeId}` });
        }
      }
      for (let modifierIndex = 0; modifierIndex < (node.modifiers?.length ?? 0); modifierIndex += 1) {
        const modifier = node.modifiers![modifierIndex]!;
        if (modifier.type !== "motion-path") continue;
        const source = nodeById.get(modifier.pathNodeId);
        const path = ["scenes", sceneIndex, "nodes", nodeIndex, "modifiers", modifierIndex] as Array<string | number>;
        if (modifier.startOffset > modifier.endOffset) context.addIssue({ code: z.ZodIssueCode.custom, path, message: "Runtime Motion Path endOffset must be >= startOffset" });
        if (!source) context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "pathNodeId"], message: `Unknown runtime Motion Path node: ${modifier.pathNodeId}` });
        else if (source.type !== "path") context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "pathNodeId"], message: `Runtime Motion Path source must be path: ${modifier.pathNodeId}` });
        else {
          const contour = source.payload.contours.find((candidate) => candidate.id === modifier.contourId);
          if (!contour) context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "contourId"], message: `Unknown runtime Path contour: ${modifier.contourId}` });
          else if (!contourHasLength(contour)) context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "contourId"], message: `Runtime Motion Path contour has zero length: ${modifier.contourId}` });
        }
      }
      const seen = new Set([node.id]);
      let current = node;
      while (current) {
        const motionPath = current.modifiers?.find((modifier) => modifier.type === "motion-path");
        if (!motionPath) break;
        if (seen.has(motionPath.pathNodeId)) {
          context.addIssue({ code: z.ZodIssueCode.custom, path: ["scenes", sceneIndex, "nodes", nodeIndex, "modifiers"], message: "Runtime Motion Path dependency cycle detected" });
          break;
        }
        seen.add(motionPath.pathNodeId);
        current = nodeById.get(motionPath.pathNodeId)!;
      }
    }
    for (let trackIndex = 0; trackIndex < scene.tracks.length; trackIndex += 1) {
      const track = scene.tracks[trackIndex]!;
      const path = ["scenes", sceneIndex, "tracks", trackIndex] as Array<string | number>;
      const node = nodeById.get(track.targetId);
      if (!node) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "targetId"], message: `Unknown runtime node: ${track.targetId}` });
        continue;
      }
      const modifierMatch = /^modifiers\.([^.]+)\.progress$/.exec(track.property);
      if (modifierMatch && !node.modifiers?.some((modifier) => modifier.id === modifierMatch[1] && (modifier.type === "motion-path" || modifier.type === "path-morph"))) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "property"], message: `Unknown runtime progress modifier: ${modifierMatch[1]}` });
        continue;
      }
      const trimMatch = /^modifiers\.([^.]+)\.(start|end|offset)$/.exec(track.property);
      if (trimMatch && !node.modifiers?.some((modifier) => modifier.id === trimMatch[1] && modifier.type === "trim-path")) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "property"], message: `Unknown runtime trim-path modifier: ${trimMatch[1]}` });
        continue;
      }
      const amountMatch = /^modifiers\.([^.]+)\.amount$/.exec(track.property);
      if (amountMatch && !node.modifiers?.some((modifier) => modifier.id === amountMatch[1] && modifier.type === "path-bend")) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "property"], message: `Unknown runtime path-bend modifier: ${amountMatch[1]}` });
        continue;
      }
      const effectMatch = /^effects\.([^.]+)\.([^.]+)$/.exec(track.property);
      if (effectMatch) {
        const effect = node.effects?.find((candidate) => candidate.id === effectMatch[1]);
        if (!effect) {
          context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "property"], message: `Unknown runtime effect: ${effectMatch[1]}` });
          continue;
        }
        if (!motionEffectPropertyCapability(effect.type, effectMatch[2]!)) {
          context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "property"], message: `Unsupported runtime property for ${effect.type} effect: ${effectMatch[2]}` });
          continue;
        }
      }
      const capability = motionPropertyCapability(node.type, track.property);
      if (!capability) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "property"], message: `Unsupported runtime property for ${node.type}: ${track.property}` });
        continue;
      }
      if (!capability.animatable || capability.runtimeSupport !== "evaluated") {
        context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "property"], message: `Property is not supported by runtime evaluator: ${track.property}` });
        continue;
      }
      for (let keyIndex = 0; keyIndex < track.keys.length; keyIndex += 1) {
        const message = motionPropertyValueError(capability, track.keys[keyIndex]!.v, track.property);
        if (message) context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "keys", keyIndex, "v"], message });
      }
    }
  }
});

export type MotionComponentV2 = z.infer<typeof MotionComponentV2Schema>;
export type MotionProjectV2 = z.infer<typeof MotionProjectV2Schema>;
export type MotionTransform = z.infer<typeof TransformV2Schema>;
export type MotionNode = z.infer<typeof NodeV2Schema>;
export type MotionScene = z.infer<typeof SceneV2Schema>;
export type MotionClip = z.infer<typeof ClipV2Schema>;
export type AspectRatio = z.infer<typeof AspectRatioSchema>;
export type MotionPatch = z.infer<typeof MotionPatchSchema>;
export type NormalizedMotionProjectV2 = z.infer<typeof NormalizedMotionProjectV2Schema>;
export type MotionPaintStyle = z.infer<typeof PaintStyleSchema>;
export type MotionPoint = z.infer<typeof PointV2Schema>;
export type MotionPathSegment = z.infer<typeof PathSegmentV2Schema>;
export type MotionPathContour = z.infer<typeof PathContourV2Schema>;
export type MotionPathMorphTarget = z.infer<typeof PathMorphTargetV2Schema>;
export type MotionEffect = z.infer<typeof EffectV2Schema>;

export interface ReferenceIssue {
  path: string;
  message: string;
}

function duplicates(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) !== index);
}

type MorphContourLike = z.infer<typeof PathContourV2Schema>;

function morphTopologyMismatch(from: MorphContourLike[], to: MorphContourLike[]): string | undefined {
  if (from.length !== to.length) return "Path Morph contour count must match";
  for (let index = 0; index < from.length; index += 1) {
    const left = from[index]!;
    const right = to[index]!;
    if (left.id !== right.id) return `Path Morph contour id/order mismatch: ${left.id} vs ${right.id}`;
    if (left.closed !== right.closed) return `Path Morph contour closed flag must match: ${left.id}`;
    if (left.segments.length !== right.segments.length) return `Path Morph segment count must match: ${left.id}`;
    for (let segmentIndex = 0; segmentIndex < left.segments.length; segmentIndex += 1) {
      if (left.segments[segmentIndex]!.kind !== right.segments[segmentIndex]!.kind) {
        return `Path Morph segment kind/order mismatch: ${left.id}.${segmentIndex}`;
      }
    }
  }
  return undefined;
}

function valueAtPath(value: unknown, path: string): unknown {
  let current = value;
  for (const part of path.split(".")) {
    if (current === null || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function contourHasLength(contour: z.infer<typeof PathContourV2Schema>): boolean {
  let current = contour.start;
  for (const segment of contour.segments) {
    if (segment.kind === "cubic" && [segment.control1, segment.control2].some((point) => point.x !== current.x || point.y !== current.y)) return true;
    if (segment.to.x !== current.x || segment.to.y !== current.y) return true;
    current = segment.to;
  }
  return contour.closed && (current.x !== contour.start.x || current.y !== contour.start.y);
}

function validateNodeGraph(nodes: Array<z.infer<typeof NodeV2Schema>>, prefix: string): ReferenceIssue[] {
  const issues: ReferenceIssue[] = [];
  const ids = nodes.map((node) => node.id);
  for (const id of new Set(duplicates(ids))) issues.push({ path: prefix, message: `Duplicate node id: ${id}` });
  for (const node of nodes) {
    const effects = node.effects ?? [];
    for (const id of new Set(duplicates(effects.map((effect) => effect.id)))) {
      issues.push({ path: `${prefix}.${node.id}.effects`, message: `Duplicate effect id: ${id}` });
    }
    if (node.type === "path") {
      const morphTargets = node.payload.morphTargets ?? [];
      for (const id of new Set(duplicates(morphTargets.map((target) => target.id)))) {
        issues.push({ path: `${prefix}.${node.id}.payload.morphTargets`, message: `Duplicate Path Morph target id: ${id}` });
      }
      for (const modifier of node.modifiers ?? []) {
        if (modifier.type !== "path-morph") continue;
        const targetById = new Map(morphTargets.map((target) => [target.id, target]));
        const fromContours = modifier.from === "base" ? node.payload.contours : targetById.get(modifier.from)?.contours;
        const toContours = targetById.get(modifier.to)?.contours;
        if (modifier.from !== "base" && !fromContours) issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}.from`, message: `Unknown Path Morph target: ${modifier.from}` });
        if (!toContours) issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}.to`, message: `Unknown Path Morph target: ${modifier.to}` });
        if (modifier.from === modifier.to) issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}`, message: "Path Morph from and to targets must differ" });
        if (fromContours && toContours) {
          const mismatch = morphTopologyMismatch(fromContours, toContours);
          if (mismatch) issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}`, message: mismatch });
        }
      }
    } else if ((node.modifiers ?? []).some((modifier) => modifier.type === "path-morph")) {
      issues.push({ path: `${prefix}.${node.id}.modifiers`, message: "Path Morph modifier requires a path node" });
    }
    if (node.type === "bone" && node.payload.rotationLimits && node.payload.rotationLimits.min > node.payload.rotationLimits.max) {
      issues.push({ path: `${prefix}.${node.id}.payload.rotationLimits.max`, message: "Bone rotation limit max must be >= min" });
    }
    if (node.type !== "path") continue;
    for (const id of new Set(duplicates(node.payload.contours.map((contour) => contour.id)))) {
      issues.push({ path: `${prefix}.${node.id}.payload.contours`, message: `Duplicate Path contour id: ${id}` });
    }
  }
  for (const node of nodes) {
    if (node.type !== "text" || !node.textAnimator) continue;
    const units = segmentTextUnits(node.payload.text, node.textAnimator.unit, node.textAnimator.locale);
    if (units.length === 0) issues.push({ path: `${prefix}.${node.id}.textAnimator`, message: "Text Animator requires at least one text unit" });
    if (units.length > MOTION_V2_LIMITS.textAnimatorUnits) issues.push({ path: `${prefix}.${node.id}.textAnimator`, message: `Text Animator exceeds unit limit ${MOTION_V2_LIMITS.textAnimatorUnits}` });
    const selectedCount = units.filter((_, index) => {
      const progress = units.length <= 1 ? 0 : index / (units.length - 1);
      return progress >= node.textAnimator!.selector.start && progress <= node.textAnimator!.selector.end;
    }).length;
    const endTime = node.textAnimator.startTime + Math.max(0, selectedCount - 1) * node.textAnimator.stagger + node.textAnimator.duration;
    if (endTime > MOTION_V2_LIMITS.mediaDurationSeconds) issues.push({ path: `${prefix}.${node.id}.textAnimator`, message: `Text Animator timing exceeds maximum ${MOTION_V2_LIMITS.mediaDurationSeconds}` });
    if (nodes.some((candidate) => candidate.parentId === node.id)) issues.push({ path: `${prefix}.${node.id}.textAnimator`, message: "Text Animator node cannot own child nodes" });
    if (nodes.some((candidate) => candidate.mask?.sourceNodeId === node.id)) issues.push({ path: `${prefix}.${node.id}.textAnimator`, message: "Text Animator node cannot be a mask source" });
  }
  const idSet = new Set(ids);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const parentById = new Map(nodes.map((node) => [node.id, node.parentId]));
  const secondaryChainOwners = new Map<string, string>();
  for (const node of nodes) {
    if (node.parentId !== null && !idSet.has(node.parentId)) {
      issues.push({ path: `${prefix}.${node.id}.parentId`, message: `Unknown parent: ${node.parentId}` });
    }
    if (node.mask && !idSet.has(node.mask.sourceNodeId)) {
      issues.push({ path: `${prefix}.${node.id}.mask.sourceNodeId`, message: `Unknown mask source: ${node.mask.sourceNodeId}` });
    }
    const modifiers = node.modifiers ?? [];
    for (const id of new Set(duplicates(modifiers.map((modifier) => modifier.id)))) issues.push({ path: `${prefix}.${node.id}.modifiers`, message: `Duplicate modifier id: ${id}` });
    if (modifiers.filter((modifier) => modifier.type === "motion-path").length > 1) issues.push({ path: `${prefix}.${node.id}.modifiers`, message: "Only one motion-path modifier is allowed per node" });
    if (modifiers.filter((modifier) => modifier.type === "trim-path").length > 1) issues.push({ path: `${prefix}.${node.id}.modifiers`, message: "Only one trim-path modifier is allowed per node" });
    if (modifiers.filter((modifier) => modifier.type === "path-bend").length > 1) issues.push({ path: `${prefix}.${node.id}.modifiers`, message: "Only one path-bend modifier is allowed per node" });
    for (const modifier of modifiers) {
      if (modifier.type === "trim-path") {
        if (node.type !== "path") issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}`, message: "Trim Path modifier requires a path node" });
        if (modifier.start > modifier.end) issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}`, message: "Trim Path end must be >= start" });
        continue;
      }
      if (modifier.type === "path-bend") {
        if (node.type !== "path") issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}`, message: "Path Bend modifier requires a path node" });
        continue;
      }
      if (modifier.type === "constraint") {
        const target = nodeById.get(modifier.targetNodeId);
        if (!target) issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}.targetNodeId`, message: `Unknown constraint target: ${modifier.targetNodeId}` });
        else if (modifier.targetNodeId === node.id) issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}.targetNodeId`, message: "Constraint cannot target itself" });
        continue;
      }
      if (modifier.type === "secondary-motion") {
        if (modifier.axis !== "rotation") issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}.axis`, message: "Secondary Motion supports rotation axis only" });
        const driver = nodeById.get(modifier.driverNodeId);
        if (!driver) issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}.driverNodeId`, message: `Unknown Secondary Motion driver: ${modifier.driverNodeId}` });
        else if (driver.type !== "bone") issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}.driverNodeId`, message: `Secondary Motion driver must be bone: ${modifier.driverNodeId}` });
        if (modifier.driverNodeId !== node.id) issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}.driverNodeId`, message: "Secondary Motion modifier must live on its driver node" });
        for (const chainNodeId of modifier.chainNodeIds) {
          const chainNode = nodeById.get(chainNodeId);
          if (!chainNode) issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}.chainNodeIds`, message: `Unknown Secondary Motion chain node: ${chainNodeId}` });
          else if (chainNode.type !== "bone") issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}.chainNodeIds`, message: `Secondary Motion chain node must be bone: ${chainNodeId}` });
          const owner = secondaryChainOwners.get(chainNodeId);
          if (owner) issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}.chainNodeIds`, message: `Secondary Motion chain node already owned: ${chainNodeId}` });
          else secondaryChainOwners.set(chainNodeId, modifier.id);
        }
        for (const chainNodeId of new Set(duplicates(modifier.chainNodeIds))) {
          issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}.chainNodeIds`, message: `Duplicate Secondary Motion chain node: ${chainNodeId}` });
        }
        continue;
      }
      if (modifier.type !== "motion-path") continue;
      if (modifier.startOffset > modifier.endOffset) issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}`, message: "Motion Path endOffset must be >= startOffset" });
      const source = nodeById.get(modifier.pathNodeId);
      if (!source) issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}.pathNodeId`, message: `Unknown Motion Path node: ${modifier.pathNodeId}` });
      else if (source.type !== "path") issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}.pathNodeId`, message: `Motion Path source ${modifier.pathNodeId} has type ${source.type}, expected path` });
      else {
        const contour = source.payload.contours.find((candidate) => candidate.id === modifier.contourId);
        if (!contour) issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}.contourId`, message: `Unknown Path contour: ${modifier.contourId}` });
        else if (!contourHasLength(contour)) issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}.contourId`, message: `Motion Path contour has zero length: ${modifier.contourId}` });
      }
      let ancestor = source?.parentId ?? null;
      while (ancestor && nodeById.has(ancestor)) {
        if (ancestor === node.id) {
          issues.push({ path: `${prefix}.${node.id}.modifiers.${modifier.id}.pathNodeId`, message: "Motion Path source cannot be a descendant of its target" });
          break;
        }
        ancestor = nodeById.get(ancestor)?.parentId ?? null;
      }
    }
    const seen = new Set<string>([node.id]);
    let parent = node.parentId;
    let depth = 0;
    while (parent !== null && idSet.has(parent)) {
      if (seen.has(parent)) {
        issues.push({ path: `${prefix}.${node.id}.parentId`, message: "Parent cycle detected" });
        break;
      }
      seen.add(parent);
      parent = parentById.get(parent) ?? null;
      depth += 1;
      if (depth > MOTION_V2_LIMITS.hierarchyDepth) {
        issues.push({ path: `${prefix}.${node.id}.parentId`, message: `Hierarchy exceeds depth limit ${MOTION_V2_LIMITS.hierarchyDepth}` });
        break;
      }
    }
  }
  for (const node of nodes) {
    if (!node.mask) continue;
    const seen = new Set([node.id]);
    let current: z.infer<typeof NodeV2Schema> | undefined = node;
    while (current?.mask) {
      const sourceId = current.mask.sourceNodeId;
      if (seen.has(sourceId)) {
        issues.push({ path: `${prefix}.${node.id}.mask`, message: "Mask dependency cycle detected" });
        break;
      }
      seen.add(sourceId);
      current = nodeById.get(sourceId);
    }
  }
  for (const node of nodes) {
    const seen = new Set([node.id]);
    let current: z.infer<typeof NodeV2Schema> | undefined = node;
    const originModifier = node.modifiers?.find((modifier) => modifier.type === "motion-path");
    while (current) {
      const motionPath = current.modifiers?.find((modifier) => modifier.type === "motion-path");
      if (!motionPath) break;
      if (seen.has(motionPath.pathNodeId)) {
        issues.push({ path: `${prefix}.${node.id}.modifiers.${originModifier?.id ?? motionPath.id}`, message: "Motion Path dependency cycle detected" });
        break;
      }
      seen.add(motionPath.pathNodeId);
      current = nodeById.get(motionPath.pathNodeId);
    }
  }
  for (const node of nodes) {
    const origin = node.modifiers?.find((modifier) => modifier.type === "constraint");
    if (!origin) continue;
    const seen = new Set([node.id]);
    let current: z.infer<typeof NodeV2Schema> | undefined = node;
    while (current) {
      const constraint = current.modifiers?.find((modifier) => modifier.type === "constraint");
      if (!constraint) break;
      if (seen.has(constraint.targetNodeId)) {
        issues.push({ path: `${prefix}.${node.id}.modifiers.${origin.id}`, message: "Constraint dependency cycle detected" });
        break;
      }
      seen.add(constraint.targetNodeId);
      current = nodeById.get(constraint.targetNodeId);
    }
  }
  return issues;
}

function validatePropertyPath(
  node: z.infer<typeof NodeV2Schema>,
  property: string,
  usage: "track" | "binding",
  path: string,
): ReferenceIssue[] {
  const progressMatch = /^modifiers\.([^.]+)\.progress$/.exec(property);
  if (progressMatch && !node.modifiers?.some((modifier) => modifier.id === progressMatch[1] && (modifier.type === "motion-path" || modifier.type === "path-morph"))) {
    return [{ path, message: `Unknown progress modifier: ${progressMatch[1]}` }];
  }
  const trimMatch = /^modifiers\.([^.]+)\.(start|end|offset)$/.exec(property);
  if (trimMatch && !node.modifiers?.some((modifier) => modifier.id === trimMatch[1] && modifier.type === "trim-path")) {
    return [{ path, message: `Unknown trim-path modifier: ${trimMatch[1]}` }];
  }
  const amountMatch = /^modifiers\.([^.]+)\.amount$/.exec(property);
  if (amountMatch && !node.modifiers?.some((modifier) => modifier.id === amountMatch[1] && modifier.type === "path-bend")) {
    return [{ path, message: `Unknown path-bend modifier: ${amountMatch[1]}` }];
  }
  const weightMatch = /^modifiers\.([^.]+)\.weight$/.exec(property);
  if (weightMatch && !node.modifiers?.some((modifier) => modifier.id === weightMatch[1] && modifier.type === "constraint")) {
    return [{ path, message: `Unknown constraint modifier: ${weightMatch[1]}` }];
  }
  const effectMatch = /^effects\.([^.]+)\.([^.]+)$/.exec(property);
  if (effectMatch) {
    const effect = node.effects?.find((candidate) => candidate.id === effectMatch[1]);
    if (!effect) return [{ path, message: `Unknown effect: ${effectMatch[1]}` }];
    if (!motionEffectPropertyCapability(effect.type, effectMatch[2]!)) {
      return [{ path, message: `Unsupported property for ${effect.type} effect: ${effectMatch[2]}` }];
    }
  }
  const capability = motionPropertyCapability(node.type, property);
  if (!capability) return [{ path, message: `Unsupported property for ${node.type}: ${property}` }];
  if (usage === "track" && !capability.animatable) return [{ path, message: `Property is not animatable: ${property}` }];
  if (usage === "track" && capability.runtimeSupport !== "evaluated") return [{ path, message: `Property is not supported by runtime evaluator: ${property}` }];
  if (usage === "binding" && !capability.bindable) return [{ path, message: `Property is not bindable: ${property}` }];
  return [];
}

function validateVariableCapabilityValue(
  variable: z.infer<typeof VariableV2Schema>,
  capability: NonNullable<ReturnType<typeof motionPropertyCapability>>,
  property: string,
  map?: { scale?: number; offset?: number },
): string | undefined {
  if (!motionVariableTypeMatchesValueKind(capability.valueKind, variable.type)) {
    return `Expected ${capability.valueKind} value for ${property}, got variable type ${variable.type}`;
  }
  let value: unknown = variable.value;
  if (typeof value === "number" && map) value = value * (map.scale ?? 1) + (map.offset ?? 0);
  return motionPropertyValueError(capability, value, property);
}

function validateNodeAssets(
  nodes: Array<z.infer<typeof NodeV2Schema>>,
  assets: Array<z.infer<typeof AssetV2Schema>>,
  prefix: string,
): ReferenceIssue[] {
  const issues: ReferenceIssue[] = [];
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  for (const node of nodes) {
    if (node.type === "image" || node.type === "svg" || node.type === "video") {
      const assetId = node.payload.assetId;
      const asset = assetById.get(assetId);
      const path = `${prefix}.${node.id}.payload.assetId`;
      if (!asset) issues.push({ path, message: `Unknown asset: ${assetId}` });
      else {
        const expected = node.type;
        if (asset.assetType !== expected) {
          issues.push({ path, message: `Asset ${assetId} has type ${asset.assetType}, expected ${expected}` });
        } else if (node.type === "video" && asset.assetType === "video") {
          const trimStart = node.payload.trimStart ?? 0;
          const trimEnd = node.payload.trimEnd ?? asset.duration;
          if (trimStart >= trimEnd || trimEnd > asset.duration) {
            issues.push({
              path: `${prefix}.${node.id}.payload`,
              message: `Video trim must satisfy 0 <= trimStart < trimEnd <= ${asset.duration}`,
            });
          }
        }
      }
    }
    const fontAssetId = node.type === "text" ? node.payload.fontAssetId : undefined;
    if (typeof fontAssetId === "string") {
      const asset = assetById.get(fontAssetId);
      const path = `${prefix}.${node.id}.payload.fontAssetId`;
      if (!asset) issues.push({ path, message: `Unknown asset: ${fontAssetId}` });
      else if (asset.assetType !== "font") issues.push({ path, message: `Asset ${fontAssetId} has type ${asset.assetType}, expected font` });
    }
  }
  return issues;
}

function clipScheduleStarts(clips: Array<z.infer<typeof ClipV2Schema>>): Map<string, number> {
  const byId = new Map(clips.map((clip) => [clip.id, clip]));
  const starts = new Map<string, number>();
  const visiting = new Set<string>();
  const resolve = (clip: z.infer<typeof ClipV2Schema>): number | undefined => {
    const cached = starts.get(clip.id);
    if (cached !== undefined) return cached;
    if (visiting.has(clip.id)) return undefined;
    visiting.add(clip.id);
    let start: number | undefined;
    if (clip.schedule.kind === "absolute") start = clip.schedule.at;
    else {
      const dependency = byId.get(clip.schedule.clipId);
      const dependencyStart = dependency ? resolve(dependency) : undefined;
      if (dependency && dependencyStart !== undefined) start = dependencyStart + (clip.schedule.kind === "after" ? dependency.duration : 0) + (clip.schedule.offset ?? 0);
    }
    visiting.delete(clip.id);
    if (start !== undefined) starts.set(clip.id, start);
    return start;
  };
  for (const clip of clips) resolve(clip);
  return starts;
}

function validateClips(
  clips: Array<z.infer<typeof ClipV2Schema>>,
  nodes: Array<z.infer<typeof NodeV2Schema>>,
  variables: Array<z.infer<typeof VariableV2Schema>>,
  prefix: string,
  options: {
    allowComponentAction?: boolean;
    variantSlots?: Map<string, z.infer<typeof CutoutVariantSlotSchema>>;
  } = {},
): ReferenceIssue[] {
  const issues: ReferenceIssue[] = [];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const variableById = new Map(variables.map((variable) => [variable.id, variable]));
  const clipById = new Map(clips.map((clip) => [clip.id, clip]));
  for (const id of new Set(duplicates(clips.map((clip) => clip.id)))) issues.push({ path: prefix, message: `Duplicate clip id: ${id}` });
  for (const clip of clips) {
    if (clip.targetId && !nodeById.has(clip.targetId)) issues.push({ path: `${prefix}.${clip.id}.targetId`, message: `Unknown node: ${clip.targetId}` });
    if (clip.targetId) {
      const target = nodeById.get(clip.targetId);
      if (target?.type === "text" && target.textAnimator) issues.push({ path: `${prefix}.${clip.id}.targetId`, message: "Text Animator node cannot be targeted by authored clips; animate its parent or animator properties" });
    }
    if (clip.source.kind === "component-action") {
      const target = clip.targetId ? nodeById.get(clip.targetId) : undefined;
      if (!options.allowComponentAction) issues.push({ path: `${prefix}.${clip.id}.source`, message: "Component Action invocation is only allowed in Project scenes" });
      if (!clip.targetId) issues.push({ path: `${prefix}.${clip.id}.targetId`, message: "Component Action requires a target Component instance" });
      else if (target && target.type !== "component") issues.push({ path: `${prefix}.${clip.id}.targetId`, message: `Component Action target has type ${target.type}, expected component` });
    }
    if (clip.schedule.kind !== "absolute" && !clipById.has(clip.schedule.clipId)) {
      issues.push({ path: `${prefix}.${clip.id}.schedule`, message: `Unknown schedule clip: ${clip.schedule.clipId}` });
    }
    if (clip.source.kind === "tracks") {
      for (const track of clip.source.tracks) {
        const trackPath = `${prefix}.${clip.id}.source.tracks.${track.property}`;
        const node = nodeById.get(track.targetId);
        const variantSlot = options.variantSlots?.get(track.targetId);
        const isVariantTrack = track.property === "payload.variantId";
        if (!node) issues.push({ path: trackPath, message: `Unknown node: ${track.targetId}` });
        if (node?.type === "text" && node.textAnimator) issues.push({ path: trackPath, message: "Text Animator node cannot be targeted by authored tracks; animate its parent or animator properties" });
        if (isVariantTrack && !variantSlot) issues.push({ path: trackPath, message: `Variant track target is not a cut-out slot: ${track.targetId}` });
        const capability = node && !isVariantTrack ? motionPropertyCapability(node.type, track.property) : undefined;
        if (node && !isVariantTrack) issues.push(...validatePropertyPath(node, track.property, "track", trackPath));
        for (let index = 0; index < track.keys.length; index += 1) {
          const key = track.keys[index]!;
          if (key.t > clip.duration) issues.push({ path: trackPath, message: `Key time ${key.t} exceeds clip duration ${clip.duration}` });
          if (index > 0 && key.t <= track.keys[index - 1]!.t) {
            issues.push({ path: trackPath, message: "Key times must be strictly increasing" });
            break;
          }
          if (isVariantTrack && variantSlot) {
            if (typeof key.v !== "string" || !variantSlot.variants.some((variant) => variant.id === key.v)) {
              issues.push({ path: trackPath, message: `Unknown variant ${String(key.v)} for slot ${variantSlot.id}` });
            }
          } else if (capability) {
            const value = key.v;
            const referenceValue = value !== null && typeof value === "object" && !Array.isArray(value)
              ? value as { ref?: { kind?: unknown; id?: unknown }; map?: { scale?: number; offset?: number } }
              : undefined;
            const reference = referenceValue?.ref;
            if (reference?.kind === "variable" && typeof reference.id === "string") {
              const variable = variableById.get(reference.id);
              if (variable) {
                const message = validateVariableCapabilityValue(variable, capability, track.property, referenceValue?.map);
                if (message) issues.push({ path: trackPath, message });
              }
            } else {
              const message = motionPropertyValueError(capability, value, track.property);
              if (message) issues.push({ path: trackPath, message });
            }
          }
        }
      }
    }
  }
  for (const clip of clips) {
    const seen = new Set<string>([clip.id]);
    let cursor = clip;
    while (cursor.schedule.kind !== "absolute") {
      const dependencyId = cursor.schedule.clipId;
      if (seen.has(dependencyId)) {
        issues.push({ path: `${prefix}.${clip.id}.schedule`, message: "Clip schedule cycle detected" });
        break;
      }
      seen.add(dependencyId);
      const dependency = clipById.get(dependencyId);
      if (!dependency) break;
      cursor = dependency;
    }
  }
  return issues;
}

export function validateMotionComponentV2References(component: MotionComponentV2): ReferenceIssue[] {
  const issues = validateNodeGraph(component.nodes, "nodes");
  issues.push(...validateNodeAssets(component.nodes, component.assets, "nodes"));
  const variableIds = new Set(component.variables.map((variable) => variable.id));
  const nodeIds = new Set(component.nodes.map((node) => node.id));
  for (const id of new Set(duplicates(component.variables.map((variable) => variable.id)))) issues.push({ path: "variables", message: `Duplicate variable id: ${id}` });
  for (const id of new Set(duplicates(component.assets.map((asset) => asset.id)))) issues.push({ path: "assets", message: `Duplicate asset id: ${id}` });
  for (const id of new Set(duplicates(component.publicAPI.map((api) => api.id)))) issues.push({ path: "publicAPI", message: `Duplicate public API id: ${id}` });
  issues.push(...validateClips(component.clips, component.nodes, component.variables, "clips"));
  const assetById = new Map(component.assets.map((asset) => [asset.id, asset]));
  const nodeById = new Map(component.nodes.map((node) => [node.id, node]));
  for (const id of new Set(duplicates(component.sourceImports.map((sourceImport) => sourceImport.id)))) issues.push({ path: "sourceImports", message: `Duplicate source import id: ${id}` });
  for (const sourceImport of component.sourceImports) {
    const sourceAsset = assetById.get(sourceImport.sourceAssetId);
    if (!sourceAsset) issues.push({ path: `sourceImports.${sourceImport.id}.sourceAssetId`, message: `Unknown source SVG asset: ${sourceImport.sourceAssetId}` });
    else if (sourceAsset.assetType !== "svg") issues.push({ path: `sourceImports.${sourceImport.id}.sourceAssetId`, message: `Source import asset has type ${sourceAsset.assetType}, expected svg` });
    else if (sourceAsset.integrity !== sourceImport.sourceIntegrity) issues.push({ path: `sourceImports.${sourceImport.id}.sourceIntegrity`, message: "Source import integrity does not match source asset" });
    for (const id of new Set(duplicates(sourceImport.parts.map((part) => part.id)))) issues.push({ path: `sourceImports.${sourceImport.id}.parts`, message: `Duplicate source part id: ${id}` });
    const sourceOwners = new Map<string, string>();
    for (const part of sourceImport.parts) {
      for (const sourceElementId of part.sourceElementIds) {
        const owner = sourceOwners.get(sourceElementId);
        if (owner) issues.push({ path: `sourceImports.${sourceImport.id}.parts.${part.id}.sourceElementIds`, message: `Source element ${sourceElementId} is already assigned to part ${owner}` });
        else sourceOwners.set(sourceElementId, part.id);
      }
      const node = nodeById.get(part.nodeId);
      const outputAsset = assetById.get(part.outputAssetId);
      if (!node) issues.push({ path: `sourceImports.${sourceImport.id}.parts.${part.id}.nodeId`, message: `Unknown mapped node: ${part.nodeId}` });
      else if (node.type !== "svg") issues.push({ path: `sourceImports.${sourceImport.id}.parts.${part.id}.nodeId`, message: `Mapped part node has type ${node.type}, expected svg` });
      else if (node.payload.assetId !== part.outputAssetId) issues.push({ path: `sourceImports.${sourceImport.id}.parts.${part.id}.outputAssetId`, message: `Mapped output asset does not match node ${part.nodeId}` });
      if (!outputAsset) issues.push({ path: `sourceImports.${sourceImport.id}.parts.${part.id}.outputAssetId`, message: `Unknown output asset: ${part.outputAssetId}` });
      else if (outputAsset.assetType !== "svg") issues.push({ path: `sourceImports.${sourceImport.id}.parts.${part.id}.outputAssetId`, message: `Output part asset has type ${outputAsset.assetType}, expected svg` });
    }
  }
  for (const id of new Set(duplicates(component.cutoutRigs.map((rig) => rig.id)))) issues.push({ path: "cutoutRigs", message: `Duplicate cut-out rig id: ${id}` });
  const variantSlotByNode = new Map<string, z.infer<typeof CutoutVariantSlotSchema>>();
  const variantSlotById = new Map<string, z.infer<typeof CutoutVariantSlotSchema>>();
  for (const rig of component.cutoutRigs) {
    if (!nodeById.has(rig.rootNodeId)) issues.push({ path: `cutoutRigs.${rig.id}.rootNodeId`, message: `Unknown rig root: ${rig.rootNodeId}` });
    for (const id of new Set(duplicates(rig.slots.map((slot) => slot.id)))) issues.push({ path: `cutoutRigs.${rig.id}.slots`, message: `Duplicate variant slot id: ${id}` });
    for (const slot of rig.slots) {
      const node = nodeById.get(slot.nodeId);
      if (!node) issues.push({ path: `cutoutRigs.${rig.id}.slots.${slot.id}.nodeId`, message: `Unknown slot node: ${slot.nodeId}` });
      else if (node.type !== "svg") issues.push({ path: `cutoutRigs.${rig.id}.slots.${slot.id}.nodeId`, message: `Variant slot node has type ${node.type}, expected svg` });
      if (variantSlotByNode.has(slot.nodeId)) issues.push({ path: `cutoutRigs.${rig.id}.slots.${slot.id}.nodeId`, message: `Node already owns a variant slot: ${slot.nodeId}` });
      else variantSlotByNode.set(slot.nodeId, slot);
      if (!variantSlotById.has(slot.id)) variantSlotById.set(slot.id, slot);
      for (const id of new Set(duplicates(slot.variants.map((variant) => variant.id)))) issues.push({ path: `cutoutRigs.${rig.id}.slots.${slot.id}.variants`, message: `Duplicate variant id: ${id}` });
      const defaultVariant = slot.variants.find((variant) => variant.id === slot.defaultVariantId);
      if (!defaultVariant) issues.push({ path: `cutoutRigs.${rig.id}.slots.${slot.id}.defaultVariantId`, message: `Unknown default variant: ${slot.defaultVariantId}` });
      else if (node?.type === "svg" && node.payload.assetId !== defaultVariant.assetId) issues.push({ path: `cutoutRigs.${rig.id}.slots.${slot.id}.defaultVariantId`, message: "Slot node asset must match its default variant" });
      for (const variant of slot.variants) {
        const asset = assetById.get(variant.assetId);
        if (!asset) issues.push({ path: `cutoutRigs.${rig.id}.slots.${slot.id}.variants.${variant.id}.assetId`, message: `Unknown variant asset: ${variant.assetId}` });
        else if (asset.assetType !== "svg") issues.push({ path: `cutoutRigs.${rig.id}.slots.${slot.id}.variants.${variant.id}.assetId`, message: `Variant asset has type ${asset.assetType}, expected svg` });
      }
    }
  }
  for (const id of new Set(duplicates(component.actions.map((action) => action.id)))) issues.push({ path: "actions", message: `Duplicate action id: ${id}` });
  for (const action of component.actions) {
    issues.push(...validateClips(action.clips, component.nodes, component.variables, `actions.${action.id}.clips`, { variantSlots: variantSlotByNode }));
    if (action.lipSync) {
      const slot = variantSlotById.get(action.lipSync.slotId);
      const cuePath = `actions.${action.id}.lipSync`;
      if (!slot) issues.push({ path: `${cuePath}.slotId`, message: `Unknown lip-sync slot: ${action.lipSync.slotId}` });
      for (let index = 0; index < action.lipSync.cues.length; index += 1) {
        const cue = action.lipSync.cues[index]!;
        if (cue.at > action.duration) issues.push({ path: `${cuePath}.cues.${cue.id}`, message: `Lip-sync cue time ${cue.at} exceeds action duration ${action.duration}` });
        if (index > 0 && cue.at <= action.lipSync.cues[index - 1]!.at) {
          issues.push({ path: cuePath, message: "Lip-sync cue times must be strictly increasing" });
          break;
        }
        if (slot && !slot.variants.some((variant) => variant.id === cue.variantId)) {
          issues.push({ path: `${cuePath}.cues.${cue.id}.variantId`, message: `Unknown lip-sync variant ${cue.variantId} for slot ${slot.id}` });
        }
      }
    }
    const starts = clipScheduleStarts(action.clips);
    for (const clip of action.clips) {
      const start = starts.get(clip.id);
      if (start !== undefined && start + clip.duration > action.duration) issues.push({ path: `actions.${action.id}.clips.${clip.id}`, message: `Action clip exceeds action duration ${action.duration}` });
    }
  }
  for (const api of component.publicAPI) {
    if (!variableIds.has(api.variableId)) issues.push({ path: `publicAPI.${api.id}.variableId`, message: `Unknown variable: ${api.variableId}` });
    const variable = component.variables.find((candidate) => candidate.id === api.variableId);
    if (variable && variable.type !== api.type) issues.push({ path: `publicAPI.${api.id}.type`, message: `Expected variable type ${variable.type}, got ${api.type}` });
  }
  for (const binding of component.bindings) {
    if (binding.source.kind === "variable" && !variableIds.has(binding.source.variableId)) {
      issues.push({ path: `bindings.${binding.id}.source`, message: `Unknown variable: ${binding.source.variableId}` });
    }
    const target = component.nodes.find((node) => node.id === binding.target.nodeId);
    if (!target) issues.push({ path: `bindings.${binding.id}.target`, message: `Unknown node: ${binding.target.nodeId}` });
    else {
      const propertyPath = `bindings.${binding.id}.target.property`;
      issues.push(...validatePropertyPath(target, binding.target.property, "binding", propertyPath));
      if (binding.source.kind === "variable") {
        const variableId = binding.source.variableId;
        const variable = component.variables.find((candidate) => candidate.id === variableId);
        const capability = motionPropertyCapability(target.type, binding.target.property);
        if (variable && capability) {
          const message = validateVariableCapabilityValue(variable, capability, binding.target.property);
          if (message) issues.push({ path: propertyPath, message: message.replace("value for", "binding for") });
        }
      }
    }
  }
  const componentBindingTargets = new Map<string, string>();
  for (const binding of component.bindings) {
    const key = `${binding.target.nodeId}\u0000${binding.target.property}`;
    const previous = componentBindingTargets.get(key);
    if (previous) {
      issues.push({
        path: `bindings.${binding.id}.target`,
        message: `Duplicate binding target ${binding.target.nodeId}.${binding.target.property} (also bound by ${previous})`,
      });
    } else {
      componentBindingTargets.set(key, binding.id);
    }
  }
  for (const node of component.nodes) {
    if (node.repeat?.source.kind !== "list") continue;
    const source = node.repeat.source;
    const variable = component.variables.find((candidate) => candidate.id === source.variableId);
    if (!variable) {
      issues.push({ path: `nodes.${node.id}.repeat.source.variableId`, message: `Unknown variable: ${source.variableId}` });
      continue;
    }
    if (variable.type !== "list") {
      issues.push({ path: `nodes.${node.id}.repeat.source.variableId`, message: `Repeater source must be a list variable: ${source.variableId}` });
      continue;
    }
    const keys: string[] = [];
    variable.value.forEach((item, index) => {
      const key = valueAtPath(item, source.keyPath);
      if (typeof key !== "string" && typeof key !== "number") issues.push({ path: `nodes.${node.id}.repeat.source.keyPath`, message: `Repeater key ${source.keyPath} is missing at item ${index}` });
      else keys.push(String(key));
    });
    for (const key of new Set(duplicates(keys))) issues.push({ path: `nodes.${node.id}.repeat.source.keyPath`, message: `Duplicate Repeater key: ${key}` });
  }
  const referencedVariables = new Set<string>();
  const collectReferences = (value: unknown): void => {
    if (Array.isArray(value)) { for (const item of value) collectReferences(item); return; }
    if (value === null || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    if (record.ref && typeof record.ref === "object" && (record.ref as Record<string, unknown>).kind === "variable") {
      const id = (record.ref as Record<string, unknown>).id;
      if (typeof id === "string") referencedVariables.add(id);
    }
    for (const nested of Object.values(record)) collectReferences(nested);
  };
  collectReferences(component.clips);
  collectReferences(component.actions);
  for (const variableId of referencedVariables) if (!variableIds.has(variableId)) issues.push({ path: "clips", message: `Unknown referenced variable: ${variableId}` });
  return issues;
}

export function validateMotionProjectV2References(project: MotionProjectV2): ReferenceIssue[] {
  const issues: ReferenceIssue[] = [];
  const sceneById = new Map(project.scenes.map((scene) => [scene.id, scene]));
  const variableIds = new Set(project.variables.map((variable) => variable.id));
  const dependencies = new Set(project.dependencies.components.map((dependency) => `${dependency.componentId}@${dependency.version}`));
  for (const id of new Set(duplicates(project.scenes.map((scene) => scene.id)))) issues.push({ path: "scenes", message: `Duplicate scene id: ${id}` });
  for (const id of new Set(duplicates(project.variables.map((variable) => variable.id)))) issues.push({ path: "variables", message: `Duplicate variable id: ${id}` });
  for (const id of new Set(duplicates(project.assets.map((asset) => asset.id)))) issues.push({ path: "assets", message: `Duplicate asset id: ${id}` });
  for (const id of new Set(duplicates(project.bindings.map((binding) => binding.id)))) issues.push({ path: "bindings", message: `Duplicate binding id: ${id}` });
  for (const sceneId of project.timeline.sceneOrder) if (!sceneById.has(sceneId)) issues.push({ path: "timeline.sceneOrder", message: `Unknown scene: ${sceneId}` });
  if (new Set(project.timeline.sceneOrder).size !== project.timeline.sceneOrder.length) issues.push({ path: "timeline.sceneOrder", message: "Scene order contains duplicates" });
  for (const sceneId of sceneById.keys()) if (!project.timeline.sceneOrder.includes(sceneId)) issues.push({ path: "timeline.sceneOrder", message: `Scene is not scheduled: ${sceneId}` });
  project.timeline.sceneOrder.forEach((sceneId, index) => {
    const scene = sceneById.get(sceneId);
    const transition = scene?.transition;
    if (!transition || transition.type === "cut") return;
    const next = sceneById.get(project.timeline.sceneOrder[index + 1] ?? "");
    if (!next) {
      issues.push({ path: `scenes.${sceneId}.transition`, message: "Transition requires a following scene" });
    } else if (transition.duration > next.duration) {
      issues.push({ path: `scenes.${sceneId}.transition.duration`, message: `Transition duration ${transition.duration} exceeds next scene duration ${next.duration}` });
    }
  });
  for (const audio of project.timeline.audioTracks) {
    const asset = project.assets.find((candidate) => candidate.id === audio.assetId);
    const path = `timeline.audioTracks.${audio.id}.assetId`;
    if (!asset) issues.push({ path, message: `Unknown asset: ${audio.assetId}` });
    else if (asset.assetType !== "audio") issues.push({ path, message: `Asset ${audio.assetId} has type ${asset.assetType}, expected audio` });
  }
  if (project.metadata.brand.logoAssetId) {
    const logo = project.assets.find((asset) => asset.id === project.metadata.brand.logoAssetId);
    if (!logo) issues.push({ path: "metadata.brand.logoAssetId", message: `Unknown asset: ${project.metadata.brand.logoAssetId}` });
    else if (logo.assetType !== "image" && logo.assetType !== "svg") issues.push({ path: "metadata.brand.logoAssetId", message: `Asset ${logo.id} has type ${logo.assetType}, expected image or svg` });
  }
  for (const scene of project.scenes) {
    issues.push(...validateNodeGraph(scene.nodes, `scenes.${scene.id}.nodes`));
    issues.push(...validateNodeAssets(scene.nodes, project.assets, `scenes.${scene.id}.nodes`));
    issues.push(...validateClips(scene.clips, scene.nodes, project.variables, `scenes.${scene.id}.clips`, { allowComponentAction: true }));
    const nodeIds = new Set(scene.nodes.map((node) => node.id));
    if (scene.activeCameraId) {
      const camera = scene.nodes.find((node) => node.id === scene.activeCameraId);
      if (!camera) issues.push({ path: `scenes.${scene.id}.activeCameraId`, message: `Unknown camera: ${scene.activeCameraId}` });
      else if (camera.type !== "camera") issues.push({ path: `scenes.${scene.id}.activeCameraId`, message: `Node ${scene.activeCameraId} has type ${camera.type}, expected camera` });
    }
    const transition = scene.transition;
    if (transition && transition.type !== "cut" && transition.duration > scene.duration) {
      issues.push({ path: `scenes.${scene.id}.transition.duration`, message: `Transition duration ${transition.duration} exceeds scene duration ${scene.duration}` });
    }
    for (const node of scene.nodes) {
      if (node.type === "component") {
        const dependency = `${node.payload.componentId}@${node.payload.componentVersion}`;
        if (!dependencies.has(dependency)) issues.push({ path: `scenes.${scene.id}.nodes.${node.id}.payload`, message: `Unpinned component dependency: ${dependency}` });
      }
    }
  }
  for (const binding of project.bindings) {
    if (!variableIds.has(binding.source.variableId)) issues.push({ path: `bindings.${binding.id}.source`, message: `Unknown variable: ${binding.source.variableId}` });
    const scene = sceneById.get(binding.target.sceneId);
    if (!scene) issues.push({ path: `bindings.${binding.id}.target.sceneId`, message: `Unknown scene: ${binding.target.sceneId}` });
    else {
      const target = scene.nodes.find((node) => node.id === binding.target.nodeId);
      if (!target) issues.push({ path: `bindings.${binding.id}.target.nodeId`, message: `Unknown node: ${binding.target.nodeId}` });
      else {
        const propertyPath = `bindings.${binding.id}.target.property`;
        issues.push(...validatePropertyPath(target, binding.target.property, "binding", propertyPath));
        const variable = project.variables.find((candidate) => candidate.id === binding.source.variableId);
        const capability = motionPropertyCapability(target.type, binding.target.property);
        if (variable && capability) {
          const message = validateVariableCapabilityValue(variable, capability, binding.target.property);
          if (message) issues.push({ path: propertyPath, message: message.replace("value for", "binding for") });
        }
      }
    }
  }
  const projectBindingTargets = new Map<string, string>();
  for (const binding of project.bindings) {
    const key = `${binding.target.sceneId}\u0000${binding.target.nodeId}\u0000${binding.target.property}`;
    const previous = projectBindingTargets.get(key);
    if (previous) {
      issues.push({
        path: `bindings.${binding.id}.target`,
        message: `Duplicate binding target ${binding.target.sceneId}/${binding.target.nodeId}.${binding.target.property} (also bound by ${previous})`,
      });
    } else {
      projectBindingTargets.set(key, binding.id);
    }
  }
  return issues;
}

export function parseMotionComponentV2(input: unknown): MotionComponentV2 {
  const component = MotionComponentV2Schema.parse(input);
  const issues = validateMotionComponentV2References(component);
  if (issues.length > 0) throw new MotionV2ReferenceError(issues);
  return component;
}

export function parseMotionProjectV2(input: unknown): MotionProjectV2 {
  const project = MotionProjectV2Schema.parse(input);
  const issues = validateMotionProjectV2References(project);
  if (issues.length > 0) throw new MotionV2ReferenceError(issues);
  return project;
}

export function serializeMotionProjectV2(project: MotionProjectV2): string {
  return `${JSON.stringify(project, null, 2)}\n`;
}

function setRecordPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let cursor: Record<string, unknown> = target;
  for (const part of parts.slice(0, -1)) {
    const current = cursor[part];
    if (current === null || typeof current !== "object" || Array.isArray(current)) cursor[part] = {};
    cursor = cursor[part] as Record<string, unknown>;
  }
  const last = parts.at(-1);
  if (last) cursor[last] = value;
}

/** Apply a public-surface patch: project variables or Component Instance `payload.props.*` only. */
export function applyMotionPatch(project: MotionProjectV2, patchInput: unknown): MotionProjectV2 {
  const patch = MotionPatchSchema.parse(patchInput);
  const next = JSON.parse(JSON.stringify(project)) as MotionProjectV2;
  const issues: ReferenceIssue[] = [];
  for (let index = 0; index < patch.operations.length; index += 1) {
    const operation = patch.operations[index]!;
    const path = `operations.${index}`;
    const target = operation.target;
    if ("variableId" in target) {
      const variableId = target.variableId;
      const variable = next.variables.find((candidate) => candidate.id === variableId);
      if (!variable) {
        issues.push({ path: `${path}.target.variableId`, message: `Unknown variable: ${variableId}` });
        continue;
      }
      (variable as { value: unknown }).value = operation.value;
      continue;
    }
    const { sceneId, nodeId, property } = target;
    if (!property.startsWith("payload.props.")) {
      issues.push({ path: `${path}.target.property`, message: "Patch may only set public payload.props.* or project variables" });
      continue;
    }
    const scene = next.scenes.find((candidate) => candidate.id === sceneId);
    if (!scene) {
      issues.push({ path: `${path}.target.sceneId`, message: `Unknown scene: ${sceneId}` });
      continue;
    }
    const node = scene.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) {
      issues.push({ path: `${path}.target.nodeId`, message: `Unknown node: ${nodeId}` });
      continue;
    }
    if (node.type !== "component") {
      issues.push({ path: `${path}.target.nodeId`, message: `Patch node target must be a component instance: ${nodeId}` });
      continue;
    }
    setRecordPath(node as unknown as Record<string, unknown>, property, operation.value);
  }
  if (issues.length > 0) throw new MotionV2ReferenceError(issues);
  return parseMotionProjectV2(next);
}

export class MotionV2ReferenceError extends Error {
  constructor(public readonly issues: ReferenceIssue[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
    this.name = "MotionV2ReferenceError";
  }
}
