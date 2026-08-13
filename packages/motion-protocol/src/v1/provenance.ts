/**
 * V1 provenance — debug/trace metadata.
 *
 * Excluded from the render hash: provenance never affects rendered output,
 * only explains where a bundle came from.
 */
import { z } from "zod";
import { IdSchema } from "./common";

export const SourceMapSchema = z
  .object({
    scenes: z.record(IdSchema, z.string().min(1)).optional(),
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
