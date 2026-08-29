import { parseMotionProtocol, type MotionProtocolV2 } from "@motionvideo/motion-protocol";
import {
  evaluateRuntimeProjectV3,
  frameIndexAtTime,
  secondsToSamples,
  type PaintCommandBuffer,
  type RuntimeAudioFadeV3,
  type RuntimeAudioTrackPlanV3,
  type RuntimeMediaCatalogV3,
  type RuntimeMediaResourceV3,
  type RuntimeProjectV3,
  type RuntimeVisualProjectV3,
  validateRuntimeProjectV3,
} from "@motionvideo/motion-runtime";
import {
  compileVisualProject,
  type CompileProtocolOptions,
} from "./compiler";

const RATE = 48000 as const;

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
  const visual = compileVisualProject(protocol, options);
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
          sourceStartUs: Math.round((layer.payload.trimStart ?? 0) * 1e6),
          ...(layer.payload.trimEnd !== undefined
            ? { sourceEndUs: Math.round(layer.payload.trimEnd * 1e6) }
            : {}),
          playbackRate: 1,
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

  const runtime: RuntimeProjectV3 = {
    format: "motion-runtime",
    runtimeVersion: 3,
    projectId: protocol.id,
    visual: visualProject,
    mediaCatalog,
    videoTimeline,
    audioTimeline,
    diagnostics: [],
  };
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

/** Compile one V3 visual frame into the backend-neutral paint contract. */
export function compileProtocolToPaintCommands(
  input: unknown,
  options: { frame?: number; time?: number } = {},
): PaintCommandBuffer {
  const runtime = compileProtocol(input);
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
            durationUs: Math.round((asset.duration ?? 0) * 1e6),
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
                    asset.audio.duration ?? asset.duration ?? 0,
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
              asset.duration ?? 0,
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
    timelineStartSample: secondsToSamples(clip.timing.start, RATE),
    timelineDurationSamples: secondsToSamples(clip.timing.duration, RATE),
    sourceStartSample: secondsToSamples(clip.trim.start, stream.sampleRate),
    ...(clip.trim.end !== undefined
      ? { sourceEndSample: secondsToSamples(clip.trim.end, stream.sampleRate) }
      : {}),
    playbackRate: clip.playbackRate,
    gainLinear: gain(clip.gainDb),
    pan: clip.pan,
    muted: !clip.enabled,
    ...(clip.fadeIn
      ? { fadeIn: { durationSamples: secondsToSamples(clip.fadeIn.duration, RATE), curve: clip.fadeIn.curve } satisfies RuntimeAudioFadeV3 }
      : {}),
    ...(clip.fadeOut
      ? { fadeOut: { durationSamples: secondsToSamples(clip.fadeOut.duration, RATE), curve: clip.fadeOut.curve } satisfies RuntimeAudioFadeV3 }
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
