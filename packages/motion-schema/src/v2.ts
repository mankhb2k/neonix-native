import { z } from "zod";
import {
  MOTION_V2_LIMITS,
  motionLiteralMatchesValueKind,
  motionPropertyCapability,
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

const RepeaterSchema = z
  .object({
    sourceVariableId: IdSchema,
    itemAlias: IdSchema.default("item"),
    indexAlias: IdSchema.default("index"),
    keyPath: PropertyPathSchema,
    layout: z
      .object({
        direction: z.enum(["horizontal", "vertical"]),
        gap: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.nodeDimension),
      })
      .strict(),
  })
  .strict();

const NodeBaseSchema = z.object({
  id: IdSchema,
  type: IdSchema,
  name: z.string().min(1).optional(),
  parentId: IdSchema.nullable(),
  zIndex: FiniteNumberSchema.int().optional(),
  transform: TransformV2Schema,
  semantic: SemanticSchema.optional(),
  repeat: RepeaterSchema.optional(),
  inheritPosition: z.boolean().optional(),
  inheritRotation: z.boolean().optional(),
  inheritScale: z.boolean().optional(),
  inheritOpacity: z.boolean().optional(),
  maskId: IdSchema.optional(),
});

const FitSchema = z.enum(["contain", "cover", "fill", "none"]);

const CropSchema = z.object({
  x: FiniteNumberSchema.min(0).max(1),
  y: FiniteNumberSchema.min(0).max(1),
  width: FiniteNumberSchema.positive().max(1),
  height: FiniteNumberSchema.positive().max(1),
}).strict();

const PaintStyleSchema = z.object({
  fill: z.string().min(1).optional(),
  stroke: z.string().min(1).optional(),
  strokeWidth: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.nodeDimension).optional(),
}).strict();

export const GroupNodeV2Schema = NodeBaseSchema.extend({
  type: z.literal("group"),
}).strict();

export const BoneNodeV2Schema = NodeBaseSchema.extend({
  type: z.literal("bone"),
  payload: z.object({
    length: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.nodeDimension),
    restRotation: FiniteNumberSchema.optional(),
  }).strict(),
}).strict();

export const TextNodeV2Schema = NodeBaseSchema.extend({
  type: z.literal("text"),
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
]);

export const ShapeNodeV2Schema = NodeBaseSchema.extend({
  type: z.literal("shape"),
  payload: ShapePayloadSchema,
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

export const NodeV2Schema = z.discriminatedUnion("type", [
  GroupNodeV2Schema,
  BoneNodeV2Schema,
  TextNodeV2Schema,
  ShapeNodeV2Schema,
  ImageNodeV2Schema,
  SvgNodeV2Schema,
  VideoNodeV2Schema,
  CameraNodeV2Schema,
  ComponentNodeV2Schema,
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
  .strict();

const PropertyTrackSchema = z
  .object({
    targetId: IdSchema,
    property: PropertyPathSchema,
    keys: z
      .array(
        z
          .object({
            t: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.mediaDurationSeconds),
            v: ResolvableValueSchema,
            easing: z.enum(["linear", "easeIn", "easeOut", "easeInOut", "spring", "step"]).optional(),
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

export const PublicParamSchema = z
  .object({
    id: IdSchema,
    type: z.enum(["string", "color", "number", "boolean", "image", "enum", "list"]),
    label: z.string().min(1).optional(),
    variableId: IdSchema,
    semantic: SemanticSchema.optional(),
    min: FiniteNumberSchema.optional(),
    max: FiniteNumberSchema.optional(),
    options: z.array(z.string()).min(1).max(MOTION_V2_LIMITS.enumOptions).optional(),
  })
  .strict();

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

const SceneV2Schema = z
  .object({
    id: IdSchema,
    name: z.string().min(1).optional(),
    duration: FiniteNumberSchema.positive().max(MOTION_V2_LIMITS.mediaDurationSeconds),
    semantic: SemanticSchema.optional(),
    nodes: z.array(NodeV2Schema).max(MOTION_V2_LIMITS.nodesPerScene),
    clips: z.array(ClipV2Schema).max(MOTION_V2_LIMITS.clipsPerScene),
    activeCameraId: IdSchema.optional(),
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
        sceneOrder: z.array(IdSchema).min(1).max(MOTION_V2_LIMITS.scenesPerProject),
        audioTracks: z.array(AudioTrackSchema).max(MOTION_V2_LIMITS.audioTracksPerProject).default([]),
      })
      .strict(),
    scenes: z.array(SceneV2Schema).min(1).max(MOTION_V2_LIMITS.scenesPerProject),
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
  TextNodeV2Schema.omit({ repeat: true }),
  ShapeNodeV2Schema.omit({ repeat: true }),
  ImageNodeV2Schema.omit({ repeat: true }),
  SvgNodeV2Schema.omit({ repeat: true }),
  VideoNodeV2Schema.omit({ repeat: true }),
  CameraNodeV2Schema.omit({ repeat: true }),
]);

const RuntimeTrackSchema = z
  .object({
    targetId: IdSchema,
    property: PropertyPathSchema,
    keys: z.array(z.object({ t: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.mediaDurationSeconds), v: LiteralValueSchema, easing: z.string().optional() }).strict()).min(1).max(MOTION_V2_LIMITS.keysPerTrack),
  })
  .strict();

export const NormalizedMotionProjectV2Schema = z
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
        nodes: z.array(RuntimeNodeSchema).max(MOTION_V2_LIMITS.nodesPerScene),
        tracks: z.array(RuntimeTrackSchema).max(MOTION_V2_LIMITS.clipsPerScene * MOTION_V2_LIMITS.tracksPerClip),
      }).strict(),
    ).max(MOTION_V2_LIMITS.scenesPerProject),
  })
  .strict();

export type MotionComponentV2 = z.infer<typeof MotionComponentV2Schema>;
export type MotionProjectV2 = z.infer<typeof MotionProjectV2Schema>;
export type MotionTransform = z.infer<typeof TransformV2Schema>;
export type MotionNode = z.infer<typeof NodeV2Schema>;
export type MotionScene = z.infer<typeof SceneV2Schema>;
export type MotionClip = z.infer<typeof ClipV2Schema>;
export type AspectRatio = z.infer<typeof AspectRatioSchema>;
export type MotionPatch = z.infer<typeof MotionPatchSchema>;
export type NormalizedMotionProjectV2 = z.infer<typeof NormalizedMotionProjectV2Schema>;

export interface ReferenceIssue {
  path: string;
  message: string;
}

function duplicates(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) !== index);
}

function validateNodeGraph(nodes: Array<z.infer<typeof NodeV2Schema>>, prefix: string): ReferenceIssue[] {
  const issues: ReferenceIssue[] = [];
  const ids = nodes.map((node) => node.id);
  for (const id of new Set(duplicates(ids))) issues.push({ path: prefix, message: `Duplicate node id: ${id}` });
  const idSet = new Set(ids);
  const parentById = new Map(nodes.map((node) => [node.id, node.parentId]));
  for (const node of nodes) {
    if (node.parentId !== null && !idSet.has(node.parentId)) {
      issues.push({ path: `${prefix}.${node.id}.parentId`, message: `Unknown parent: ${node.parentId}` });
    }
    if (node.maskId && !idSet.has(node.maskId)) {
      issues.push({ path: `${prefix}.${node.id}.maskId`, message: `Unknown mask: ${node.maskId}` });
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
  return issues;
}

function validatePropertyPath(
  node: z.infer<typeof NodeV2Schema>,
  property: string,
  usage: "track" | "binding",
  path: string,
): ReferenceIssue[] {
  const capability = motionPropertyCapability(node.type, property);
  if (!capability) return [{ path, message: `Unsupported property for ${node.type}: ${property}` }];
  if (usage === "track" && !capability.animatable) return [{ path, message: `Property is not animatable: ${property}` }];
  if (usage === "binding" && !capability.bindable) return [{ path, message: `Property is not bindable: ${property}` }];
  return [];
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

function validateClips(
  clips: Array<z.infer<typeof ClipV2Schema>>,
  nodes: Array<z.infer<typeof NodeV2Schema>>,
  variables: Array<z.infer<typeof VariableV2Schema>>,
  prefix: string,
): ReferenceIssue[] {
  const issues: ReferenceIssue[] = [];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const variableById = new Map(variables.map((variable) => [variable.id, variable]));
  const clipById = new Map(clips.map((clip) => [clip.id, clip]));
  for (const id of new Set(duplicates(clips.map((clip) => clip.id)))) issues.push({ path: prefix, message: `Duplicate clip id: ${id}` });
  for (const clip of clips) {
    if (clip.targetId && !nodeById.has(clip.targetId)) issues.push({ path: `${prefix}.${clip.id}.targetId`, message: `Unknown node: ${clip.targetId}` });
    if (clip.schedule.kind !== "absolute" && !clipById.has(clip.schedule.clipId)) {
      issues.push({ path: `${prefix}.${clip.id}.schedule`, message: `Unknown schedule clip: ${clip.schedule.clipId}` });
    }
    if (clip.source.kind === "tracks") {
      for (const track of clip.source.tracks) {
        const trackPath = `${prefix}.${clip.id}.source.tracks.${track.property}`;
        const node = nodeById.get(track.targetId);
        if (!node) issues.push({ path: trackPath, message: `Unknown node: ${track.targetId}` });
        const capability = node ? motionPropertyCapability(node.type, track.property) : undefined;
        if (node) issues.push(...validatePropertyPath(node, track.property, "track", trackPath));
        for (let index = 0; index < track.keys.length; index += 1) {
          const key = track.keys[index]!;
          if (key.t > clip.duration) issues.push({ path: trackPath, message: `Key time ${key.t} exceeds clip duration ${clip.duration}` });
          if (index > 0 && key.t <= track.keys[index - 1]!.t) {
            issues.push({ path: trackPath, message: "Key times must be strictly increasing" });
            break;
          }
          if (capability) {
            const value = key.v;
            const reference = value !== null && typeof value === "object" && !Array.isArray(value)
              ? (value as { ref?: { kind?: unknown; id?: unknown } }).ref
              : undefined;
            if (reference?.kind === "variable" && typeof reference.id === "string") {
              const variable = variableById.get(reference.id);
              if (variable && !motionVariableTypeMatchesValueKind(capability.valueKind, variable.type)) {
                issues.push({ path: trackPath, message: `Expected ${capability.valueKind} value for ${track.property}, got variable type ${variable.type}` });
              }
            } else if (!motionLiteralMatchesValueKind(capability.valueKind, value)) {
              issues.push({ path: trackPath, message: `Expected ${capability.valueKind} value for ${track.property}` });
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
        if (variable && capability && !motionVariableTypeMatchesValueKind(capability.valueKind, variable.type)) {
          issues.push({ path: propertyPath, message: `Expected ${capability.valueKind} binding for ${binding.target.property}, got variable type ${variable.type}` });
        }
      }
    }
  }
  for (const node of component.nodes) {
    if (node.repeat && !variableIds.has(node.repeat.sourceVariableId)) issues.push({ path: `nodes.${node.id}.repeat.sourceVariableId`, message: `Unknown variable: ${node.repeat.sourceVariableId}` });
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
    issues.push(...validateClips(scene.clips, scene.nodes, project.variables, `scenes.${scene.id}.clips`));
    const nodeIds = new Set(scene.nodes.map((node) => node.id));
    if (scene.activeCameraId) {
      const camera = scene.nodes.find((node) => node.id === scene.activeCameraId);
      if (!camera) issues.push({ path: `scenes.${scene.id}.activeCameraId`, message: `Unknown camera: ${scene.activeCameraId}` });
      else if (camera.type !== "camera") issues.push({ path: `scenes.${scene.id}.activeCameraId`, message: `Node ${scene.activeCameraId} has type ${camera.type}, expected camera` });
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
        if (variable && capability && !motionVariableTypeMatchesValueKind(capability.valueKind, variable.type)) {
          issues.push({ path: propertyPath, message: `Expected ${capability.valueKind} binding for ${binding.target.property}, got variable type ${variable.type}` });
        }
      }
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

export class MotionV2ReferenceError extends Error {
  constructor(public readonly issues: ReferenceIssue[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
    this.name = "MotionV2ReferenceError";
  }
}
