import { z } from "zod";

/** Hard budgets for AI-facing artifacts (independent of protocol limits). */
export const AI_ARTIFACT_LIMITS = Object.freeze({
  objectiveLength: 2_000,
  scriptLength: 20_000,
  audienceLength: 500,
  languageLength: 32,
  brandNameLength: 128,
  toneTags: 16,
  toneTagLength: 64,
  conceptLength: 2_000,
  scenes: 24,
  sceneCopyItems: 16,
  copyItemLength: 500,
  visualConceptLength: 1_000,
  narrationLength: 2_000,
  motionIntentsPerScene: 32,
  assetRequestsPerScene: 16,
  semanticKeyLength: 128,
  designNodesPerScene: 64,
});

const NonEmptyString = (max: number) => z.string().min(1).max(max);
const FinitePositive = z.number().finite().positive();
const IntensitySchema = z.number().finite().min(0).max(1);

export const AspectRatioIntentSchema = z.enum(["9:16", "16:9", "1:1"]);
export const PlatformIntentSchema = z.enum([
  "tiktok",
  "reels",
  "youtube",
  "presentation",
  "custom",
]);
export const SceneRoleSchema = z.enum([
  "hook",
  "problem",
  "benefit",
  "demo",
  "proof",
  "offer",
  "cta",
  "logo",
]);

export const BrandInputSchema = z
  .object({
    name: NonEmptyString(AI_ARTIFACT_LIMITS.brandNameLength),
    primaryColor: z.string().min(1).max(64).optional(),
    secondaryColor: z.string().min(1).max(64).optional(),
    fontFamily: z.string().min(1).max(128).optional(),
  })
  .strict();

export const AssetReferenceSchema = z
  .object({
    id: NonEmptyString(AI_ARTIFACT_LIMITS.semanticKeyLength),
    uri: z.string().min(1).max(2_048).optional(),
    role: z
      .enum(["logo", "product", "background", "talent", "other"])
      .optional(),
  })
  .strict();

export const CreativeConstraintsSchema = z
  .object({
    maxScenes: z
      .number()
      .int()
      .positive()
      .max(AI_ARTIFACT_LIMITS.scenes)
      .optional(),
    mustIncludeCta: z.boolean().optional(),
    bannedWords: z.array(NonEmptyString(64)).max(64).optional(),
  })
  .strict();

export const CreativeBriefV1Schema = z
  .object({
    format: z
      .literal("moticlip-creative-brief")
      .default("moticlip-creative-brief"),
    formatVersion: z.literal(1).default(1),
    objective: NonEmptyString(AI_ARTIFACT_LIMITS.objectiveLength),
    audience: NonEmptyString(AI_ARTIFACT_LIMITS.audienceLength).optional(),
    platform: PlatformIntentSchema.optional(),
    durationSeconds: FinitePositive.max(600),
    aspectRatio: AspectRatioIntentSchema,
    script: NonEmptyString(AI_ARTIFACT_LIMITS.scriptLength),
    language: NonEmptyString(AI_ARTIFACT_LIMITS.languageLength),
    brand: BrandInputSchema.optional(),
    suppliedAssets: z.array(AssetReferenceSchema).max(64).optional(),
    constraints: CreativeConstraintsSchema.optional(),
  })
  .strict();

export const SemanticTargetSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("semantic"),
      key: NonEmptyString(AI_ARTIFACT_LIMITS.semanticKeyLength),
    })
    .strict(),
  z.object({ kind: z.literal("role"), role: NonEmptyString(64) }).strict(),
]);

export const EntranceStyleSchema = z.enum([
  "fade",
  "fade-up",
  "scale",
  "slide",
  "pop",
]);
export const ExitStyleSchema = z.enum(["fade", "scale", "slide"]);
export const EmphasisStyleSchema = z.enum(["pulse", "shake", "flash"]);
export const CameraStyleSchema = z.enum([
  "zoom-in",
  "zoom-out",
  "pan",
  "static",
]);
export const TransitionStyleSchema = z.enum(["cut", "fade", "crossfade"]);

export const ParallaxLayerIntentSchema = z
  .object({
    target: SemanticTargetSchema,
    factor: z.number().finite().min(-8).max(8),
  })
  .strict();

export const MotionIntentSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("entrance"),
      target: SemanticTargetSchema,
      style: EntranceStyleSchema,
      intensity: IntensitySchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("exit"),
      target: SemanticTargetSchema,
      style: ExitStyleSchema,
      intensity: IntensitySchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("emphasis"),
      target: SemanticTargetSchema,
      style: EmphasisStyleSchema,
      beats: z.array(z.number().finite().nonnegative()).max(32).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("camera"),
      style: CameraStyleSchema,
      focus: SemanticTargetSchema.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("parallax"),
      layers: z.array(ParallaxLayerIntentSchema).min(1).max(16),
    })
    .strict(),
  z
    .object({
      type: z.literal("reveal"),
      target: SemanticTargetSchema,
      style: z.enum(["mask", "trim-path", "scale"]),
    })
    .strict(),
  z
    .object({
      type: z.literal("follow"),
      source: SemanticTargetSchema,
      target: SemanticTargetSchema,
      lag: z.number().finite().min(0).max(2),
    })
    .strict(),
  z
    .object({
      type: z.literal("transition"),
      style: TransitionStyleSchema,
    })
    .strict(),
]);

export const LayoutIntentSchema = z
  .object({
    kind: z.enum([
      "hero",
      "split",
      "stack",
      "compare",
      "steps",
      "quote",
      "cta",
      "collage",
      "centered",
    ]),
    safeArea: z.enum(["tiktok", "reels", "youtube", "generic"]).optional(),
  })
  .strict();

export const AssetRequestSchema = z
  .object({
    id: NonEmptyString(AI_ARTIFACT_LIMITS.semanticKeyLength),
    kind: z.enum(["image", "svg", "video", "audio", "font", "generated"]),
    purpose: NonEmptyString(256),
    optional: z.boolean().optional(),
  })
  .strict();

export const SceneBriefSchema = z
  .object({
    id: NonEmptyString(AI_ARTIFACT_LIMITS.semanticKeyLength),
    role: SceneRoleSchema,
    duration: FinitePositive.max(120),
    narration: NonEmptyString(AI_ARTIFACT_LIMITS.narrationLength).optional(),
    onScreenCopy: z
      .array(NonEmptyString(AI_ARTIFACT_LIMITS.copyItemLength))
      .max(AI_ARTIFACT_LIMITS.sceneCopyItems),
    visualConcept: NonEmptyString(AI_ARTIFACT_LIMITS.visualConceptLength),
    layoutIntent: LayoutIntentSchema,
    motionIntents: z
      .array(MotionIntentSchema)
      .max(AI_ARTIFACT_LIMITS.motionIntentsPerScene),
    assetRequests: z
      .array(AssetRequestSchema)
      .max(AI_ARTIFACT_LIMITS.assetRequestsPerScene),
  })
  .strict();

export const ArtDirectionSchema = z
  .object({
    palette: z.array(z.string().min(1).max(64)).max(12).optional(),
    typographyMood: NonEmptyString(128).optional(),
    visualStyle: NonEmptyString(256).optional(),
  })
  .strict();

export const PacingPlanSchema = z
  .object({
    beatsPerMinute: z.number().finite().positive().max(240).optional(),
    energy: z.enum(["low", "medium", "high"]).optional(),
  })
  .strict();

export const AudioDirectionSchema = z
  .object({
    mood: NonEmptyString(128).optional(),
    voiceover: z.boolean().optional(),
  })
  .strict();

export const CreativePlanV1Schema = z
  .object({
    format: z.literal("moticlip-creative-plan"),
    formatVersion: z.literal(1),
    concept: NonEmptyString(AI_ARTIFACT_LIMITS.conceptLength),
    tone: z
      .array(NonEmptyString(AI_ARTIFACT_LIMITS.toneTagLength))
      .max(AI_ARTIFACT_LIMITS.toneTags),
    artDirection: ArtDirectionSchema,
    pacing: PacingPlanSchema,
    scenes: z.array(SceneBriefSchema).min(1).max(AI_ARTIFACT_LIMITS.scenes),
    audioDirection: AudioDirectionSchema.optional(),
  })
  .strict();

export const DesignNodeHintSchema = z.enum([
  "text",
  "shape",
  "group",
  "image",
  "camera",
]);

export const SceneDesignLayerSchema = z
  .object({
    id: NonEmptyString(AI_ARTIFACT_LIMITS.semanticKeyLength),
    semanticKey: NonEmptyString(AI_ARTIFACT_LIMITS.semanticKeyLength),
    nodeHint: DesignNodeHintSchema,
    copyIndex: z.number().int().nonnegative().optional(),
  })
  .strict();

export const SceneDesignEntrySchema = z
  .object({
    sceneBriefId: NonEmptyString(AI_ARTIFACT_LIMITS.semanticKeyLength),
    layout: LayoutIntentSchema,
    layers: z
      .array(SceneDesignLayerSchema)
      .max(AI_ARTIFACT_LIMITS.designNodesPerScene),
  })
  .strict();

export const SceneDesignPlanV1Schema = z
  .object({
    format: z.literal("moticlip-scene-design-plan"),
    formatVersion: z.literal(1),
    planId: NonEmptyString(AI_ARTIFACT_LIMITS.semanticKeyLength),
    scenes: z
      .array(SceneDesignEntrySchema)
      .min(1)
      .max(AI_ARTIFACT_LIMITS.scenes),
  })
  .strict();

export type CreativeBriefV1 = z.infer<typeof CreativeBriefV1Schema>;
export type CreativePlanV1 = z.infer<typeof CreativePlanV1Schema>;
export type SceneDesignPlanV1 = z.infer<typeof SceneDesignPlanV1Schema>;
export type MotionIntent = z.infer<typeof MotionIntentSchema>;
export type LayoutIntent = z.infer<typeof LayoutIntentSchema>;
export type AssetRequest = z.infer<typeof AssetRequestSchema>;
export type SceneBrief = z.infer<typeof SceneBriefSchema>;
export type BrandInput = z.infer<typeof BrandInputSchema>;

export class AiArtifactParseError extends Error {
  constructor(
    public readonly artifact: string,
    public readonly issues: Array<{ path: string; message: string }>,
  ) {
    super(
      `${artifact}: ${issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`,
    );
    this.name = "AiArtifactParseError";
  }
}

function zodIssues(
  error: z.ZodError,
): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "(root)",
    message: issue.message,
  }));
}

export function parseCreativeBriefV1(input: unknown): CreativeBriefV1 {
  const result = CreativeBriefV1Schema.safeParse(input);
  if (!result.success)
    throw new AiArtifactParseError("CreativeBriefV1", zodIssues(result.error));
  return result.data;
}

export function parseCreativePlanV1(input: unknown): CreativePlanV1 {
  const result = CreativePlanV1Schema.safeParse(input);
  if (!result.success)
    throw new AiArtifactParseError("CreativePlanV1", zodIssues(result.error));
  return result.data;
}

export function parseSceneDesignPlanV1(input: unknown): SceneDesignPlanV1 {
  const result = SceneDesignPlanV1Schema.safeParse(input);
  if (!result.success)
    throw new AiArtifactParseError(
      "SceneDesignPlanV1",
      zodIssues(result.error),
    );
  return result.data;
}

export function serializeCreativeBriefV1(brief: CreativeBriefV1): string {
  return `${JSON.stringify(CreativeBriefV1Schema.parse(brief), null, 2)}\n`;
}

export function serializeCreativePlanV1(plan: CreativePlanV1): string {
  return `${JSON.stringify(CreativePlanV1Schema.parse(plan), null, 2)}\n`;
}

export function serializeSceneDesignPlanV1(plan: SceneDesignPlanV1): string {
  return `${JSON.stringify(SceneDesignPlanV1Schema.parse(plan), null, 2)}\n`;
}
