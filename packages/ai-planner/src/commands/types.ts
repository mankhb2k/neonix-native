import { z } from "zod";
import { MotionPatchSchema } from "@motionvideo/motion-schema";

const Id = z.string().min(1).max(128);
const Finite = z.number().finite();

export const TransformPatchSchema = z
  .object({
    x: Finite.optional(),
    y: Finite.optional(),
    width: Finite.nonnegative().optional(),
    height: Finite.nonnegative().optional(),
    rotation: Finite.optional(),
    scaleX: Finite.nonnegative().optional(),
    scaleY: Finite.nonnegative().optional(),
    anchorX: Finite.min(0).max(1).optional(),
    anchorY: Finite.min(0).max(1).optional(),
    opacity: Finite.min(0).max(1).optional(),
    visible: z.boolean().optional(),
    flipX: z.boolean().optional(),
    flipY: z.boolean().optional(),
  })
  .strict();

export const AuthoringKeyframeSchema = z
  .object({
    t: Finite.nonnegative(),
    v: z.union([z.string(), z.number(), z.boolean()]),
    easing: z.enum(["linear", "easeIn", "easeOut", "easeInOut", "spring", "step"]).optional(),
  })
  .strict();

export const AuthoringCommandSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("createProject"),
      projectId: Id,
      name: z.string().min(1).max(256),
      aspectRatio: z.enum(["9:16", "16:9", "1:1"]),
      fps: z.number().int().positive().max(240).optional(),
      locale: z.literal("vi-VN").optional(),
      brandName: z.string().min(1).max(128),
      primaryColor: z.string().min(1).max(64).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("setArtDirection"),
      brandName: z.string().min(1).max(128).optional(),
      primaryColor: z.string().min(1).max(64).optional(),
      secondaryColor: z.string().min(1).max(64).optional(),
      fontFamily: z.string().min(1).max(128).optional(),
      projectName: z.string().min(1).max(256).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("addScene"),
      sceneId: Id,
      duration: Finite.positive(),
      name: z.string().min(1).max(256).optional(),
      insertAt: z.number().int().nonnegative().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("setSceneTiming"),
      sceneId: Id,
      duration: Finite.positive(),
    })
    .strict(),
  z
    .object({
      type: z.literal("reorderScenes"),
      sceneOrder: z.array(Id).min(1).max(100),
    })
    .strict(),
  z
    .object({
      type: z.literal("addNode"),
      sceneId: Id,
      nodeId: Id,
      nodeType: z.enum(["group", "text", "shape"]),
      parentId: Id.nullable().optional(),
      transform: TransformPatchSchema.optional(),
      text: z.string().max(2_000).optional(),
      fontSize: Finite.positive().optional(),
      fill: z.string().min(1).max(64).optional(),
      semanticRole: z.string().min(1).max(64).optional(),
      semanticKey: z.string().min(1).max(128).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("removeNode"),
      sceneId: Id,
      nodeId: Id,
    })
    .strict(),
  z
    .object({
      type: z.literal("addTrack"),
      sceneId: Id,
      clipId: Id,
      targetId: Id,
      property: z.string().min(1).max(256),
      duration: Finite.positive(),
      at: Finite.nonnegative().optional(),
      keys: z.array(AuthoringKeyframeSchema).min(1).max(10_000),
    })
    .strict(),
  z.object({ type: z.literal("validateProject") }).strict(),
  z.object({ type: z.literal("compileProject") }).strict(),
  z
    .object({
      type: z.literal("applyRepairPatch"),
      patch: MotionPatchSchema,
    })
    .strict(),
  z.object({ type: z.literal("setLayoutConstraint") }).strict(),
  z.object({ type: z.literal("addComponentInstance") }).strict(),
  z.object({ type: z.literal("addDriver") }).strict(),
  z.object({ type: z.literal("addMask") }).strict(),
  z.object({ type: z.literal("addEffect") }).strict(),
  z.object({ type: z.literal("setCamera") }).strict(),
  z.object({ type: z.literal("addAudioCue") }).strict(),
  z.object({ type: z.literal("renderContactSheet") }).strict(),
  z.object({ type: z.literal("renderPreviewRange") }).strict(),
]);

export const CommandBatchSchema = z
  .object({
    format: z.literal("moticlip-command-batch"),
    formatVersion: z.literal(1),
    baseRevision: z.number().int().nonnegative(),
    commands: z.array(AuthoringCommandSchema).min(1).max(2_048),
  })
  .strict();

export type AuthoringCommand = z.infer<typeof AuthoringCommandSchema>;
export type CommandBatch = z.infer<typeof CommandBatchSchema>;
export type TransformPatch = z.infer<typeof TransformPatchSchema>;

export function parseCommandBatch(input: unknown): CommandBatch {
  return CommandBatchSchema.parse(input);
}
