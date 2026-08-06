import { z } from "zod";
import { MOTION_V2_LIMITS } from "../capabilities";
import { ProceduralDriverSchema } from "./animation/drivers";
import { ClipV2Schema } from "./animation/clips";
import { SceneMarkerSchema } from "./animation/tracks";
import { AssetV2Schema } from "./assets";
import {
  AspectRatioSchema,
  FiniteNumberSchema,
  IdSchema,
  MOTION_PROJECT_FORMAT_VERSION,
  SemanticSchema,
  SemverSchema,
} from "./common";
import { MotionBlurSettingsSchema, NodeV2Schema } from "./nodes";
import { JsonValueSchema } from "./values";
import { ProjectBindingSchema, VariableV2Schema } from "./variables";
import { CaptionTrackSchema } from "./captions";

export const DesignTokensSchema = z
  .object({
    colors: z.record(z.string().min(1).max(64)).optional(),
    fonts: z.record(z.string().min(1).max(128)).optional(),
    spacing: z.record(FiniteNumberSchema).optional(),
  })
  .strict();

export const PlatformSafeAreaSchema = z
  .object({
    platform: z.enum(["tiktok", "reels", "youtube", "generic"]),
    top: FiniteNumberSchema.nonnegative().max(1).optional(),
    right: FiniteNumberSchema.nonnegative().max(1).optional(),
    bottom: FiniteNumberSchema.nonnegative().max(1).optional(),
    left: FiniteNumberSchema.nonnegative().max(1).optional(),
  })
  .strict();

export const ComponentDependencySchema = z
  .object({
    componentId: IdSchema,
    version: SemverSchema,
    source: IdSchema,
    integrity: z.string().min(1),
  })
  .strict();

export const AudioTrackSchema = z
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
  z
    .object({
      type: z.literal("fade"),
      duration: FiniteNumberSchema.positive().max(MOTION_V2_LIMITS.mediaDurationSeconds),
      color: z.string().min(1).optional(),
      easing: z.enum(["linear", "step", "easeIn", "easeOut", "easeInOut", "spring"]).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("crossfade"),
      duration: FiniteNumberSchema.positive().max(MOTION_V2_LIMITS.mediaDurationSeconds),
      easing: z.enum(["linear", "step", "easeIn", "easeOut", "easeInOut", "spring"]).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("slide"),
      duration: FiniteNumberSchema.positive().max(MOTION_V2_LIMITS.mediaDurationSeconds),
      direction: z.enum(["left", "right", "up", "down"]),
      mode: z.enum(["push", "cover"]).default("push"),
      easing: z.enum(["linear", "step", "easeIn", "easeOut", "easeInOut", "spring"]).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("wipe"),
      duration: FiniteNumberSchema.positive().max(MOTION_V2_LIMITS.mediaDurationSeconds),
      direction: z.enum(["left", "right", "up", "down"]),
      softness: FiniteNumberSchema.min(0).max(1).optional(),
      easing: z.enum(["linear", "step", "easeIn", "easeOut", "easeInOut", "spring"]).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("zoom"),
      duration: FiniteNumberSchema.positive().max(MOTION_V2_LIMITS.mediaDurationSeconds),
      direction: z.enum(["in", "out"]),
      easing: z.enum(["linear", "step", "easeIn", "easeOut", "easeInOut", "spring"]).optional(),
    })
    .strict(),
]);

export const SceneV2Schema = z
  .object({
    id: IdSchema,
    name: z.string().min(1).optional(),
    duration: FiniteNumberSchema.positive().max(MOTION_V2_LIMITS.mediaDurationSeconds),
    semantic: SemanticSchema.optional(),
    space: z.enum(["flat-2d", "layered-2.5d"]).optional(),
    markers: z.array(SceneMarkerSchema).max(256).optional(),
    motionBlur: MotionBlurSettingsSchema.optional(),
    drivers: z.array(ProceduralDriverSchema).max(512).optional(),
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
    designTokens: DesignTokensSchema.optional(),
    safeArea: PlatformSafeAreaSchema.optional(),
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
        captionTracks: z
          .array(CaptionTrackSchema)
          .max(MOTION_V2_LIMITS.captionTracksPerProject)
          .default([]),
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

export type MotionProjectV2 = z.infer<typeof MotionProjectV2Schema>;
export type MotionScene = z.infer<typeof SceneV2Schema>;
