/**
 * V3 source-ref schemas — canonical source of truth.

 */
import { z } from "zod";
import { IdSchema } from "./common";

export const SourceRefKindSchema = z.enum([
  "text-run",
  "caption-token",
  "caption-cue",
  "node",
  "clip",
]);

export const SourceRefSchema = z
  .object({
    kind: SourceRefKindSchema,
    nodeId: IdSchema.optional(),
    runId: IdSchema.optional(),
    captionTrackId: IdSchema.optional(),
    tokenId: IdSchema.optional(),
    cueId: IdSchema.optional(),
    clipId: IdSchema.optional(),
  })
  .strict()
  .superRefine((ref, context) => {
    let missing = false;
    switch (ref.kind) {
      case "text-run":
        if (!ref.nodeId || !ref.runId) missing = true;
        break;
      case "caption-token":
        if (!ref.captionTrackId || !ref.tokenId) missing = true;
        break;
      case "caption-cue":
        if (!ref.captionTrackId || !ref.cueId) missing = true;
        break;
      case "node":
        if (!ref.nodeId) missing = true;
        break;
      case "clip":
        if (!ref.clipId) missing = true;
        break;
    }
    if (missing) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `SourceRef kind "${ref.kind}" requires kind-specific fields`,
      });
    }
  });

export type SourceRef = z.infer<typeof SourceRefSchema>;
export type SourceRefKind = z.infer<typeof SourceRefKindSchema>;

export function sourceRefKey(ref: SourceRef): string {
  switch (ref.kind) {
    case "text-run":
      return `${ref.kind}:${ref.nodeId}:${ref.runId}`;
    case "caption-token":
      return `${ref.kind}:${ref.captionTrackId}:${ref.tokenId}`;
    case "caption-cue":
      return `${ref.kind}:${ref.captionTrackId}:${ref.cueId}`;
    case "node":
      return `${ref.kind}:${ref.nodeId}`;
    case "clip":
      return `${ref.kind}:${ref.clipId}`;
  }
}
