import { z } from "zod";

export const emptyPayloadSchema = z
  .union([z.undefined(), z.null()])
  .optional();

export const confirmCloseSchema = z.object({
  ok: z.boolean(),
});

export const openPathSchema = z.object({
  path: z.string().min(1),
});

export const saveProjectSchema = z.object({
  path: z.string().min(1).optional(),
  documentJson: z.string().min(1),
});

export const saveProjectAsSchema = z.object({
  suggestedName: z.string().min(1).optional(),
  documentJson: z.string().min(1),
});

export const importFilesSchema = z.object({
  projectPath: z.string().min(1),
  paths: z.array(z.string().min(1)).optional(),
});

export const resolveAssetSchema = z.object({
  projectPath: z.string().min(1),
  assetId: z.string().min(1),
  uri: z.string().min(1),
});

export const relinkAssetSchema = z.object({
  projectPath: z.string().min(1),
  assetId: z.string().min(1),
  newPath: z.string().min(1).optional(),
});

export const listMissingAssetsSchema = z.object({
  projectPath: z.string().min(1),
  assets: z.array(
    z.object({
      id: z.string().min(1),
      uri: z.string().min(1),
    }),
  ),
});

export const startExportSchema = z.object({
  projectId: z.string().min(1),
  projectJson: z.string().min(1),
  projectPath: z.string().min(1).optional(),
  outputPath: z.string().min(1).optional(),
  overwrite: z.boolean().optional(),
  presetId: z.string().min(1).optional(),
});

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
