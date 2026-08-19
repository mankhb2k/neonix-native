import { V1 } from "@motionvideo/motion-protocol";
import type {
  MotionRuntimeProject,
  RuntimeVisualLayer,
} from "@motionvideo/motion-protocol/runtime";
import { clone, pixelFormatHasAlpha, type JsonRecord } from "./helpers";

type RuntimeAsset = MotionRuntimeProject["assets"][number];
type RuntimeAudioLayer = Extract<
  MotionRuntimeProject["layers"][number],
  { type: "audio" }
>;

function runtimeAppearance(node: V1.LayerV1): {
  visible: boolean;
  opacity: number;
} {
  const opacity = "opacity" in node ? (node.opacity ?? 100) : 100;
  return { visible: opacity > 0, opacity };
}

export function prepareRuntimeLayer(node: V1.LayerV1): RuntimeVisualLayer {
  if (node.type === "audio") {
    return {
      id: node.id,
      type: node.type,
      parentLayerId: node.parentLayerId,
      zIndex: node.zIndex,
      timing: clone(node.timing),
      payload: clone(node.payload),
    };
  }
  const base: JsonRecord = {
    id: node.id,
    type: node.type,
    parentLayerId: node.parentLayerId,
    transform: clone(node.transform),
    appearance: runtimeAppearance(node),
  };
  if ("frame" in node && node.frame) base.frame = clone(node.frame);
  base.zIndex = node.zIndex;
  base.timing = clone(node.timing);
  if ("effects" in node && node.effects && node.effects.length > 0)
    base.effects = clone(node.effects);
  if (node.compositing) base.compositing = clone(node.compositing);

  const payload = (node.payload ?? {}) as JsonRecord;
  switch (node.type) {
    case "text":
      return {
        ...base,
        payload: {
          text: payload.text,
          ...(payload.fontAssetId !== undefined
            ? { fontAssetId: payload.fontAssetId }
            : {}),
          fontSize: payload.fontSize,
          ...(payload.color !== undefined ? { color: payload.color } : {}),
          alignment: payload.alignment,
          wrap: payload.wrap,
          ...(payload.lineHeight !== undefined
            ? { lineHeight: payload.lineHeight }
            : {}),
          ...(payload.letterSpacing !== undefined
            ? { letterSpacing: payload.letterSpacing }
            : {}),
          ...(payload.maxLines !== undefined
            ? { maxLines: payload.maxLines }
            : {}),
          overflow: payload.overflow,
        },
        style: { fill: payload.color },
      };
    case "image":
      return {
        ...base,
        payload: {
          assetId: payload.assetId,
          fit: payload.fit ?? "cover",
          ...(payload.crop !== undefined ? { crop: clone(payload.crop) } : {}),
        },
      };
    case "svg": {
      const style =
        node.type === "svg" && node.style
          ? { fill: node.style.fill }
          : undefined;
      return {
        ...base,
        payload: {
          assetId: payload.assetId,
          fit: payload.fit ?? "contain",
        },
        ...(style ? { style } : {}),
      };
    }
    case "video":
      return {
        ...base,
        payload: {
          assetId: payload.assetId,
          fit: payload.fit ?? "cover",
          ...(payload.trimStart !== undefined
            ? { trimStart: payload.trimStart }
            : {}),
          ...(payload.trimEnd !== undefined
            ? { trimEnd: payload.trimEnd }
            : {}),
          loop: payload.loop ?? false,
          muted: payload.muted ?? false,
          ...(payload.framePolicy !== undefined
            ? { framePolicy: payload.framePolicy }
            : {}),
        },
      };
    case "camera":
      return {
        ...base,
        payload: {
          zoom: (payload.zoom as number | undefined) ?? 1,
          ...(payload.projection !== undefined
            ? { projection: payload.projection }
            : {}),
          ...(payload.parallaxStrength !== undefined
            ? { parallaxStrength: payload.parallaxStrength }
            : {}),
          ...(payload.fieldOfView !== undefined
            ? { fov: payload.fieldOfView }
            : {}),
          ...(payload.near !== undefined ? { near: payload.near } : {}),
          ...(payload.far !== undefined ? { far: payload.far } : {}),
        },
      };
    case "solid":
      return {
        ...base,
        payload: {
          color: payload.color,
        },
      };
    case "group":
      return {
        ...base,
        payload: {},
      };
    case "bone":
      return {
        ...base,
        payload: clone(node.payload),
      };
    case "adjustment":
      return {
        ...base,
        payload: {
          ...(payload.brightness !== undefined
            ? { brightness: payload.brightness }
            : {}),
          ...(payload.contrast !== undefined
            ? { contrast: payload.contrast }
            : {}),
          ...(payload.saturation !== undefined
            ? { saturation: payload.saturation }
            : {}),
          ...(payload["hue-rotate"] !== undefined
            ? { "hue-rotate": payload["hue-rotate"] }
            : {}),
        },
      };
    case "shape":
      return {
        ...base,
        payload: clone(node.payload),
        ...(node.style ? { style: clone(node.style) } : {}),
      };
    case "path":
      return {
        ...base,
        payload: {
          ...clone(node.payload),
          fillRule: node.payload.fillRule ?? "nonzero",
        },
        ...(node.style ? { style: clone(node.style) } : {}),
      };
    case "component":
      return {
        ...base,
        payload: clone(node.payload),
      };
  }
}

export function prepareRuntimeAudioLayer(
  layer: V1.AudioLayerV1,
): RuntimeAudioLayer {
  return {
    id: layer.id,
    type: "audio",
    parentLayerId: null,
    zIndex: layer.zIndex,
    timing: clone(layer.timing),
    payload: clone(layer.payload),
  };
}

export function prepareRuntimeAsset(
  asset: V1.AssetV1,
  resolvedUri: string,
): RuntimeAsset {
  switch (asset.assetType) {
    case "image": {
      const pixelFormat = asset.pixelFormat ?? "rgba";
      return {
        id: asset.id,
        uri: resolvedUri,
        integrity: asset.integrity,
        assetType: "image",
        mimeType: asset.mimeType,
        width: asset.width,
        height: asset.height,
        pixelFormat,
        hasAlpha: asset.hasAlpha ?? pixelFormatHasAlpha(pixelFormat),
      };
    }
    case "svg":
      return {
        id: asset.id,
        uri: resolvedUri,
        integrity: asset.integrity,
        assetType: "svg",
        mimeType: asset.mimeType,
        width: asset.width,
        height: asset.height,
        viewBox: asset.viewBox ?? `0 0 ${asset.width} ${asset.height}`,
        sanitized: true,
      };
    case "video": {
      const hasAudio = Boolean(
        asset.audioCodec || asset.audioSampleRate || asset.audioChannels,
      );
      return {
        id: asset.id,
        uri: resolvedUri,
        integrity: asset.integrity,
        assetType: "video",
        mimeType: asset.mimeType,
        width: asset.width,
        height: asset.height,
        duration: asset.duration,
        fps: asset.fps,
        videoCodec: asset.codec ?? "h264",
        pixelFormat: asset.pixelFormat ?? "yuv420p",
        hasAudio,
        ...(hasAudio
          ? {
              audioCodec: asset.audioCodec ?? "aac",
              sampleRate: asset.audioSampleRate ?? 48000,
              channels: asset.audioChannels ?? 2,
            }
          : {}),
      };
    }
    case "audio":
      return {
        id: asset.id,
        uri: resolvedUri,
        integrity: asset.integrity,
        assetType: "audio",
        mimeType: asset.mimeType,
        duration: asset.duration,
        codec: asset.codec ?? "mp3",
        sampleRate: asset.sampleRate,
        channels: asset.channels,
      };
    case "font":
      return {
        id: asset.id,
        uri: resolvedUri,
        integrity: asset.integrity,
        assetType: "font",
        mimeType: asset.mimeType,
        family: asset.family,
        weight: asset.weight,
        style: asset.style,
        localeCoverage: asset.localeCoverage ?? ["vi"],
      };
  }
}
