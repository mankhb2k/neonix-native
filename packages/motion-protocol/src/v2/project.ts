import { z } from "zod";
import { V2CompositionSchema } from "./composition";
import { V2IdSchema } from "./common";
import { V2AssetListSchema } from "./assets";
import { V2AudioDomainSchema } from "./audio";
import { V2LayerListSchema } from "./layers";
import type { MotionProtocolV2 } from "./types";

export const MotionProtocolV2Schema = z
  .object({
    format: z.literal("motion-protocol"),
    formatVersion: z.literal(2),
    id: V2IdSchema,
    composition: V2CompositionSchema,
    assets: V2AssetListSchema,
    layers: V2LayerListSchema,
    audio: V2AudioDomainSchema,
  })
  .strict()
  .superRefine((project, ctx) => {
    const ids = new Set<string>();
    const ordersByParent = new Map<string | null, Set<number>>();
    const assetIds = new Set<string>();
    const layerById = new Map(project.layers.map((layer) => [layer.id, layer]));
    for (const [index, asset] of project.assets.entries()) {
      if (assetIds.has(asset.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate asset id: ${asset.id}`,
          path: ["assets", index, "id"],
        });
      }
      assetIds.add(asset.id);
    }
    const trackIds = new Set<string>();
    const audioClipIds = new Set<string>();
    for (const [trackIndex, track] of project.audio.tracks.entries()) {
      if (trackIds.has(track.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate audio track id: ${track.id}`,
          path: ["audio", "tracks", trackIndex, "id"],
        });
      }
      trackIds.add(track.id);
      for (const [clipIndex, clip] of track.clips.entries()) {
        if (audioClipIds.has(clip.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate audio clip id: ${clip.id}`,
            path: ["audio", "tracks", trackIndex, "clips", clipIndex, "id"],
          });
        }
        audioClipIds.add(clip.id);
        const source = project.assets.find((asset) => asset.id === clip.assetId);
        if (!source) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Unknown audio asset: ${clip.assetId}`,
            path: ["audio", "tracks", trackIndex, "clips", clipIndex, "assetId"],
          });
        } else if (source.kind !== "audio" && source.kind !== "video") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Audio clip must reference an audio or video asset: ${clip.assetId}`,
            path: ["audio", "tracks", trackIndex, "clips", clipIndex, "assetId"],
          });
        }
      }
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
      const siblingOrders = ordersByParent.get(layer.parentLayerId) ?? new Set<number>();
      if (siblingOrders.has(layer.order)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate order in sibling scope: ${layer.order}`,
          path: ["layers", index, "order"],
        });
      }
      siblingOrders.add(layer.order);
      ordersByParent.set(layer.parentLayerId, siblingOrders);
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
      if (layer.type === "video" && layer.payload.audio) {
        for (const [field, fade] of [["fadeIn", layer.payload.audio.fadeIn], ["fadeOut", layer.payload.audio.fadeOut]] as const) {
          if (fade && fade.duration > layer.timing.duration) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Video embedded audio ${field} duration cannot exceed video duration`,
              path: ["layers", index, "payload", "audio", field, "duration"],
            });
          }
        }
      }
      if (layer.type === "video") {
        const source = project.assets.find((asset) => asset.id === layer.payload.assetId);
        if (source?.kind === "video" && source.duration !== undefined) {
          const trimStart = layer.payload.trimStart ?? 0;
          const trimEnd = Math.min(layer.payload.trimEnd ?? source.duration, source.duration);
          const availableDuration = trimEnd - trimStart;
          if (availableDuration > 0 && layer.timing.duration > availableDuration) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Video timing duration cannot exceed the selected source range (${availableDuration}s)`,
              path: ["layers", index, "timing", "duration"],
            });
          }
          if (layer.payload.trimStart !== undefined && layer.payload.trimStart >= source.duration) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Video trimStart cannot reach or exceed source duration (${source.duration}s)`,
              path: ["layers", index, "payload", "trimStart"],
            });
          }
          if (layer.payload.trimEnd !== undefined && layer.payload.trimEnd > source.duration) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Video trimEnd cannot exceed source duration (${source.duration}s)`,
              path: ["layers", index, "payload", "trimEnd"],
            });
          }
        }
      }
    }
  }) as z.ZodType<MotionProtocolV2>;

export type { MotionProtocolV2 } from "./types";
