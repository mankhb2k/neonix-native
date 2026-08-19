/**
 * Provenance V1 — metadata debug/trace.
 *
 * Không vào render hash: không ảnh hưởng output, chỉ giải thích nguồn bundle.
 */
import { z } from "zod";
import { IdSchema } from "../v1/common";

export const SourceMapSchema = z
  .object({
    layers: z.record(IdSchema, z.string().min(1)).optional(),
    components: z.record(IdSchema, z.string().min(1)).optional(),
    variables: z.record(IdSchema, z.string().min(1)).optional(),
    assets: z.record(IdSchema, z.string().min(1)).optional(),
  })
  .strict();

export type SourceMap = z.infer<typeof SourceMapSchema>;

export const ProjectProvenanceSchema = z
  .object({
    workspaceId: IdSchema.optional(),
    sourceHash: z.string().min(1).optional(),
    bundleProfile: z
      .enum(["embedded-components", "flattened-components"])
      .optional(),
    sourceMap: SourceMapSchema.optional(),
  })
  .strict();

export type ProjectProvenance = z.infer<typeof ProjectProvenanceSchema>;
