import type { LibraryPayload } from "@/lib/editor/library/library-payload";
import type { EditorCommand } from "@motionvideo/editor-core";
import type { PlacementTarget } from "@motionvideo/editor-core/timeline";
import type { V2Asset, MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

export const DEFAULT_FONT_ASSET: V2Asset = {
  id: "font-noto-sans-regular",
  kind: "font",
  uri: "/preview/font/Noto_Sans/NotoSans-Regular.ttf",
  weight: 400,
  integrity: "sha256:fe8c022f48d8dd29f17b744d16f9346f4357e16f7d4f7be58b000ae7c291b614",
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

/** Library placement values are timeline seconds; Protocol V2 stores milliseconds. */
const secondsToProtocolMilliseconds = (value: number): number => value * 1000;

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

function textPayload(text: string) {
  const source = text.normalize("NFC");
  return {
    source: { text: source, language: "vi" },
    chunks: [{
      id: "text-chunk",
      sourceRange: { start: 0, end: source.length },
      spans: [{
        id: "text-span",
        sourceRange: { start: 0, end: source.length },
        font: { families: ["Noto Sans"], size: 72 },
        fill: "#f7e7bd",
      }],
    }],
  };
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
    timing: {
      start: secondsToProtocolMilliseconds(Math.max(0, startTime)),
      duration: secondsToProtocolMilliseconds(duration),
    },
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
      payload: textPayload(payload.text),
    };
  }
  if (payload.kind === "asset") {
    if (payload.asset.kind === "image") {
      return { ...base, type: "image", payload: { assetId: payload.asset.id, width, height, preserveAspectRatio: { align: "xMidYMid", meetOrSlice: "meet" } } };
    }
    if (payload.asset.kind === "video") {
      // The video element is muted by the playback adapter. Embedded audio is
      // a separate compiler-generated mix input and is enabled by default.
      return { ...base, type: "video", payload: { assetId: payload.asset.id, fit: "contain", framePolicy: "floor", audio: { enabled: true, gainDb: 0, pan: 0 } } };
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
    // A library drop onto an audio lane must preserve the selected mixer
    // track. `lane.audio.<trackId>` is a timeline projection id; fall back to
    // the first track only for keyboard/stage drops or an empty audio domain.
    const projectedTrackId = placement?.track === "audio" && placement.laneId
      ? placement.laneId.replace(/^lane\.audio\./, "")
      : null;
    const trackId = projectedTrackId && document.audio.tracks.some((track) => track.id === projectedTrackId)
      ? projectedTrackId
      : document.audio.tracks[0]?.id ?? "audio-main";
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
        timing: {
          start: secondsToProtocolMilliseconds(Math.max(0, startTime)),
          duration: secondsToProtocolMilliseconds(Math.max(0.5, payload.duration ?? 5)),
        },
        trim: { start: 0 },
        playbackRate: 1,
        enabled: true,
        gainDb: 0,
        pan: 0,
        fadeIn: { duration: 0, curve: "linear" },
        fadeOut: { duration: 0, curve: "linear" },
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
