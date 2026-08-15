/**
 * Con trỏ editor vào project authoring V1 (click-to-edit).
 * Không phải field JSON appearance; không thuộc contract hit-test authoring.
 *
 * Trỏ layer hoặc text-run trên layer. Không phải node/clip/caption-track.
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
