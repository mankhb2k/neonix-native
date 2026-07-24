import { z } from "zod";

export const MOTION_PROJECT_FORMAT_VERSION = 2 as const;
export const MOTION_COMPONENT_FORMAT_VERSION = 2 as const;
export const MOTION_PATCH_FORMAT_VERSION = 1 as const;

export const AspectRatioSchema = z.enum(["9:16", "16:9", "1:1"]);

const IdSchema = z.string().min(1);
const PropertyPathSchema = z.string().min(1);
const SemverSchema = z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, "Expected semantic version");

export const JsonValueSchema: z.ZodType<
  string | number | boolean | null | Array<unknown> | Record<string, unknown>
> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(JsonValueSchema),
  ]),
);

export const VariableReferenceSchema = z.object({
  ref: z.object({ kind: z.literal("variable"), id: IdSchema }),
  map: z
    .object({ scale: z.number().optional(), offset: z.number().optional() })
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
    tags: z.array(IdSchema).default([]),
  })
  .strict();

export const TransformV2Schema = z
  .object({
    x: z.number(),
    y: z.number(),
    width: z.number().nonnegative(),
    height: z.number().nonnegative(),
    rotation: z.number(),
    scaleX: z.number().nonnegative(),
    scaleY: z.number().nonnegative(),
    anchorX: z.number().min(0).max(1),
    anchorY: z.number().min(0).max(1),
    opacity: z.number().min(0).max(1),
    visible: z.boolean(),
    flipX: z.boolean(),
    flipY: z.boolean(),
  })
  .strict();

export const AssetV2Schema = z
  .object({
    id: IdSchema,
    assetType: IdSchema,
    uri: z.string().min(1),
    integrity: z.string().min(1).optional(),
  })
  .strict();

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
    value: z.number(),
    min: z.number().optional(),
    max: z.number().optional(),
  }).strict(),
  ScalarVariableSchema.extend({ type: z.literal("boolean"), value: z.boolean() }).strict(),
  ScalarVariableSchema.extend({ type: z.literal("image"), value: IdSchema }).strict(),
  ScalarVariableSchema.extend({
    type: z.literal("enum"),
    value: z.string(),
    options: z.array(z.string()).min(1),
  }).strict(),
  ScalarVariableSchema.extend({
    type: z.literal("list"),
    itemSchema: z
      .object({ type: z.literal("object"), fields: z.record(ObjectFieldSchema) })
      .strict(),
    value: z.array(z.record(JsonValueSchema)),
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
        gap: z.number().nonnegative(),
      })
      .strict(),
  })
  .strict();

const NodeBaseSchema = z.object({
  id: IdSchema,
  type: IdSchema,
  name: z.string().min(1).optional(),
  parentId: IdSchema.nullable(),
  zIndex: z.number().int().optional(),
  transform: TransformV2Schema,
  style: z.record(JsonValueSchema).optional(),
  payload: z.record(JsonValueSchema).optional(),
  semantic: SemanticSchema.optional(),
  repeat: RepeaterSchema.optional(),
  inheritPosition: z.boolean().optional(),
  inheritRotation: z.boolean().optional(),
  inheritScale: z.boolean().optional(),
  inheritOpacity: z.boolean().optional(),
  maskId: IdSchema.optional(),
});

const ComponentNodeSchema = NodeBaseSchema.extend({
  type: z.literal("component"),
  payload: z
    .object({
      componentId: IdSchema,
      componentVersion: SemverSchema,
      props: z.record(JsonValueSchema),
    })
    .strict(),
}).strict();

const RegularNodeSchema = NodeBaseSchema.extend({
  type: z.enum(["text", "shape", "image", "svg", "path", "group", "bone", "camera", "logo", "icon", "character", "video"]),
}).strict();

export const NodeV2Schema = z.union([ComponentNodeSchema, RegularNodeSchema]);

export const ClipScheduleSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("absolute"), at: z.number().nonnegative() }).strict(),
  z.object({ kind: z.literal("after"), clipId: IdSchema, offset: z.number().optional() }).strict(),
  z.object({ kind: z.literal("with"), clipId: IdSchema, offset: z.number().optional() }).strict(),
]);

export const PlaybackSchema = z
  .object({
    iterations: z.union([z.number().int().positive(), z.literal("infinite")]).default(1),
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
            t: z.number().nonnegative(),
            v: ResolvableValueSchema,
            easing: z.enum(["linear", "easeIn", "easeOut", "easeInOut", "spring", "step"]).optional(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

const ClipSourceSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("preset"), presetId: IdSchema, params: z.record(ResolvableValueSchema).optional() })
    .strict(),
  z.object({ kind: z.literal("tracks"), tracks: z.array(PropertyTrackSchema).min(1) }).strict(),
]);

export const ClipV2Schema = z
  .object({
    id: IdSchema,
    targetId: IdSchema.optional(),
    schedule: ClipScheduleSchema,
    duration: z.number().positive(),
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
    min: z.number().optional(),
    max: z.number().optional(),
    options: z.array(z.string()).min(1).optional(),
  })
  .strict();

export const MotionComponentV2Schema = z
  .object({
    format: z.literal("motion-component"),
    formatVersion: z.literal(MOTION_COMPONENT_FORMAT_VERSION),
    componentId: IdSchema,
    componentVersion: SemverSchema,
    metadata: z.record(JsonValueSchema),
    assets: z.array(AssetV2Schema).default([]),
    variables: z.array(VariableV2Schema),
    publicAPI: z.array(PublicParamSchema),
    nodes: z.array(NodeV2Schema).min(1),
    bindings: z.array(ComponentBindingSchema).default([]),
    clips: z.array(ClipV2Schema).default([]),
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
    start: z.number().nonnegative(),
    trimStart: z.number().nonnegative().default(0),
    volume: z.number().min(0).max(1).default(1),
    loop: z.boolean().default(false),
    fadeIn: z.number().nonnegative().default(0),
    fadeOut: z.number().nonnegative().default(0),
  })
  .strict();

const SceneV2Schema = z
  .object({
    id: IdSchema,
    name: z.string().min(1).optional(),
    duration: z.number().positive(),
    semantic: SemanticSchema.optional(),
    nodes: z.array(NodeV2Schema),
    clips: z.array(ClipV2Schema),
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
    fps: z.number().int().positive(),
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
    dependencies: z.object({ components: z.array(ComponentDependencySchema) }).strict(),
    assets: z.array(AssetV2Schema),
    variables: z.array(VariableV2Schema),
    timeline: z
      .object({ sceneOrder: z.array(IdSchema).min(1), audioTracks: z.array(AudioTrackSchema).default([]) })
      .strict(),
    scenes: z.array(SceneV2Schema).min(1),
    bindings: z.array(ProjectBindingSchema).default([]),
    extensions: z
      .object({ constraints: z.array(JsonValueSchema).default([]), events: z.array(JsonValueSchema).default([]) })
      .strict()
      .default({}),
  })
  .strict();

const PatchTargetSchema = z.union([
  z.object({ variableId: IdSchema }).strict(),
  z.object({ sceneId: IdSchema, nodeId: IdSchema, property: PropertyPathSchema }).strict(),
]);

export const MotionPatchV1Schema = z
  .object({
    format: z.literal("motion-patch"),
    formatVersion: z.literal(MOTION_PATCH_FORMAT_VERSION),
    baseRevision: z.number().int().nonnegative(),
    operations: z.array(z.object({ op: z.literal("set"), target: PatchTargetSchema, value: JsonValueSchema }).strict()),
  })
  .strict();

const RuntimeNodeSchema = RegularNodeSchema.omit({ repeat: true }).extend({
  style: z.record(LiteralValueSchema).optional(),
  payload: z.record(LiteralValueSchema).optional(),
}).strict();

const RuntimeTrackSchema = z
  .object({
    targetId: IdSchema,
    property: PropertyPathSchema,
    keys: z.array(z.object({ t: z.number().nonnegative(), v: LiteralValueSchema, easing: z.string().optional() }).strict()).min(1),
  })
  .strict();

export const NormalizedMotionProjectV2Schema = z
  .object({
    format: z.literal("motion-runtime"),
    formatVersion: z.literal(MOTION_PROJECT_FORMAT_VERSION),
    metadata: ProjectMetadataV2Schema,
    assets: z.array(AssetV2Schema),
    timeline: z.object({ sceneOrder: z.array(IdSchema), audioTracks: z.array(AudioTrackSchema) }).strict(),
    scenes: z.array(
      z.object({ id: IdSchema, duration: z.number().positive(), nodes: z.array(RuntimeNodeSchema), tracks: z.array(RuntimeTrackSchema) }).strict(),
    ),
  })
  .strict();

export type MotionComponentV2 = z.infer<typeof MotionComponentV2Schema>;
export type MotionProjectV2 = z.infer<typeof MotionProjectV2Schema>;
export type MotionNode = z.infer<typeof NodeV2Schema>;
export type MotionScene = z.infer<typeof SceneV2Schema>;
export type MotionClip = z.infer<typeof ClipV2Schema>;
export type AspectRatio = z.infer<typeof AspectRatioSchema>;
export type MotionPatchV1 = z.infer<typeof MotionPatchV1Schema>;
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
    while (parent !== null && idSet.has(parent)) {
      if (seen.has(parent)) {
        issues.push({ path: `${prefix}.${node.id}.parentId`, message: "Parent cycle detected" });
        break;
      }
      seen.add(parent);
      parent = parentById.get(parent) ?? null;
    }
  }
  return issues;
}

export function validateMotionComponentV2References(component: MotionComponentV2): ReferenceIssue[] {
  const issues = validateNodeGraph(component.nodes, "nodes");
  const variableIds = new Set(component.variables.map((variable) => variable.id));
  const nodeIds = new Set(component.nodes.map((node) => node.id));
  const assetIds = new Set(component.assets.map((asset) => asset.id));
  for (const id of new Set(duplicates(component.variables.map((variable) => variable.id)))) issues.push({ path: "variables", message: `Duplicate variable id: ${id}` });
  for (const id of new Set(duplicates(component.assets.map((asset) => asset.id)))) issues.push({ path: "assets", message: `Duplicate asset id: ${id}` });
  for (const id of new Set(duplicates(component.publicAPI.map((api) => api.id)))) issues.push({ path: "publicAPI", message: `Duplicate public API id: ${id}` });
  for (const id of new Set(duplicates(component.clips.map((clip) => clip.id)))) issues.push({ path: "clips", message: `Duplicate clip id: ${id}` });
  for (const api of component.publicAPI) {
    if (!variableIds.has(api.variableId)) issues.push({ path: `publicAPI.${api.id}.variableId`, message: `Unknown variable: ${api.variableId}` });
    const variable = component.variables.find((candidate) => candidate.id === api.variableId);
    if (variable && variable.type !== api.type) issues.push({ path: `publicAPI.${api.id}.type`, message: `Expected variable type ${variable.type}, got ${api.type}` });
  }
  for (const binding of component.bindings) {
    if (binding.source.kind === "variable" && !variableIds.has(binding.source.variableId)) {
      issues.push({ path: `bindings.${binding.id}.source`, message: `Unknown variable: ${binding.source.variableId}` });
    }
    if (!nodeIds.has(binding.target.nodeId)) issues.push({ path: `bindings.${binding.id}.target`, message: `Unknown node: ${binding.target.nodeId}` });
  }
  for (const clip of component.clips) {
    if (clip.targetId && !nodeIds.has(clip.targetId)) issues.push({ path: `clips.${clip.id}.targetId`, message: `Unknown node: ${clip.targetId}` });
    if (clip.source.kind === "tracks") {
      for (const track of clip.source.tracks) {
        if (!nodeIds.has(track.targetId)) issues.push({ path: `clips.${clip.id}.source.tracks`, message: `Unknown node: ${track.targetId}` });
        for (const key of track.keys) if (key.t > clip.duration) issues.push({ path: `clips.${clip.id}.source.tracks.${track.property}`, message: `Key time ${key.t} exceeds clip duration ${clip.duration}` });
      }
    }
    if (clip.schedule.kind !== "absolute") {
      const scheduleClipId = clip.schedule.clipId;
      if (!component.clips.some((candidate) => candidate.id === scheduleClipId)) issues.push({ path: `clips.${clip.id}.schedule`, message: `Unknown schedule clip: ${scheduleClipId}` });
    }
  }
  for (const node of component.nodes) {
    const assetId = node.payload && "assetId" in node.payload ? node.payload.assetId : undefined;
    if (typeof assetId === "string" && !assetIds.has(assetId)) issues.push({ path: `nodes.${node.id}.payload.assetId`, message: `Unknown component asset: ${assetId}` });
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
  const assetIds = new Set(project.assets.map((asset) => asset.id));
  const dependencies = new Set(project.dependencies.components.map((dependency) => `${dependency.componentId}@${dependency.version}`));
  for (const id of new Set(duplicates(project.scenes.map((scene) => scene.id)))) issues.push({ path: "scenes", message: `Duplicate scene id: ${id}` });
  for (const id of new Set(duplicates(project.variables.map((variable) => variable.id)))) issues.push({ path: "variables", message: `Duplicate variable id: ${id}` });
  for (const id of new Set(duplicates(project.assets.map((asset) => asset.id)))) issues.push({ path: "assets", message: `Duplicate asset id: ${id}` });
  for (const id of new Set(duplicates(project.bindings.map((binding) => binding.id)))) issues.push({ path: "bindings", message: `Duplicate binding id: ${id}` });
  for (const sceneId of project.timeline.sceneOrder) if (!sceneById.has(sceneId)) issues.push({ path: "timeline.sceneOrder", message: `Unknown scene: ${sceneId}` });
  if (new Set(project.timeline.sceneOrder).size !== project.timeline.sceneOrder.length) issues.push({ path: "timeline.sceneOrder", message: "Scene order contains duplicates" });
  for (const sceneId of sceneById.keys()) if (!project.timeline.sceneOrder.includes(sceneId)) issues.push({ path: "timeline.sceneOrder", message: `Scene is not scheduled: ${sceneId}` });
  for (const audio of project.timeline.audioTracks) if (!assetIds.has(audio.assetId)) issues.push({ path: `timeline.audioTracks.${audio.id}.assetId`, message: `Unknown asset: ${audio.assetId}` });
  for (const scene of project.scenes) {
    issues.push(...validateNodeGraph(scene.nodes, `scenes.${scene.id}.nodes`));
    const nodeIds = new Set(scene.nodes.map((node) => node.id));
    if (scene.activeCameraId && !nodeIds.has(scene.activeCameraId)) issues.push({ path: `scenes.${scene.id}.activeCameraId`, message: `Unknown camera: ${scene.activeCameraId}` });
    for (const node of scene.nodes) {
      if (node.type === "component") {
        const dependency = `${node.payload.componentId}@${node.payload.componentVersion}`;
        if (!dependencies.has(dependency)) issues.push({ path: `scenes.${scene.id}.nodes.${node.id}.payload`, message: `Unpinned component dependency: ${dependency}` });
      }
    }
    for (const clip of scene.clips) if (clip.targetId && !nodeIds.has(clip.targetId)) issues.push({ path: `scenes.${scene.id}.clips.${clip.id}.targetId`, message: `Unknown node: ${clip.targetId}` });
  }
  for (const binding of project.bindings) {
    if (!variableIds.has(binding.source.variableId)) issues.push({ path: `bindings.${binding.id}.source`, message: `Unknown variable: ${binding.source.variableId}` });
    const scene = sceneById.get(binding.target.sceneId);
    if (!scene) issues.push({ path: `bindings.${binding.id}.target.sceneId`, message: `Unknown scene: ${binding.target.sceneId}` });
    else if (!scene.nodes.some((node) => node.id === binding.target.nodeId)) issues.push({ path: `bindings.${binding.id}.target.nodeId`, message: `Unknown node: ${binding.target.nodeId}` });
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
