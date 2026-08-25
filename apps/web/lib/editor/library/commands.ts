import type { V2Asset, MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";
import type { EditorCommand } from "@motionvideo/editor-core";
import type { LibraryPayload } from "@/lib/editor/library/library-payload";
import type { PlacementTarget } from "@motionvideo/editor-core/timeline";

export const DEFAULT_FONT_ASSET: V2Asset = {
  id: "font-roboto-regular",
  kind: "font",
  uri: "/fonts/Roboto-Regular.ttf",
  mimeType: "font/ttf",
  family: "Roboto",
  weight: 400,
  style: "normal",
  integrity: "sha256:15256405ecb0d880678833a582760efad538ab2932318b52c8105b267d159459",
};

function transform(
  x: number,
  y: number,
  width: number,
  height: number,
): MotionProtocolV2["layers"][number]["transform"] {
  return {
    translate: { x, y, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    rotate: { x: 0, y: 0, z: 0 },
    skew: { x: 0, y: 0 },
    anchor: { x: width / 2, y: height / 2, z: 0 },
  };
}
function uniqueId(document: MotionProtocolV2, base: string): string {
  let id = base.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "layer";
  let suffix = 1;
  while (document.layers.some((layer) => layer.id === id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  return id;
}

function rootOrder(document: MotionProtocolV2): string[] {
  return document.layers
    .filter((layer) => layer.parentLayerId === null)
    .sort((a, b) => a.order - b.order)
    .map((layer) => layer.id);
}

function insertionIndex(document: MotionProtocolV2, placement?: PlacementTarget): number {
  const ids = rootOrder(document);
  if (placement?.track === "main") return 0;
  if (placement?.insertNewLane) {
    return Math.max(0, Math.min(ids.length, (placement.insertOrder ?? ids.length)));
  }
  const target = placement?.laneId
    ? document.layers.find((layer) => layer.id === placement.laneId)?.order
    : undefined;
  return target == null ? ids.length : Math.max(0, Math.min(ids.length, target));
}

function layerForPayload(
  document: MotionProtocolV2,
  payload: LibraryPayload,
  startTime: number,
  order: number,
): MotionProtocolV2["layers"][number] | null {
  const duration = Math.max(0.5, payload.duration ?? 5);
  const width = 640;
  const height = 360;
  const id = uniqueId(document, payload.kind === "asset" ? `asset-${payload.asset.id}` : payload.id);
  const base = {
    id,
    parentLayerId: null,
    order,
    frame: { width, height },
    transform: transform((document.composition.width - width) / 2, (document.composition.height - height) / 2, width, height),
    opacity: 1,
    timing: { start: Math.max(0, startTime), duration },
  };

  if (payload.kind === "shape") {
    return {
      ...base,
      type: "shape",
      payload: { shape: payload.shape === "ellipse" ? "ellipse" : "rectangle" },
      style: { fill: "#8b8f98" },
    };
  }
  if (payload.kind === "path") {
    return {
      ...base,
      type: "path",
      payload: {
        contours: [
          {
            id: `${id}-contour`,
            start: { x: 0, y: 0 },
            segments: [
              { kind: "line", to: { x: width, y: 0 } },
              { kind: "line", to: { x: width, y: height } },
              { kind: "line", to: { x: 0, y: height } },
            ],
            closed: true,
          },
        ],
        fillRule: "nonzero",
      },
      style: { fill: "#8b8f98" },
    };
  }
  if (payload.kind === "text") {
    return {
      ...base,
      type: "text",
      frame: { width: Math.min(1440, document.composition.width - 80), height: 180 },
      transform: transform(40, (document.composition.height - 180) / 2, Math.min(1440, document.composition.width - 80), 180),
      payload: {
        text: payload.text.normalize("NFC"),
        fontAssetId: DEFAULT_FONT_ASSET.id,
        fontSize: 72,
        lineHeight: 86,
        letterSpacing: 0,
        align: "center",
        verticalAlign: "middle",
        wrap: "none",
        overflow: "visible",
        direction: "ltr",
        language: "vi",
      },
      style: { fill: "#f7e7bd" },
    };
  }
  if (payload.kind === "asset") {
    if (payload.asset.kind === "image") {
      return { ...base, type: "image", payload: { assetId: payload.asset.id, fit: "contain" } };
    }
    if (payload.asset.kind === "video") {
      return { ...base, type: "video", payload: { assetId: payload.asset.id, fit: "contain", muted: false, framePolicy: "floor" } };
    }
  }
  return null;
}

export function commandsForLibraryPayload(
  document: MotionProtocolV2,
  payload: LibraryPayload,
  placement?: PlacementTarget,
): EditorCommand[] {
  const startTime = placement?.startTime ?? 0;
  const existingAssets = new Set(document.assets.map((asset) => asset.id));
  const commands: EditorCommand[] = [];
  if (payload.kind === "text" && !existingAssets.has(DEFAULT_FONT_ASSET.id)) {
    commands.push({ type: "add-asset", asset: DEFAULT_FONT_ASSET });
  }
  if (payload.kind === "asset" && !existingAssets.has(payload.asset.id)) {
    commands.push({ type: "add-asset", asset: payload.asset });
  }

  const ids = rootOrder(document);
  if (payload.kind === "asset" && payload.asset.kind === "audio") {
    const trackId = document.audio.tracks[0]?.id ?? "audio-main";
    const clipBase = `audio-${payload.asset.id}`;
    let clipId = clipBase;
    let suffix = 1;
    while (document.audio.tracks.some((track) => track.clips.some((clip) => clip.id === clipId))) {
      clipId = `${clipBase}-${suffix}`;
      suffix += 1;
    }
    commands.push({
      type: "add-audio-clip",
      trackId,
      clip: {
        id: clipId,
        assetId: payload.asset.id,
        timing: { start: Math.max(0, startTime), duration: Math.max(0.5, payload.duration ?? 5) },
        trim: { start: 0 },
        playbackRate: 1,
        loop: false,
        gainDb: 0,
      },
    });
    return commands;
  }
  const temporaryOrder = ids.length;
  const layer = layerForPayload(document, payload, startTime, temporaryOrder);
  if (!layer) return [];
  commands.push({ type: "add-layer", layer });

  // New text/shape items are always painted above existing layers. Their
  // timeline position is still controlled by the current playhead/drop time.
  const targetIndex =
    payload.kind === "text" || payload.kind === "shape" || payload.kind === "path"
      ? ids.length
      : insertionIndex(document, placement);
  const ordered = [...ids];
  ordered.splice(Math.max(0, Math.min(ordered.length, targetIndex)), 0, layer.id);
  commands.push({ type: "reorder-layers", parentLayerId: null, orderedLayerIds: ordered });
  return commands;
}
