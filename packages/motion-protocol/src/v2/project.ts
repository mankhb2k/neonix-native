import { z } from "zod";
import { V2CompositionSchema } from "./composition";
import { V2IdSchema } from "./common";
import { V2AssetListSchema } from "./assets";
import { V2AudioDomainSchema } from "./audio";
import { V2LayerListSchema } from "./layers";
import { V2MarkerListSchema } from "./markers";
import { V2ClipPathListSchema } from "./clip";
import { V2MaskListSchema } from "./mask";
import { V2FilterListSchema } from "./filter";
import { V2PaintServerListSchema, type V2Paint, type V2PatternContent } from "./paint";
import type { MotionProtocolV2 } from "./types";

const COMMON_NUMBER_PATHS = new Set([
  "opacity",
  "frame.width",
  "frame.height",
  "transform.translate.x",
  "transform.translate.y",
  "transform.translate.z",
  "transform.scale.x",
  "transform.scale.y",
  "transform.scale.z",
  "transform.rotate.x",
  "transform.rotate.y",
  "transform.rotate.z",
  "transform.skew.x",
  "transform.skew.y",
  "transform.anchor.x",
  "transform.anchor.y",
  "transform.anchor.z",
]);

const COMMON_ENUM_PATHS = new Set([
  "composite.blendMode",
  "composite.isolation",
  "visibility",
]);

const COMMON_BOOLEAN_PATHS = new Set(["enabled"]);

function trackValueKinds(path: string, layer: MotionProtocolV2["layers"][number]): Set<string> | null {
  if (COMMON_NUMBER_PATHS.has(path)) return new Set(["number"]);
  if (COMMON_ENUM_PATHS.has(path)) return new Set(["enum"]);
  if (COMMON_BOOLEAN_PATHS.has(path)) return new Set(["boolean"]);

  const layerPaths: Record<string, Set<string>> = {
    shape: new Set(["payload.cornerRadius", "style.fillOpacity", "style.strokeWidth", "style.strokeOpacity"]),
    path: new Set(["style.fillOpacity", "style.strokeWidth", "style.strokeOpacity", "payload.morph.progress"]),
    text: new Set(),
    image: new Set(["payload.x", "payload.y", "payload.width", "payload.height"]),
    video: new Set(["payload.trimStart", "payload.trimEnd"]),
    group: new Set(),
  };
  if (layerPaths[layer.type]?.has(path)) return new Set(["number"]);

  if (layer.type === "text") {
    const segments = path.split(".");
    if (segments.length === 5
      && segments[0] === "payload"
      && segments[1] === "chunks"
      && segments[2] === "spans"
      && segments[4] === "fill"
      && layer.payload.chunks.some((chunk) => chunk.spans.some((span) => span.id === segments[3]))) {
      return new Set(["color"]);
    }
    if (segments.length === 6
      && segments[0] === "payload"
      && segments[1] === "chunks"
      && segments[2] === "spans"
      && segments[4] === "font"
      && segments[5] === "size"
      && layer.payload.chunks.some((chunk) => chunk.spans.some((span) => span.id === segments[3]))) {
      return new Set(["number"]);
    }
  }

  const colorPaths = layer.type === "shape"
    ? new Set(["style.fill"])
    : layer.type === "path"
      ? new Set(["style.fill", "style.stroke"])
      : new Set<string>();
  if (colorPaths.has(path)) return new Set(["color"]);

  const enumPaths = layer.type === "image"
      ? new Set(["payload.fit", "payload.preserveAspectRatio.align", "payload.preserveAspectRatio.meetOrSlice", "payload.imageRendering"])
      : layer.type === "video"
        ? new Set(["payload.fit"])
      : new Set<string>();
  if (enumPaths.has(path)) return new Set(["enum"]);

  const segments = path.split(".");
  if (segments[0] !== "effects" || segments.length < 3) return null;
  const effectId = segments[1]!;
  const effect = "effects" in layer
    ? layer.effects?.find((candidate) => candidate.id === effectId)
    : undefined;
  if (!effect) return null;
  const effectNumberFields: Record<string, readonly string[]> = {
    "color-adjust": ["brightness", "contrast", "saturation", "hueRotate"],
    grayscale: ["amount"],
    sepia: ["amount"],
    invert: ["amount"],
    "filter-opacity": ["amount"],
    blur: ["radius"],
    shadow: ["blur", "spread", "offset.x", "offset.y"],
    "outer-glow": ["radius", "opacity"],
    "inner-glow": ["radius", "opacity"],
    noise: ["scale", "amount", "opacity", "seed"],
  };
  const effectField = segments.slice(2).join(".");
  if (effectNumberFields[effect.type]?.includes(effectField)) return new Set(["number"]);
  if ((effect.type === "shadow" || effect.type === "outer-glow" || effect.type === "inner-glow") && effectField === "color") {
    return new Set(["color"]);
  }
  if (effect.type === "shadow" && effectField === "inset") return new Set(["boolean"]);
  return null;
}

export const MotionProtocolV2Schema = z
  .object({
    format: z.literal("motion-protocol"),
    formatVersion: z.literal(2),
    id: V2IdSchema,
    composition: V2CompositionSchema,
    assets: V2AssetListSchema,
    markers: V2MarkerListSchema.optional(),
    clipPaths: V2ClipPathListSchema.optional(),
    masks: V2MaskListSchema.optional(),
    filters: V2FilterListSchema.optional(),
    /** SVG paint-server definitions referenced by fill/stroke paint values. */
    paintServers: V2PaintServerListSchema.optional(),
    layers: V2LayerListSchema,
    audio: V2AudioDomainSchema,
  })
  .strict()
  .superRefine((project, ctx) => {
    const markerIds = new Set((project.markers ?? []).map((marker) => marker.id));
    const clipPathIds = new Set((project.clipPaths ?? []).map((clipPath) => clipPath.id));
    const maskIds = new Set((project.masks ?? []).map((mask) => mask.id));
    const filterIds = new Set((project.filters ?? []).map((filter) => filter.id));
    const paintServerIds = new Set((project.paintServers ?? []).map((paintServer) => paintServer.id));
    const ids = new Set<string>();
    const ordersByParent = new Map<string | null, Set<number>>();
    const assetIds = new Set<string>();
    const assetById = new Map<string, MotionProtocolV2["assets"][number]>();
    const layerById = new Map(project.layers.map((layer) => [layer.id, layer]));
    for (const [index, layer] of project.layers.entries()) {
      if (layer.type === "text" && layer.payload.layout?.textOverflow === "ellipsis" && layer.clipPath === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Text ellipsis requires a deterministic clipPath",
          path: ["layers", index, "payload", "layout", "textOverflow"],
        });
      }
    }

    const checkPaintReferences = (paint: V2Paint | undefined, path: (string | number)[], seen = new Set<string>()): void => {
      if (!paint || typeof paint === "string") return;
      if (paint.type === "reference") {
        if (!paintServerIds.has(paint.id)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Unknown paint server reference: ${paint.id}`, path: [...path, "id"] });
        } else if (seen.has(paint.id)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Paint server reference cycle: ${paint.id}`, path: [...path, "id"] });
        }
        return;
      }
      if ((paint.type === "linear-gradient" || paint.type === "radial-gradient" || paint.type === "conic-gradient" || paint.type === "pattern") && paint.href) {
        if (!paintServerIds.has(paint.href)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Unknown paint server href: ${paint.href}`, path: [...path, "href"] });
        }
      }
      if (paint.type === "pattern") {
        paint.content?.forEach((node: V2PatternContent, index: number) => checkPatternNode(node, [...path, "content", index], seen));
      }
    };
    const checkPatternNode = (node: V2PatternContent, path: (string | number)[], seen: Set<string>): void => {
      if (node.type === "group") {
        node.children.forEach((child: V2PatternContent, index: number) => checkPatternNode(child, [...path, "children", index], seen));
        return;
      }
      checkPaintReferences(node.fill, [...path, "fill"], seen);
      checkPaintReferences(node.stroke, [...path, "stroke"], seen);
    };
    (project.paintServers ?? []).forEach((definition, index) => checkPaintReferences(definition.paint, ["paintServers", index, "paint"]));
    for (const [index, asset] of project.assets.entries()) {
      if (assetIds.has(asset.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate asset id: ${asset.id}`,
          path: ["assets", index, "id"],
        });
      }
      assetIds.add(asset.id);
      assetById.set(asset.id, asset);
    }
    for (const [layerIndex, layer] of project.layers.entries()) {
      if (layer.type !== "text") continue;
      for (const [chunkIndex, chunk] of layer.payload.chunks.entries()) {
        for (const [spanIndex, span] of chunk.spans.entries()) {
          for (const [assetIndex, assetId] of (span.resolvedFontAssetIds ?? []).entries()) {
            const asset = assetById.get(assetId);
            const path = ["layers", layerIndex, "payload", "chunks", chunkIndex, "spans", spanIndex, "resolvedFontAssetIds", assetIndex] as (string | number)[];
            if (!asset) {
              ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Unknown resolved font asset: ${assetId}`, path });
            } else if (asset.kind !== "font") {
              ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Resolved text asset must be a font: ${assetId}`, path });
            }
          }
        }
      }
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
      if (layer.type === "shape" || layer.type === "path") {
        checkPaintReferences(layer.style.fill, ["layers", index, "style", "fill"]);
        checkPaintReferences(layer.style.stroke, ["layers", index, "style", "stroke"]);
        for (const field of ["markerStart", "markerMid", "markerEnd"] as const) {
          const markerId = layer.style[field];
          if (markerId !== undefined && !markerIds.has(markerId)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Unknown marker reference: ${markerId}`,
              path: ["layers", index, "style", field],
            });
          }
        }
      }
      if (layer.clipPath !== undefined && !clipPathIds.has(layer.clipPath)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Unknown clipPath reference: ${layer.clipPath}`, path: ["layers", index, "clipPath"] });
      }
      if (layer.mask !== undefined && !maskIds.has(layer.mask)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Unknown mask reference: ${layer.mask}`, path: ["layers", index, "mask"] });
      }
      if (layer.filter !== undefined && !filterIds.has(layer.filter)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Unknown filter reference: ${layer.filter}`, path: ["layers", index, "filter"] });
      }
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
      for (const [trackIndex, track] of (layer.tracks ?? []).entries()) {
        const allowedKinds = trackValueKinds(track.path, layer);
        if (!allowedKinds) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Track path does not identify an animatable property on layer ${layer.id}: ${track.path}`,
            path: ["layers", index, "tracks", trackIndex, "path"],
          });
        } else if (track.keyframes.some((keyframe) => !allowedKinds.has(keyframe.value.type))) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Track value type does not match property path: ${track.path}`,
            path: ["layers", index, "tracks", trackIndex, "keyframes"],
          });
        }
        if (track.keyframes.some((keyframe) => keyframe.time > layer.timing.duration)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Track keyframe time cannot exceed layer duration: ${track.path}`,
            path: ["layers", index, "tracks", trackIndex, "keyframes"],
          });
        }
      }
      if (layer.type === "image") {
        const source = project.assets.find((asset) => asset.id === layer.payload.assetId);
        if (source && source.kind !== "image") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Image layer must reference an image asset: ${layer.payload.assetId}`,
            path: ["layers", index, "payload", "assetId"],
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
              message: `Video timing duration cannot exceed the selected source range (${availableDuration}ms)`,
              path: ["layers", index, "timing", "duration"],
            });
          }
          if (layer.payload.trimStart !== undefined && layer.payload.trimStart >= source.duration) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
            message: `Video trimStart cannot reach or exceed source duration (${source.duration}ms)`,
              path: ["layers", index, "payload", "trimStart"],
            });
          }
          if (layer.payload.trimEnd !== undefined && layer.payload.trimEnd > source.duration) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
            message: `Video trimEnd cannot exceed source duration (${source.duration}ms)`,
              path: ["layers", index, "payload", "trimEnd"],
            });
          }
        }
      }
    }
  }) as z.ZodType<MotionProtocolV2>;

export type { MotionProtocolV2 } from "./types";
