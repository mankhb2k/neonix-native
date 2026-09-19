import { parseMotionProtocol, type MotionProtocolV2 } from "@motionvideo/motion-protocol";
import {
  composeLocalMatrix4,
  evaluateRuntimeProjectV3,
  deriveRuntimeProjectDurationUs,
  frameIndexAtTime,
  multiplyMatrix4,
  secondsToSamples,
  type PaintCommandBuffer,
  type RuntimeAudioFadeV3,
  type RuntimeAudioTrackPlanV3,
  type RuntimeMediaCatalogV3,
  type RuntimeMediaResourceV3,
  type RuntimeNodeV3,
  type RuntimeProjectV3,
  type RuntimeVisualProjectV3,
  type RuntimeVisualNodeDeltaV3,
  type RuntimeVisualTimelineV3,
  type RuntimeVisualCompileStatsV3,
  validateRuntimeProjectV3,
} from "@motionvideo/motion-runtime";
import {
  compileVisualProject,
  type CompileProtocolOptions,
} from "./compiler";
import { sampleMotionLayerAtTime, sampleMotionProtocolAtTime } from "./animation/sampler";

const RATE = 48000 as const;
/** Protocol V2 stores all authoring time values in milliseconds. */
const MILLISECONDS_TO_SECONDS = 1 / 1000;
const toRuntimeSeconds = (milliseconds: number): number => milliseconds * MILLISECONDS_TO_SECONDS;

function mediaIdAliases(id: string): readonly string[] {
  return id.startsWith("asset-") ? [id, id.slice("asset-".length)] : [id, `asset-${id}`];
}

function findMediaAsset(catalog: RuntimeMediaCatalogV3, id: string): RuntimeMediaCatalogV3["assets"][number] | undefined {
  const aliases = new Set(mediaIdAliases(id));
  return catalog.assets.find((asset) => aliases.has(asset.mediaId));
}

export class CompileProtocolToRuntimeV3Error extends Error {
  constructor(
    readonly code:
      | "MISSING_MEDIA_STREAM"
      | "MISSING_AUDIO_DERIVATIVE"
      | "INVALID_RUNTIME_PROJECT",
    message: string,
    readonly path: string,
  ) {
    super(message);
    this.name = "CompileProtocolToRuntimeV3Error";
  }
}

/**
 * Production callers provide the immutable catalog hydrated from probe data.
 * The protocol-derived catalog remains a deterministic fixture/dev fallback.
 */
export type CompileProtocolV3Options = CompileProtocolOptions & {
  mediaCatalog?: RuntimeMediaCatalogV3;
};

/**
 * Canonical Protocol compiler entrypoint for the next runtime.
 *
 * Visual lowering reuses the compiler-supported visual implementation. Media,
 * video and audio timelines are lowered directly from MotionProtocolV2 and
 * never pass through a RuntimeProjectV2 audio/media contract.
 */
export function compileProtocol(
  input: unknown,
  options: CompileProtocolV3Options = {},
): RuntimeProjectV3 {
  const protocol = parseMotionProtocol(input);
  return compileParsedProtocol(protocol, options, true);
}

function compileParsedProtocol(
  protocol: MotionProtocolV2,
  options: CompileProtocolV3Options,
  bakeVisualTimeline: boolean,
): RuntimeProjectV3 {
  const hasVisualAnimation = protocol.layers.some((layer) => (layer.tracks?.length ?? 0) > 0);
  const visualSource = bakeVisualTimeline && hasVisualAnimation
    ? sampleMotionProtocolAtTime(protocol, 0)
    : protocol;
  const visual = compileVisualProject(visualSource, options);
  const mediaCatalog = options.mediaCatalog ?? buildMediaCatalog(protocol);
  const videoTimeline = {
    instances: protocol.layers
      .filter((layer) => layer.type === "video")
      .flatMap((layer) => {
        const node = visual.nodes.find((candidate) => candidate.id === layer.id);
        const asset = findMediaAsset(mediaCatalog, layer.payload.assetId);
        const stream = asset?.video?.[0];
        if (!node || !stream || node.timing.duration <= 0) {
          if (node && !stream) {
            throw new CompileProtocolToRuntimeV3Error(
              "MISSING_MEDIA_STREAM",
              `Video layer ${layer.id} has no video stream`,
              `layers.${layer.id}`,
            );
          }
          return [];
        }
        return [{
          instanceId: `video:${layer.id}`,
          nodeId: layer.id,
          source: { mediaId: asset.mediaId, streamId: stream.streamId },
          timelineStartUs: Math.round(node.timing.start * 1e6),
          timelineDurationUs: Math.round(node.timing.duration * 1e6),
          sourceStartUs: Math.round(toRuntimeSeconds(layer.payload.trimStart ?? 0) * 1e6),
          ...(layer.payload.trimEnd !== undefined
            ? { sourceEndUs: Math.round(toRuntimeSeconds(layer.payload.trimEnd) * 1e6) }
            : {}),
          playbackRate: layer.payload.playbackRate ?? 1,
          framePolicy: layer.payload.framePolicy ?? "floor" as const,
        }];
      }),
  };
  const audioTimeline = {
    sampleRate: RATE,
    tracks: compileAudioTimeline(protocol, visual.nodes, mediaCatalog),
  } satisfies { sampleRate: 48000; tracks: RuntimeAudioTrackPlanV3[] };
  const visualProject: RuntimeVisualProjectV3 = {
    composition: visual.composition,
    view: visual.view,
    nodes: visual.nodes,
  };

  const compiledTimeline = bakeVisualTimeline && hasVisualAnimation
    ? compileVisualTimeline(protocol, visualProject, options)
    : undefined;
  const runtime: RuntimeProjectV3 = {
    format: "motion-runtime",
    runtimeVersion: 3,
    projectId: protocol.id,
    durationUs: 0,
    visual: visualProject,
    ...(compiledTimeline ? { visualTimeline: compiledTimeline.timeline } : {}),
    ...(compiledTimeline && options.collectStats ? { compileStats: compiledTimeline.stats } : {}),
    mediaCatalog,
    videoTimeline,
    audioTimeline,
    diagnostics: [],
  };
  runtime.durationUs = deriveRuntimeProjectDurationUs(runtime);
  const validation = validateRuntimeProjectV3(runtime);
  if (!validation.ok) {
    throw new CompileProtocolToRuntimeV3Error(
      "INVALID_RUNTIME_PROJECT",
      validation.diagnostics.map((diagnostic) => diagnostic.message).join(" | "),
      "runtime",
    );
  }
  return runtime;
}

/** Compile a deterministic visual snapshot for one timeline position. */
export function compileProtocolAtTime(
  input: unknown,
  timeSeconds: number,
  options: CompileProtocolV3Options = {},
): RuntimeProjectV3 {
  const protocol = parseMotionProtocol(input);
  return compileParsedProtocol(sampleMotionProtocolAtTime(protocol, timeSeconds), options, false);
}

function runtimeValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (left instanceof Float64Array || right instanceof Float64Array) {
    if (!(left instanceof Float64Array) || !(right instanceof Float64Array) || left.length !== right.length) return false;
    return left.every((value, index) => Object.is(value, right[index]));
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((value, index) => runtimeValuesEqual(value, right[index]));
  }
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => Object.hasOwn(rightRecord, key) && runtimeValuesEqual(leftRecord[key], rightRecord[key]));
}

function nodeDelta(base: RuntimeNodeV3, candidate: RuntimeNodeV3): RuntimeVisualNodeDeltaV3 | null {
  const delta: Record<string, unknown> = { id: candidate.id };
  const keys: Array<Exclude<keyof RuntimeNodeV3, "id">> = [
    "parentId",
    "order",
    "timing",
    "opacity",
    "blendMode",
    "isolation",
    "backfaceVisibility",
    "backdropEffects",
    "clipPath",
    "mask",
    "visible",
    "localMatrix",
    "worldMatrix",
    "content",
  ];
  for (const key of keys) {
    if (!runtimeValuesEqual(base[key], candidate[key])) {
      delta[key] = candidate[key];
    }
  }
  return Object.keys(delta).length > 1 ? delta as RuntimeVisualNodeDeltaV3 : null;
}

/**
 * Bake Protocol animation into discrete Runtime V3 frame deltas.
 *
 * Export is frame-based, so baking at the composition FPS is lossless for the
 * rendered result and keeps Protocol authoring semantics out of the worker.
 */
function compileVisualTimeline(
  protocol: MotionProtocolV2,
  base: RuntimeVisualProjectV3,
  options: CompileProtocolV3Options,
): { timeline: RuntimeVisualTimelineV3; stats: RuntimeVisualCompileStatsV3 } {
  const duration = base.composition.duration ?? 1;
  const frameCount = Math.max(1, Math.ceil(duration * base.composition.fps));
  const baseNodes = new Map(base.nodes.map((node) => [node.id, node]));
  const frames: RuntimeVisualTimelineV3["frames"] = [{ nodes: [] }];
  const animatedLayers = protocol.layers.filter((layer) => (layer.tracks?.length ?? 0) > 0);
  const animatedLayerIds = new Set(animatedLayers.map((layer) => layer.id));
  const opacityOnly = animatedLayers.every((layer) => layer.tracks?.every((track) => track.path === "opacity") ?? false);
  const simpleTransformAnimation = isSimpleTransformAnimation(protocol, animatedLayers);
  const staticVisual = opacityOnly || simpleTransformAnimation
    ? new Map(
        compileVisualProject(
          {
            ...protocol,
            layers: protocol.layers.map((layer) => layer.tracks?.length ? { ...layer, tracks: undefined } : layer),
          },
          options,
        ).nodes.map((node) => [node.id, node]),
      )
    : undefined;
  let totalDeltaNodeCount = 0;
  let totalDeltaPayloadBytes = 0;
  let optimizedFrameCount = 0;
  let fallbackFrameCount = 0;

  for (let frame = 1; frame < frameCount; frame += 1) {
    const time = frame / base.composition.fps;
    let nodes: RuntimeVisualNodeDeltaV3[];
    if (simpleTransformAnimation) {
      optimizedFrameCount += 1;
      nodes = compileSimpleTransformFrame(
        protocol,
        animatedLayerIds,
        staticVisual!,
        base,
        time,
      );
    } else if (opacityOnly) {
      optimizedFrameCount += 1;
      nodes = animatedLayers.flatMap((layer) => {
        const baseNode = baseNodes.get(layer.id);
        if (!baseNode) return [];
        const sampledLayer = sampleMotionLayerAtTime(layer, time);
        const staticNode = staticVisual?.get(layer.id);
        const visible = staticNode ? staticNode.visible && sampledLayer.opacity > 0 : baseNode.visible;
        if (sampledLayer.opacity === baseNode.opacity && visible === baseNode.visible) return [];
        return [{
          id: layer.id,
          opacity: sampledLayer.opacity,
          ...(visible === baseNode.visible ? {} : { visible }),
        }];
      });
    } else {
      fallbackFrameCount += 1;
      const sampled = sampleMotionProtocolAtTime(protocol, time);
      const visual = compileVisualProject(sampled, options);
      nodes = visual.nodes.flatMap((node) => {
        const baseNode = baseNodes.get(node.id);
        if (!baseNode) return [];
        const delta = nodeDelta(baseNode, node);
        return delta ? [delta] : [];
      });
    }
    frames.push({ nodes });
    totalDeltaNodeCount += nodes.length;
    totalDeltaPayloadBytes += nodes.reduce((total, node) => total + estimateRuntimeValueBytes(node), 0);
  }

  const divisor = Math.max(1, frames.length);
  return {
    timeline: { frames },
    stats: {
      staticNodeCount: Math.max(0, base.nodes.length - animatedLayerIds.size),
      animatedNodeCount: animatedLayerIds.size,
      frameCount: frames.length,
      totalDeltaNodeCount,
      averageDeltaNodesPerFrame: totalDeltaNodeCount / divisor,
      totalDeltaPayloadBytes,
      averageDeltaPayloadBytesPerFrame: totalDeltaPayloadBytes / divisor,
      optimizedFrameCount,
      fallbackFrameCount,
    },
  };
}

const SIMPLE_TRANSFORM_PATH = /^transform\.(translate|scale|rotate|skew)\.(x|y|z)$/;

function isSimpleTransformAnimation(
  protocol: MotionProtocolV2,
  animatedLayers: MotionProtocolV2["layers"],
): boolean {
  if (animatedLayers.length === 0) return false;
  if ((protocol.clipPaths?.length ?? 0) > 0 || (protocol.masks?.length ?? 0) > 0) return false;
  return protocol.layers.every((layer) => !layer.motion && (layer.type !== "group" || !layer.render3d)) && animatedLayers.every((layer) =>
    layer.type === "group" &&
    layer.tracks?.every((track) => track.path === "opacity" || SIMPLE_TRANSFORM_PATH.test(track.path)) === true,
  );
}

function compileSimpleTransformFrame(
  protocol: MotionProtocolV2,
  animatedLayerIds: ReadonlySet<string>,
  staticNodes: ReadonlyMap<string, RuntimeNodeV3>,
  base: RuntimeVisualProjectV3,
  time: number,
): RuntimeVisualNodeDeltaV3[] {
  const layerById = new Map(protocol.layers.map((layer) => [layer.id, layer]));
  const sampledById = new Map(protocol.layers.map((layer) => [
    layer.id,
    animatedLayerIds.has(layer.id) ? sampleMotionLayerAtTime(layer, time) : layer,
  ]));
  const baseById = new Map(base.nodes.map((node) => [node.id, node]));
  const candidates = new Map<string, RuntimeNodeV3>();
  const visiting = new Set<string>();

  const visit = (node: RuntimeNodeV3): RuntimeNodeV3 => {
    const cached = candidates.get(node.id);
    if (cached) return cached;
    if (visiting.has(node.id)) return node;
    visiting.add(node.id);
    const parentNode = node.parentId ? staticNodes.get(node.parentId) : undefined;
    const parent = parentNode ? visit(parentNode) : undefined;
    const layer = layerById.get(node.id);
    const sampledLayer = layer ? sampledById.get(node.id) : undefined;
    const localMatrix = sampledLayer && animatedLayerIds.has(node.id)
      ? composeLocalMatrix4(sampledLayer.transform)
      : node.localMatrix;
    const worldMatrix = parent
      ? multiplyMatrix4(parent.worldMatrix, localMatrix)
      : localMatrix;
    const parentVisible = parent?.visible ?? true;
    const visible = layer
      ? parentVisible &&
        layer.enabled !== false &&
        (layer.visibility ?? "visible") === "visible" &&
        (sampledLayer?.opacity ?? layer.opacity) > 0 &&
        node.timing.duration > 0
      : node.visible && parentVisible;
    const candidate = {
      ...node,
      ...(sampledLayer && animatedLayerIds.has(node.id) ? { opacity: sampledLayer.opacity } : {}),
      localMatrix,
      worldMatrix,
      visible,
    };
    candidates.set(node.id, candidate);
    visiting.delete(node.id);
    return candidate;
  };

  for (const node of staticNodes.values()) visit(node);
  return Array.from(candidates.values()).flatMap((candidate) => {
    const baseNode = baseById.get(candidate.id);
    if (!baseNode) return [];
    const delta = nodeDelta(baseNode, candidate);
    return delta ? [delta] : [];
  });
}

function estimateRuntimeValueBytes(value: unknown): number {
  if (value === null || value === undefined) return 1;
  if (typeof value === "boolean") return 4;
  if (typeof value === "number") return 8;
  if (typeof value === "string") return value.length * 2 + 2;
  if (value instanceof Float64Array) return value.length * 8;
  if (Array.isArray(value)) return 2 + value.reduce((total, item) => total + estimateRuntimeValueBytes(item), 0);
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .reduce((total, [key, item]) => total + key.length * 2 + 2 + estimateRuntimeValueBytes(item), 2);
  }
  return 0;
}

/** Compile one V3 visual frame into the backend-neutral paint contract. */
export function compileProtocolToPaintCommands(
  input: unknown,
  options: { frame?: number; time?: number } = {},
): PaintCommandBuffer {
  const runtime = options.time == null
    ? compileProtocol(input)
    : compileProtocolAtTime(input, options.time);
  const frame = options.frame ??
    (options.time == null
      ? 0
      : frameIndexAtTime(options.time, runtime.visual.composition.fps));
  return evaluateRuntimeProjectV3(runtime, frame, {
    ...(options.time != null ? { time: options.time } : {}),
  });
}

function buildMediaCatalog(protocol: MotionProtocolV2): RuntimeMediaCatalogV3 {
  return {
    assets: protocol.assets.map((asset) => {
      if (asset.kind === "video") {
        return {
          mediaId: asset.id,
          video: [{
            streamId: `${asset.id}:video`,
            resource: resource(`${asset.id}:video:original`, "original", asset.uri, asset.mimeType, asset.integrity),
            durationUs: Math.round(toRuntimeSeconds(asset.duration ?? 0) * 1e6),
            width: asset.width ?? 1,
            height: asset.height ?? 1,
            frameRate: asset.fps ?? protocol.composition.fps,
          }],
          ...(asset.audio
            ? {
                audio: [{
                  streamId: `${asset.id}:audio`,
                  resource: resource(`${asset.id}:audio:proxy`, "audio-proxy", asset.audio.uri, asset.audio.mimeType, asset.audio.integrity),
                  durationSamples: secondsToSamples(
                    toRuntimeSeconds(asset.audio.duration ?? asset.duration ?? 0),
                    asset.audio.sampleRate ?? RATE,
                  ),
                  sampleRate: asset.audio.sampleRate ?? RATE,
                  channels: asset.audio.channels ?? 2,
                }],
              }
            : {}),
        };
      }
      if (asset.kind === "audio") {
        return {
          mediaId: asset.id,
          audio: [{
            streamId: `${asset.id}:audio`,
            resource: resource(`${asset.id}:audio:original`, "original", asset.uri, asset.mimeType, asset.integrity),
            durationSamples: secondsToSamples(
              toRuntimeSeconds(asset.duration ?? 0),
              asset.sampleRate ?? RATE,
            ),
            sampleRate: asset.sampleRate ?? RATE,
            channels: asset.channels ?? 2,
          }],
        };
      }
      return { mediaId: asset.id };
    }),
  };
}

type AudioClipIntentV3 = MotionProtocolV2["audio"]["tracks"][number]["clips"][number];

function compileAudioTimeline(
  protocol: MotionProtocolV2,
  visualNodes: RuntimeVisualProjectV3["nodes"],
  catalog: RuntimeMediaCatalogV3,
): RuntimeAudioTrackPlanV3[] {
  const independentTracks = protocol.audio.tracks.map((track) => ({
    trackId: track.id,
    gainLinear: gain(track.gainDb),
    pan: track.pan,
    muted: track.muted,
    clips: track.clips.map((clip) => audioClip(
      clip,
      track.id,
      catalog,
      { kind: "standalone-audio", authoringId: clip.id },
    )),
  }));

  const embeddedTracks = protocol.layers.flatMap((layer) => {
    if (layer.type !== "video" || !layer.payload.audio) return [];
    const node = visualNodes.find((candidate) => candidate.id === layer.id);
    if (!node || node.timing.duration <= 0) return [];
    // Video metadata can be available before probe/derivative generation has
    // discovered an audio stream. Embedded audio is optional; never let that
    // readiness gap prevent the visual video instance from rendering.
    const sourceAsset = findMediaAsset(catalog, layer.payload.assetId);
    if (!sourceAsset?.audio?.length) return [];
    const audio = layer.payload.audio;
    const clip: AudioClipIntentV3 = {
      id: `embedded-audio:${layer.id}:clip`,
      assetId: layer.payload.assetId,
      timing: { ...node.timing },
      trim: {
        start: layer.payload.trimStart ?? 0,
        ...(layer.payload.trimEnd === undefined ? {} : { end: layer.payload.trimEnd }),
      },
      playbackRate: 1,
      enabled: audio.enabled,
      gainDb: audio.gainDb,
      pan: audio.pan,
      ...(audio.fadeIn ? { fadeIn: audio.fadeIn } : {}),
      ...(audio.fadeOut ? { fadeOut: audio.fadeOut } : {}),
    };
    return [{
      trackId: `embedded-audio:${layer.id}`,
      gainLinear: 1,
      pan: 0,
      muted: false,
      clips: [audioClip(
        clip,
        `embedded-audio:${layer.id}`,
        catalog,
        { kind: "video", authoringId: layer.id },
        "runtime-seconds",
      )],
    }];
  });

  return [...independentTracks, ...embeddedTracks];
}

function audioClip(
  clip: AudioClipIntentV3,
  trackId: string,
  catalog: RuntimeMediaCatalogV3,
  origin: { kind: "video" | "standalone-audio"; authoringId: string },
  timingUnit: "protocol-milliseconds" | "runtime-seconds" = "protocol-milliseconds",
) {
  const asset = findMediaAsset(catalog, clip.assetId);
  const stream = asset?.audio?.[0];
  if (!stream) {
    throw new CompileProtocolToRuntimeV3Error(
      "MISSING_AUDIO_DERIVATIVE",
      `Audio clip ${clip.id} has no audio stream for asset ${clip.assetId}`,
      `audio.tracks.${trackId}.clips.${clip.id}`,
    );
  }
  return {
    clipId: clip.id,
    trackId,
    source: { mediaId: asset.mediaId, streamId: stream.streamId },
    timelineStartSample: secondsToSamples(
      timingUnit === "protocol-milliseconds" ? toRuntimeSeconds(clip.timing.start) : clip.timing.start,
      RATE,
    ),
    timelineDurationSamples: secondsToSamples(
      timingUnit === "protocol-milliseconds" ? toRuntimeSeconds(clip.timing.duration) : clip.timing.duration,
      RATE,
    ),
    sourceStartSample: secondsToSamples(toRuntimeSeconds(clip.trim.start), stream.sampleRate),
    ...(clip.trim.end !== undefined
      ? { sourceEndSample: secondsToSamples(toRuntimeSeconds(clip.trim.end), stream.sampleRate) }
      : {}),
    playbackRate: clip.playbackRate,
    gainLinear: gain(clip.gainDb),
    pan: clip.pan,
    muted: !clip.enabled,
    ...(clip.fadeIn
      ? { fadeIn: { durationSamples: secondsToSamples(toRuntimeSeconds(clip.fadeIn.duration), RATE), curve: clip.fadeIn.curve } satisfies RuntimeAudioFadeV3 }
      : {}),
    ...(clip.fadeOut
      ? { fadeOut: { durationSamples: secondsToSamples(toRuntimeSeconds(clip.fadeOut.duration), RATE), curve: clip.fadeOut.curve } satisfies RuntimeAudioFadeV3 }
      : {}),
    origin,
  };
}

function resource(
  resourceId: string,
  role: RuntimeMediaResourceV3["role"],
  uri: string,
  mimeType?: string,
  integrity?: string,
): RuntimeMediaResourceV3 {
  return {
    resourceId,
    role,
    uri,
    ...(mimeType ? { mimeType } : {}),
    ...(integrity ? { integrity } : {}),
  };
}

const gain = (db: number): number => Math.pow(10, db / 20);
