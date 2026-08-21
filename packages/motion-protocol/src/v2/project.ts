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
    const layerById = new Map(project.layers.map((layer) => [layer.id, layer]));
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
        const parent = layerById.get(layer.parentLayerId);
        if (!parent) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Unknown parent layer: ${layer.parentLayerId}`, path: ["layers", index, "parentLayerId"] });
        } else if (parent.type !== "group") {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Only group layers can parent child layers", path: ["layers", index, "parentLayerId"] });
        }
        const ancestry = new Set<string>();
        let current: string | null = layer.parentLayerId;
        while (current !== null) {
          if (ancestry.has(current) || current === layer.id) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Layer parent hierarchy contains a cycle", path: ["layers", index, "parentLayerId"] });
            break;
          }
          ancestry.add(current);
          current = layerById.get(current)?.parentLayerId ?? null;
        }
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
