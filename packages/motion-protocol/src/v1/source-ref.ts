/**
 * Click-to-edit / hit-test pointer into a V1 authoring project.
 *
 * Provenance (`provenance.sourceMap`) maps ids to origin strings.
 * This schema names a visual unit: a layer, or a rich-text run on a layer.
 */
import { z } from "zod";
import { IdSchema } from "./common";

export const SourceRefKindSchema = z.enum(["layer", "text-run"]);

export const SourceRefSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("layer"),
      layerId: IdSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("text-run"),
      layerId: IdSchema,
      runId: IdSchema,
    })
    .strict(),
]);

export type SourceRef = z.infer<typeof SourceRefSchema>;
export type SourceRefKind = z.infer<typeof SourceRefKindSchema>;

export function sourceRefKey(ref: SourceRef): string {
  switch (ref.kind) {
    case "layer":
      return `layer:${ref.layerId}`;
    case "text-run":
      return `text-run:${ref.layerId}:${ref.runId}`;
  }
}
