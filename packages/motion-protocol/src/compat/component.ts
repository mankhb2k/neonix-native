import { z } from "zod";
import { MOTION_V2_LIMITS } from "../capabilities";
import { ClipV2Schema } from "../runtime/animation/clips";
import { AssetV2Schema } from "../runtime/assets";
import {
  FiniteNumberSchema,
  IdSchema,
  MOTION_COMPONENT_FORMAT_VERSION,
  SemverSchema,
} from "../runtime/common";
import { NodeV2Schema } from "../runtime/nodes";
import { JsonValueSchema } from "../runtime/values";
import {
  ComponentBindingSchema,
  PublicParamSchema,
  VariableV2Schema,
} from "../v3/variables";

const SvgSourceImportSchema = z
  .object({
    id: IdSchema,
    kind: z.literal("svg"),
    sourceAssetId: IdSchema,
    sourceIntegrity: z.string().min(1),
    parts: z
      .array(
        z
          .object({
            id: IdSchema,
            sourceElementIds: z
              .array(IdSchema)
              .min(1)
              .max(MOTION_V2_LIMITS.sourceElementIdsPerPart),
            structuralFingerprint: z.string().min(1),
            nodeId: IdSchema,
            outputAssetId: IdSchema,
            originalName: z.string().min(1).optional(),
          })
          .strict(),
      )
      .max(MOTION_V2_LIMITS.sourcePartsPerImport),
  })
  .strict();

export const CutoutVariantSlotSchema = z
  .object({
    id: IdSchema,
    nodeId: IdSchema,
    semanticRole: IdSchema,
    defaultVariantId: IdSchema,
    variants: z
      .array(
        z
          .object({
            id: IdSchema,
            assetId: IdSchema,
            semantic: IdSchema.optional(),
          })
          .strict(),
      )
      .min(1)
      .max(MOTION_V2_LIMITS.variantsPerSlot),
  })
  .strict();

export const CutoutRigSchema = z
  .object({
    id: IdSchema,
    kind: z.literal("cutout"),
    rootNodeId: IdSchema,
    slots: z
      .array(CutoutVariantSlotSchema)
      .max(MOTION_V2_LIMITS.variantSlotsPerRig),
  })
  .strict();

export const LipSyncCueSchema = z
  .object({
    id: IdSchema,
    at: FiniteNumberSchema.nonnegative().max(
      MOTION_V2_LIMITS.mediaDurationSeconds,
    ),
    variantId: IdSchema,
  })
  .strict();

export const LipSyncSchema = z
  .object({
    slotId: IdSchema,
    cues: z
      .array(LipSyncCueSchema)
      .min(1)
      .max(MOTION_V2_LIMITS.lipSyncCuesPerAction),
  })
  .strict();

export const MotionActionSchema = z
  .object({
    id: IdSchema,
    name: z.string().min(1),
    duration: FiniteNumberSchema.positive().max(
      MOTION_V2_LIMITS.mediaDurationSeconds,
    ),
    loop: z.boolean().default(false),
    clips: z.array(ClipV2Schema).max(MOTION_V2_LIMITS.clipsPerAction),
    lipSync: LipSyncSchema.optional(),
  })
  .strict()
  .superRefine((action, context) => {
    if (action.clips.length === 0 && !action.lipSync) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["clips"],
        message: "Action requires clips or lipSync",
      });
    }
  });

export const MotionComponentV2Schema = z
  .object({
    format: z.literal("motion-component"),
    formatVersion: z.literal(MOTION_COMPONENT_FORMAT_VERSION),
    componentId: IdSchema,
    componentVersion: SemverSchema,
    metadata: z.record(JsonValueSchema),
    assets: z
      .array(AssetV2Schema)
      .max(MOTION_V2_LIMITS.assetsPerArtifact)
      .default([]),
    variables: z
      .array(VariableV2Schema)
      .max(MOTION_V2_LIMITS.variablesPerArtifact),
    publicAPI: z
      .array(PublicParamSchema)
      .max(MOTION_V2_LIMITS.publicParamsPerComponent),
    nodes: z.array(NodeV2Schema).min(1).max(MOTION_V2_LIMITS.nodesPerComponent),
    bindings: z
      .array(ComponentBindingSchema)
      .max(MOTION_V2_LIMITS.bindingsPerArtifact)
      .default([]),
    clips: z
      .array(ClipV2Schema)
      .max(MOTION_V2_LIMITS.clipsPerComponent)
      .default([]),
    sourceImports: z
      .array(SvgSourceImportSchema)
      .max(MOTION_V2_LIMITS.sourceImportsPerComponent)
      .default([]),
    cutoutRigs: z
      .array(CutoutRigSchema)
      .max(MOTION_V2_LIMITS.cutoutRigsPerComponent)
      .default([]),
    actions: z
      .array(MotionActionSchema)
      .max(MOTION_V2_LIMITS.actionsPerComponent)
      .default([]),
  })
  .strict();

export type MotionComponentV2 = z.infer<typeof MotionComponentV2Schema>;
