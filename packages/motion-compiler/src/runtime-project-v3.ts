import { parseMotionProtocol, type MotionProtocolV2 } from "@motionvideo/motion-protocol";
import {
  secondsToSamples,
  type RuntimeAudioClipV3,
  type RuntimeAudioTrackPlanV3,
  type RuntimeMediaCatalogV3,
  type RuntimeMediaResourceV3,
  type RuntimeProjectV2,
  type RuntimeProjectV3,
  type RuntimeVisualProjectV3,
} from "@motionvideo/motion-runtime";
import { compileProtocol, type CompileProtocolOptions } from "./compiler";

const RATE = 48000 as const;

export class CompileProtocolToRuntimeV3Error extends Error {
  constructor(
    readonly code: "MISSING_MEDIA_STREAM" | "MISSING_AUDIO_DERIVATIVE",
    message: string,
    readonly path: string,
  ) {
    super(message);
    this.name = "CompileProtocolToRuntimeV3Error";
  }
}

/**
 * Canonical Protocol compiler entrypoint for the next runtime.
 *
 * Visual lowering is performed exactly once by compileProtocol(); this
 * function only projects that normalized result into the V3 media/audio
 * timelines consumed by playback-engine-next.
 */
export function compileProtocolToRuntimeV3(
  input: unknown,
  options: CompileProtocolOptions = {},
): RuntimeProjectV3 {
  const protocol = parseMotionProtocol(input);
  const visual = compileProtocol(protocol, options);
  const mediaCatalog = buildMediaCatalog(protocol);
  const videoTimeline = {
    instances: protocol.layers
      .filter((layer) => layer.type === "video")
      .flatMap((layer) => {
        const node = visual.nodes.find((candidate) => candidate.id === layer.id);
        const asset = mediaCatalog.assets.find((candidate) => candidate.mediaId === layer.payload.assetId);
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
          source: { mediaId: layer.payload.assetId, streamId: stream.streamId },
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
    tracks: visual.audio?.tracks.map((track) => ({
      trackId: track.id,
      gainLinear: gain(track.gainDb),
      pan: track.pan,
      muted: track.muted,
      clips: track.clips.map((clip) => audioClip(clip, track.id, mediaCatalog)),
    })) ?? [],
  } satisfies { sampleRate: 48000; tracks: RuntimeAudioTrackPlanV3[] };
  const visualProject: RuntimeVisualProjectV3 = {
    composition: visual.composition,
    view: visual.view,
    nodes: visual.nodes,
  };

  return {
    format: "motion-runtime",
    runtimeVersion: 3,
    projectId: protocol.id,
    visual: visualProject,
    mediaCatalog,
    videoTimeline,
    audioTimeline,
    diagnostics: [],
  };
}

/** @deprecated Use compileProtocolToRuntimeV3. */
export const compileProtocolV2ToRuntimeV3 = compileProtocolToRuntimeV3;
/** @deprecated Use CompileProtocolToRuntimeV3Error. */
export const CompileProtocolV2ToRuntimeV3Error = CompileProtocolToRuntimeV3Error;

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

function audioClip(
  clip: NonNullable<RuntimeProjectV2["audio"]>["tracks"][number]["clips"][number],
  trackId: string,
  catalog: RuntimeMediaCatalogV3,
): RuntimeAudioClipV3 {
  const asset = catalog.assets.find((candidate) => candidate.mediaId === clip.assetId);
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
    source: { mediaId: clip.assetId, streamId: stream.streamId },
    timelineStartSample: secondsToSamples(clip.timing.start, RATE),
    timelineDurationSamples: secondsToSamples(clip.timing.duration, RATE),
    sourceStartSample: secondsToSamples(clip.trim.start, stream.sampleRate),
    ...(clip.trim.end !== undefined
      ? { sourceEndSample: secondsToSamples(clip.trim.end, stream.sampleRate) }
      : {}),
    playbackRate: clip.playbackRate,
    gainLinear: gain(clip.gainDb),
    pan: 0,
    muted: false,
    ...(clip.fadeIn
      ? { fadeIn: { durationSamples: secondsToSamples(clip.fadeIn.duration, RATE), curve: clip.fadeIn.curve } }
      : {}),
    ...(clip.fadeOut
      ? { fadeOut: { durationSamples: secondsToSamples(clip.fadeOut.duration, RATE), curve: clip.fadeOut.curve } }
      : {}),
    origin: {
      kind: asset?.video?.length ? "video" : "standalone-audio",
      authoringId: trackId.startsWith("embedded-audio:") ? trackId.slice(15) : clip.id,
    },
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
