import { z } from "zod";
import { MotionProjectV1PatchSchema } from "@motionvideo/motion-mcp";

const Id = z.string().min(1).max(128);
const Finite = z.number().finite();

export const TransformPatchSchema = z
  .object({
    x: Finite.optional(),
    y: Finite.optional(),
    depth: Finite.optional(),
    width: Finite.nonnegative().optional(),
    height: Finite.nonnegative().optional(),
    rotation: Finite.optional(),
    scaleX: Finite.optional(),
    scaleY: Finite.optional(),
    anchorX: Finite.min(0).max(1).optional(),
    anchorY: Finite.min(0).max(1).optional(),
    opacity: Finite.int().min(0).max(100).optional(),
    visible: z.boolean().optional(),
  })
  .strict();

export const AuthoringEasingSchema = z.union([
  z.enum(["linear", "easeIn", "easeOut", "easeInOut", "spring", "step"]),
  z
    .object({
      type: z.literal("cubic-bezier"),
      x1: Finite.min(0).max(1),
      y1: Finite,
      x2: Finite.min(0).max(1),
      y2: Finite,
    })
    .strict(),
  z
    .object({
      type: z.literal("spring"),
      stiffness: Finite.positive().max(10_000),
      damping: Finite.nonnegative().max(1_000),
      mass: Finite.positive().max(100).optional(),
    })
    .strict(),
]);

export const AuthoringKeyframeSchema = z
  .object({
    t: Finite.nonnegative(),
    v: z.union([z.string(), z.number(), z.boolean()]),
    easing: AuthoringEasingSchema.optional(),
  })
  .strict();

export const LayoutConstraintCommandSchema = z.discriminatedUnion("mode", [
  z
    .object({
      mode: z.literal("row"),
      gap: Finite.nonnegative().optional(),
      padding: z
        .union([
          Finite.nonnegative(),
          z
            .object({
              top: Finite.nonnegative(),
              right: Finite.nonnegative(),
              bottom: Finite.nonnegative(),
              left: Finite.nonnegative(),
            })
            .strict(),
        ])
        .optional(),
      align: z.enum(["start", "center", "end", "stretch"]).optional(),
      justify: z.enum(["start", "center", "end", "space-between"]).optional(),
    })
    .strict(),
  z
    .object({
      mode: z.literal("column"),
      gap: Finite.nonnegative().optional(),
      padding: z
        .union([
          Finite.nonnegative(),
          z
            .object({
              top: Finite.nonnegative(),
              right: Finite.nonnegative(),
              bottom: Finite.nonnegative(),
              left: Finite.nonnegative(),
            })
            .strict(),
        ])
        .optional(),
      align: z.enum(["start", "center", "end", "stretch"]).optional(),
      justify: z.enum(["start", "center", "end", "space-between"]).optional(),
    })
    .strict(),
  z
    .object({
      mode: z.literal("grid"),
      columns: z.number().int().positive().max(32),
      gap: Finite.nonnegative().optional(),
      padding: z
        .union([
          Finite.nonnegative(),
          z
            .object({
              top: Finite.nonnegative(),
              right: Finite.nonnegative(),
              bottom: Finite.nonnegative(),
              left: Finite.nonnegative(),
            })
            .strict(),
        ])
        .optional(),
      align: z.enum(["start", "center", "end", "stretch"]).optional(),
      justify: z.enum(["start", "center", "end", "space-between"]).optional(),
    })
    .strict(),
]);

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
      sceneIds: z.array(Id).min(1).max(100),
    })
    .strict(),
  z
    .object({
      type: z.literal("addNode"),
      sceneId: Id,
      layerId: Id,
      nodeType: z.enum(["group", "text", "shape"]),
      parentLayerId: Id.nullable().optional(),
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
      layerId: Id,
    })
    .strict(),
  z
    .object({
      type: z.literal("addTrack"),
      sceneId: Id,
      clipId: Id,
      layerId: Id,
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
      patch: MotionProjectV1PatchSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("setLayoutConstraint"),
      sceneId: Id,
      layerId: Id,
      constraint: LayoutConstraintCommandSchema,
    })
    .strict(),
  z.object({ type: z.literal("addComponentInstance") }).strict(),
  z
    .object({
      type: z.literal("addDriver"),
      sceneId: Id,
      driver: z.record(z.unknown()),
    })
    .strict(),
  z
    .object({
      type: z.literal("applyRecipe"),
      sceneId: Id,
      recipeId: z.enum([
        "wiggle",
        "float",
        "pulse",
        "breathing",
        "drift",
        "shimmer",
        "follow",
        "counter",
        "stagger",
        "camera-shake",
      ]),
      targetLayerId: Id,
      duration: Finite.positive(),
      seed: Finite.optional(),
      intensity: Finite.optional(),
      sourceLayerId: Id.optional(),
      staggerLayerIds: z.array(Id).max(64).optional(),
      clipId: Id.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("addMask"),
      sceneId: Id,
      layerId: Id,
      sourceLayerId: Id,
      mode: z.enum(["clip", "alpha", "inverse-alpha", "luma", "inverse-luma"]),
      sourceVisibility: z.enum(["mask-only", "content-and-mask"]).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("addEffect"),
      sceneId: Id,
      layerId: Id,
      effectId: Id,
      effect: z.discriminatedUnion("type", [
        z
          .object({ type: z.literal("blur"), radius: Finite.nonnegative() })
          .strict(),
        z
          .object({
            type: z.literal("shadow"),
            offsetX: Finite,
            offsetY: Finite,
            blur: Finite.nonnegative(),
            color: z.string().min(1),
            opacity: Finite.min(0).max(100).optional(),
          })
          .strict(),
        z
          .object({
            type: z.literal("inner-glow"),
            radius: Finite.nonnegative(),
            color: z.string().min(1),
            opacity: Finite.min(0).max(100).optional(),
          })
          .strict(),
        z
          .object({
            type: z.literal("noise"),
            amount: Finite.min(0).max(100).optional(),
            scale: Finite.min(0.25).max(8).optional(),
            opacity: Finite.min(0).max(100).optional(),
            animated: z.boolean().optional(),
          })
          .strict(),
        z
          .object({
            type: z.literal("glow"),
            radius: Finite.nonnegative(),
            color: z.string().min(1),
            opacity: Finite.min(0).max(100).optional(),
          })
          .strict(),
        z
          .object({
            type: z.literal("color-adjust"),
            brightness: Finite.min(0).max(200).optional(),
            contrast: Finite.min(0).max(200).optional(),
            saturation: Finite.min(0).max(200).optional(),
            "hue-rotate": Finite.min(-180).max(180).optional(),
          })
          .strict(),
      ]),
    })
    .strict(),
  z
    .object({
      type: z.literal("setCamera"),
      sceneId: Id,
      cameraId: Id,
      zoom: Finite.positive().optional(),
      parallaxStrength: Finite.min(0).max(8).optional(),
      transform: TransformPatchSchema.optional(),
      makeActive: z.boolean().optional(),
    })
    .strict(),
  z.object({ type: z.literal("addAudioCue") }).strict(),
  z
    .object({
      type: z.literal("renderContactSheet"),
      sceneId: Id.optional(),
      times: z.array(Finite.nonnegative()).min(1).max(24).optional(),
      width: z.number().int().positive().max(512).optional(),
      height: z.number().int().positive().max(512).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("renderPreviewRange"),
      sceneId: Id,
      start: Finite.nonnegative(),
      end: Finite.positive(),
      fps: z.number().int().positive().max(60).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("registerAsset"),
      asset: z.discriminatedUnion("assetType", [
        z
          .object({
            id: Id,
            assetType: z.literal("image"),
            uri: z.string().min(1).max(2_048),
            mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
            width: z.number().int().positive().max(16_384),
            height: z.number().int().positive().max(16_384),
            pixelFormat: z.string().min(1).max(32),
            hasAlpha: z.boolean(),
            integrity: z.string().min(1).max(128).optional(),
          })
          .strict(),
        z
          .object({
            id: Id,
            assetType: z.literal("svg"),
            uri: z.string().min(1).max(2_048),
            mimeType: z.literal("image/svg+xml"),
            width: z.number().int().positive().max(16_384),
            height: z.number().int().positive().max(16_384),
            viewBox: z.string().min(1).max(128),
            sanitized: z.literal(true),
            integrity: z.string().min(1).max(128).optional(),
          })
          .strict(),
      ]),
    })
    .strict(),
  z
    .object({
      type: z.literal("addImageNode"),
      sceneId: Id,
      layerId: Id,
      assetId: Id,
      parentLayerId: Id.nullable().optional(),
      transform: TransformPatchSchema.optional(),
      fit: z.enum(["contain", "cover", "fill", "none"]).optional(),
      crop: z
        .object({
          x: Finite.min(0).max(1),
          y: Finite.min(0).max(1),
          width: Finite.positive().max(1),
          height: Finite.positive().max(1),
        })
        .strict()
        .optional(),
      semanticRole: z.string().min(1).max(64).optional(),
      semanticKey: z.string().min(1).max(128).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("addSvgNode"),
      sceneId: Id,
      layerId: Id,
      assetId: Id,
      parentLayerId: Id.nullable().optional(),
      transform: TransformPatchSchema.optional(),
      fit: z.enum(["contain", "cover", "fill", "none"]).optional(),
      crop: z
        .object({
          x: Finite.min(0).max(1),
          y: Finite.min(0).max(1),
          width: Finite.positive().max(1),
          height: Finite.positive().max(1),
        })
        .strict()
        .optional(),
      semanticRole: z.string().min(1).max(64).optional(),
      semanticKey: z.string().min(1).max(128).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("addPathNode"),
      sceneId: Id,
      layerId: Id,
      parentLayerId: Id.nullable().optional(),
      transform: TransformPatchSchema.optional(),
      fillRule: z.enum(["nonzero", "evenodd"]).optional(),
      fill: z.string().min(1).optional(),
      stroke: z.string().min(1).optional(),
      strokeWidth: Finite.nonnegative().optional(),
      contours: z
        .array(
          z
            .object({
              id: Id,
              start: z.object({ x: Finite, y: Finite }).strict(),
              closed: z.boolean(),
              segments: z
                .array(
                  z.discriminatedUnion("kind", [
                    z
                      .object({
                        kind: z.literal("line"),
                        to: z.object({ x: Finite, y: Finite }).strict(),
                      })
                      .strict(),
                    z
                      .object({
                        kind: z.literal("cubic"),
                        control1: z.object({ x: Finite, y: Finite }).strict(),
                        control2: z.object({ x: Finite, y: Finite }).strict(),
                        to: z.object({ x: Finite, y: Finite }).strict(),
                      })
                      .strict(),
                  ]),
                )
                .min(1),
            })
            .strict(),
        )
        .min(1),
      semanticRole: z.string().min(1).max(64).optional(),
      semanticKey: z.string().min(1).max(128).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("setNodePayload"),
      sceneId: Id,
      layerId: Id,
      payload: z.record(z.unknown()),
    })
    .strict(),
  z
    .object({
      type: z.literal("setSceneTransition"),
      sceneId: Id,
      transition: z.discriminatedUnion("type", [
        z
          .object({ type: z.literal("cut"), duration: z.literal(0).optional() })
          .strict(),
        z
          .object({
            type: z.literal("fade"),
            duration: Finite.positive().max(30),
            color: z.string().min(1).optional(),
          })
          .strict(),
        z
          .object({
            type: z.literal("crossfade"),
            duration: Finite.positive().max(30),
          })
          .strict(),
        z
          .object({
            type: z.literal("slide"),
            duration: Finite.positive().max(30),
            direction: z.enum(["left", "right", "up", "down"]),
            mode: z.enum(["push", "cover"]).optional(),
          })
          .strict(),
        z
          .object({
            type: z.literal("wipe"),
            duration: Finite.positive().max(30),
            direction: z.enum(["left", "right", "up", "down"]),
            softness: Finite.min(0).max(1).optional(),
          })
          .strict(),
        z
          .object({
            type: z.literal("zoom"),
            duration: Finite.positive().max(30),
            direction: z.enum(["in", "out"]),
          })
          .strict(),
      ]),
    })
    .strict(),
  z
    .object({
      type: z.literal("setSceneBackground"),
      sceneId: Id,
      fill: z.string().min(1),
    })
    .strict(),
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
