/**
 * V1 project metadata.
 *
 * Unlike v2 there is no `aspectRatio`/`fps` here — the composition is
 * described by `composition.ts`. `locale` is a full BCP-47 identifier
 * (v2 locked it to `vi-VN`).
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
