import { z } from "zod";

export const emptyPayloadSchema = z
  .union([z.undefined(), z.null()])
  .optional();

export const createProjectSchema = z
  .object({
    name: z.string().min(1).optional(),
    aspectRatio: z.enum(["16:9", "9:16", "1:1"]).optional(),
  })
  .strict()
  .optional();

export const confirmCloseSchema = z.object({
  ok: z.boolean(),
});

/** Open a path already registered in the main recent list (by id only). */
export const saveProjectSchema = z
  .object({
    documentJson: z.string().min(1),
  })
  .strict();

export const openRecentSchema = z
  .object({
    id: z.string().min(1),
  })
  .strict();

export const saveProjectAsSchema = z.object({
  suggestedName: z.string().min(1).optional(),
  documentJson: z.string().min(1),
});

/** Import always uses a main dialog; project path comes from main session. */
export const importFilesSchema = emptyPayloadSchema;

export const resolveAssetSchema = z
  .object({
    assetId: z.string().min(1),
    uri: z.string().min(1),
  })
  .strict();

/** Relink always uses a main dialog; project path from session. */
export const relinkAssetSchema = z
  .object({
    assetId: z.string().min(1),
  })
  .strict();

export const listMissingAssetsSchema = z
  .object({
    assets: z.array(
      z.object({
        id: z.string().min(1),
        uri: z.string().min(1),
      }),
    ),
  })
  .strict();

export const startExportSchema = z
  .object({
    projectId: z.string().min(1),
    /** Baked MotionProject JSON (not desktop envelope). */
    projectJson: z.string().min(1),
    overwrite: z.boolean().optional(),
    presetId: z.string().min(1).optional(),
  })
  .strict();

export const cancelExportSchema = z.object({
  jobId: z.string().min(1),
});

export const exportEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("progress"),
    jobId: z.string().min(1),
    ratio: z.number().min(0).max(1),
    sequence: z.number().int().nonnegative(),
    message: z.string().optional(),
  }),
  z.object({
    type: z.literal("completed"),
    jobId: z.string().min(1),
    outputPath: z.string().min(1),
    sequence: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal("failed"),
    jobId: z.string().min(1),
    message: z.string().min(1),
    sequence: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal("cancelled"),
    jobId: z.string().min(1),
    sequence: z.number().int().nonnegative(),
  }),
]);
