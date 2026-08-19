/**
 * Metadata project V1 — core identity only (id, name, locale).
 *
 * Extras (description, tags, timestamps) live in envelope `metadataExtras`.
 */
import { z } from "zod";
import { IdSchema, LocaleIdentifierSchema } from "./common";

export const ProjectMetadataV1Schema = z
  .object({
    id: IdSchema,
    name: z.string().min(1),
    locale: LocaleIdentifierSchema,
  })
  .strict();

export type ProjectMetadataV1 = z.infer<typeof ProjectMetadataV1Schema>;
