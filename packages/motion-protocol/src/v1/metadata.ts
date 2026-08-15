/**
 * Metadata project V1.
 *
 * Không chứa aspectRatio/fps (nằm ở composition.ts). locale là BCP-47 đầy đủ.
 */
import { z } from "zod";
import { IdSchema, LocaleIdentifierSchema } from "./common";

export const ProjectMetadataV1Schema = z
  .object({
    id: IdSchema,
    name: z.string().min(1),
    description: z.string().optional(),
    locale: LocaleIdentifierSchema,
    industry: z.string().optional(),
    tags: z.array(IdSchema).max(64).optional(),
    createdAt: z.string().datetime().optional(),
    updatedAt: z.string().datetime().optional(),
  })
  .strict();

export type ProjectMetadataV1 = z.infer<typeof ProjectMetadataV1Schema>;
