import { V1 } from "@motionvideo/motion-protocol";
import {
  clone,
  pixelFormatHasAlpha,
  type JsonRecord,
  type V1SceneClip,
} from "./helpers";

export function prepareRuntimeLayer(node: V1.LayerV1): JsonRecord {
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
  const flags: {
    position?: boolean;
    rotation?: boolean;
    scale?: boolean;
    opacity?: boolean;
  } = node.inheritFlags ?? {};
  const transform = clone(node.transform) as JsonRecord;
  // Node-level `visible` is the authoring source of truth in v1.
  transform.visible = node.visible;
  const base: JsonRecord = {
    id: node.id,
    type: node.type,
    parentLayerId: node.parentLayerId,
    transform,
  };
  if (node.name) base.name = node.name;
  if (node.zIndex !== undefined) base.zIndex = node.zIndex;
  if (node.timing) base.timing = clone(node.timing);
  if (node.semantic) base.semantic = node.semantic;
  if (node.effects && node.effects.length > 0)
    base.effects = clone(node.effects);
  if (node.blendMode) base.blendMode = node.blendMode;
  if (node.mask) base.mask = clone(node.mask);
  if (flags.position !== undefined) base.inheritPosition = flags.position;
  if (flags.rotation !== undefined) base.inheritRotation = flags.rotation;
  if (flags.scale !== undefined) base.inheritScale = flags.scale;
  if (flags.opacity !== undefined) base.inheritOpacity = flags.opacity;

  const payload = (node.payload ?? {}) as JsonRecord;
  switch (node.type) {
    case "text":
      return {
        ...base,
        payload: {
          content: clone(payload.content),
          ...(payload.fontAssetId !== undefined
            ? { fontAssetId: payload.fontAssetId }
            : {}),
          fontSize: payload.fontSize,
          align: payload.alignment,
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
    case "svg":
      return {
        ...base,
        payload: {
          assetId: payload.assetId,
          ...(payload.fit !== undefined ? { fit: payload.fit } : {}),
          ...(payload.crop !== undefined ? { crop: clone(payload.crop) } : {}),
        },
      };
    case "video":
      return {
        ...base,
        payload: {
          assetId: payload.assetId,
          ...(payload.fit !== undefined ? { fit: payload.fit } : {}),
          ...(payload.trimStart !== undefined
            ? { trimStart: payload.trimStart }
            : {}),
          ...(payload.trimEnd !== undefined
            ? { trimEnd: payload.trimEnd }
            : {}),
          ...(payload.loop !== undefined ? { loop: payload.loop } : {}),
          ...(payload.muted !== undefined ? { muted: payload.muted } : {}),
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
          width: payload.width,
          height: payload.height,
          color: payload.color,
        },
      };
    case "group":
      return {
        ...base,
        payload: {
          ...(payload.compositing
            ? { compositing: clone(payload.compositing) }
            : {}),
        },
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
        payload: clone(node.payload),
        ...(node.style ? { style: clone(node.style) } : {}),
      };
    case "component":
      // Component layers are expanded before runtime preparation; this
      // fallback keeps a missing-component layer from producing undefined.
      return {
        ...base,
        payload: clone(node.payload),
      };
  }
}

export function prepareRuntimeClip(clip: V1SceneClip): JsonRecord {
  return clone(clip);
}

export function prepareRuntimeAudioLayer(layer: V1.AudioLayerV1): JsonRecord {
  return {
    id: layer.id,
    type: "audio",
    ...(layer.name ? { name: layer.name } : {}),
    parentLayerId: null,
    zIndex: layer.zIndex,
    timing: clone(layer.timing),
    visible: layer.visible,
    locked: layer.locked,
    payload: clone(layer.payload),
  };
}

export function prepareRuntimeAsset(asset: V1.AssetV1): JsonRecord {
  switch (asset.assetType) {
    case "image": {
      const pixelFormat = asset.pixelFormat ?? "rgba";
      return {
        id: asset.id,
        uri: asset.uri,
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
        uri: asset.uri,
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
        uri: asset.uri,
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
        uri: asset.uri,
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
        uri: asset.uri,
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
