import { z } from "zod";
import { V2CompositionSchema } from "./composition";
import { V2IdSchema } from "./common";
import { V2AssetListSchema } from "./assets";
import { V2LayerListSchema } from "./layers";
import type { MotionProtocolV2 } from "./types";

export const MotionProtocolV2Schema = z
  .object({
    format: z.literal("motion-protocol"),
    formatVersion: z.literal(2),
    id: V2IdSchema,
    composition: V2CompositionSchema,
    assets: V2AssetListSchema.optional(),
    layers: V2LayerListSchema,
  })
  .strict()
  .superRefine((project, ctx) => {
    const ids = new Set<string>();
    const zIndexes = new Set<number>();
    const assetIds = new Set<string>();
    const layerById = new Map(project.layers.map((layer) => [layer.id, layer]));
    for (const [index, asset] of (project.assets ?? []).entries()) {
      if (assetIds.has(asset.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate asset id: ${asset.id}`,
          path: ["assets", index, "id"],
        });
      }
      assetIds.add(asset.id);
    }
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
      const mask = layer.composite?.mask;
      if (mask) {
        if (layer.type !== "group") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Clip mask is currently supported only on group layers",
            path: ["layers", index, "composite", "mask"],
          });
        }
        if (mask.sourceLayerId === layer.id) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Clip mask source cannot be the masked group itself",
            path: ["layers", index, "composite", "mask", "sourceLayerId"],
          });
        }
        const source = layerById.get(mask.sourceLayerId);
        const requiresShapeSource = mask.mode === "clip";
        if (!source || source.parentLayerId !== layer.id || source.type === "group" || (requiresShapeSource && source.type !== "shape")) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: requiresShapeSource
              ? "Clip mask source must be a direct child shape of the masked group"
              : "Alpha mask source must be a direct drawable child of the masked group",
            path: ["layers", index, "composite", "mask", "sourceLayerId"],
          });
        } else if (source.effects?.length || (source.composite?.blendMode ?? "normal") !== "normal") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Mask source cannot have effects or a non-normal blend mode",
            path: ["layers", index, "composite", "mask", "sourceLayerId"],
          });
        }
      }
      if (layer.type === "text") {
        const assetIndex = (project.assets ?? []).findIndex(
          (asset) => asset.id === layer.payload.fontAssetId,
        );
        const asset = assetIndex >= 0 ? project.assets?.[assetIndex] : undefined;
        if (!asset) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Unknown font asset: ${layer.payload.fontAssetId}`,
            path: ["layers", index, "payload", "fontAssetId"],
          });
        } else if (asset.kind !== "font") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Text layer must reference a font asset: ${layer.payload.fontAssetId}`,
            path: ["layers", index, "payload", "fontAssetId"],
          });
        }
      }
    }
  }) as z.ZodType<MotionProtocolV2>;

export type { MotionProtocolV2 } from "./types";
