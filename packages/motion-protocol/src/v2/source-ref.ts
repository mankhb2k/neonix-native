/**
 * SourceRef — click-to-edit mapping from paint/runtime back to authoring.
 * Used by caption cues/runs and rich-text runs (Phase 2–3).
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
    /** Authoring node id when applicable. */
    nodeId: IdSchema.optional(),
    /** Rich-text run id within a text node. */
    runId: IdSchema.optional(),
    /** Caption track id on the project timeline. */
    captionTrackId: IdSchema.optional(),
    /** Caption token id. */
    tokenId: IdSchema.optional(),
    /** Deterministic cue id after caption segmentation. */
    cueId: IdSchema.optional(),
    /** Clip id when the ref originates from a clip. */
    clipId: IdSchema.optional(),
  })
  .strict()
  .superRefine((ref, context) => {
    if (ref.kind === "text-run" && (!ref.nodeId || !ref.runId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "text-run SourceRef requires nodeId and runId",
      });
    }
    if (ref.kind === "caption-token" && (!ref.captionTrackId || !ref.tokenId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "caption-token SourceRef requires captionTrackId and tokenId",
      });
    }
    if (ref.kind === "caption-cue" && (!ref.captionTrackId || !ref.cueId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "caption-cue SourceRef requires captionTrackId and cueId",
      });
    }
    if (ref.kind === "node" && !ref.nodeId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "node SourceRef requires nodeId",
      });
    }
    if (ref.kind === "clip" && !ref.clipId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "clip SourceRef requires clipId",
      });
    }
  });

export type SourceRef = z.infer<typeof SourceRefSchema>;
export type SourceRefKind = z.infer<typeof SourceRefKindSchema>;

export function sourceRefKey(ref: SourceRef): string {
  switch (ref.kind) {
    case "text-run":
      return `text-run:${ref.nodeId}:${ref.runId}`;
    case "caption-token":
      return `caption-token:${ref.captionTrackId}:${ref.tokenId}`;
    case "caption-cue":
      return `caption-cue:${ref.captionTrackId}:${ref.cueId}`;
    case "node":
      return `node:${ref.nodeId}`;
    case "clip":
      return `clip:${ref.clipId}`;
    default: {
      const _exhaustive: never = ref.kind;
      return String(_exhaustive);
    }
  }
}
