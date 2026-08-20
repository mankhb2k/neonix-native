import { z } from "zod";
import { V2CompositionSchema } from "./composition";
import { V2IdSchema } from "./common";
import { V2LayerListSchema } from "./layers";
import type { MotionProtocolV2 } from "./types";

export const MotionProtocolV2Schema = z
  .object({
    format: z.literal("motion-protocol"),
    formatVersion: z.literal(2),
    id: V2IdSchema,
    composition: V2CompositionSchema,
    layers: V2LayerListSchema,
  })
  .strict()
  .superRefine((project, ctx) => {
    const ids = new Set<string>();
    const zIndexes = new Set<number>();
    for (const [index, layer] of project.layers.entries()) {
      if (ids.has(layer.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate layer id: ${layer.id}`,
          path: ["layers", index, "id"],
        });
      }
      ids.add(layer.id);
      if (layer.parentLayerId !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Protocol V2 core only supports root atoms until groups are certified",
          path: ["layers", index, "parentLayerId"],
        });
      }
      if (zIndexes.has(layer.zIndex)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate zIndex: ${layer.zIndex}`,
          path: ["layers", index, "zIndex"],
        });
      }
      zIndexes.add(layer.zIndex);
    }
  }) as z.ZodType<MotionProtocolV2>;

export type { MotionProtocolV2 } from "./types";
