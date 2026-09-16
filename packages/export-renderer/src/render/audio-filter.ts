import {
  resolveAudioWindow,
  type RuntimeAudioMixInputV3,
  type RuntimeAudioMixPlanV3,
  type RuntimeProjectV3,
} from "@motionvideo/motion-runtime";
import { ExportRendererError } from "../errors";
import { createAudioSourceMaterializer } from "./audio-source";
import { resolveLocalPreviewAssetPath } from "./skia-assets";

export type FfmpegAudioInput = {
  path: string;
};

export type ResolvedAudioMix = {
  inputs: FfmpegAudioInput[];
  filterComplex: string;
  cleanup?: () => Promise<void>;
};

function number(value: number): string {
  return Number.isFinite(value) ? value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "") : "0";
}

function atempoChain(playbackRate: number): string[] {
  if (!Number.isFinite(playbackRate) || playbackRate <= 0 || Math.abs(playbackRate - 1) < 0.000001) return [];
  let value = playbackRate;
  const filters: string[] = [];
  while (value < 0.5) {
    filters.push("atempo=0.5");
    value /= 0.5;
  }
  while (value > 2) {
    filters.push("atempo=2");
    value /= 2;
  }
  filters.push(`atempo=${number(value)}`);
  return filters;
}

function panFilter(input: RuntimeAudioMixInputV3): string {
  const pan = Math.max(-1, Math.min(1, input.pan));
  const left = 1 - Math.max(0, pan);
  const right = 1 + Math.min(0, pan);
  return input.channels <= 1
    ? `pan=stereo|c0=${number(left)}*c0|c1=${number(right)}*c0`
    : `pan=stereo|c0=${number(left)}*c0|c1=${number(right)}*c1`;
}

function fadeFilters(input: RuntimeAudioMixInputV3, plan: RuntimeAudioMixPlanV3): string[] {
  const clip = input.segments[0];
  if (!clip) return [];
  // The resolved envelope is normalized to clip-local progress. FFmpeg's
  // linear triangle curve is the matching implementation for V2 linear fades;
  // qsin gives the expected equal-power shape for the second V2 curve.
  const filters: string[] = [];
  const localStart = Math.max(0, (clip.compositionStartSample - clip.clipTimelineStartSample) / plan.sampleRate);
  const localDuration = Math.max(0, (clip.compositionEndSample - clip.compositionStartSample) / plan.sampleRate);
  if (clip.gainEnvelope.fadeIn && localStart < clip.gainEnvelope.fadeIn.end * (clip.clipTimelineDurationSamples / plan.sampleRate)) {
    const end = clip.gainEnvelope.fadeIn.end * (clip.clipTimelineDurationSamples / plan.sampleRate);
    filters.push(`afade=t=in:st=0:d=${number(Math.min(localDuration, Math.max(0, end - localStart)))}:curve=${clip.gainEnvelope.fadeIn.curve === "equal-power" ? "qsin" : "tri"}`);
  }
  if (clip.gainEnvelope.fadeOut) {
    const fadeStart = clip.gainEnvelope.fadeOut.start * (clip.clipTimelineDurationSamples / plan.sampleRate);
    const localEnd = localStart + localDuration;
    if (localEnd > fadeStart) {
      filters.push(`afade=t=out:st=${number(Math.max(0, fadeStart - localStart))}:d=${number(Math.max(0, clip.clipTimelineDurationSamples / plan.sampleRate - fadeStart))}:curve=${clip.gainEnvelope.fadeOut.curve === "equal-power" ? "qsin" : "tri"}`);
    }
  }
  return filters;
}

function audioUri(project: RuntimeProjectV3, input: RuntimeAudioMixInputV3): string {
  const stream = project.mediaCatalog.assets
    .find((asset) => asset.mediaId === input.source.mediaId)
    ?.audio?.find((candidate) => candidate.streamId === input.source.streamId);
  if (!stream) {
    throw new ExportRendererError(`Audio stream '${input.source.streamId}' was not found.`, "ASSET_NOT_FOUND", { source: input.source });
  }
  return stream.resource.uri;
}

/** Builds a deterministic FFmpeg graph from the canonical Runtime audio plan. */
function buildFfmpegAudioMix(
  project: RuntimeProjectV3,
  plan: RuntimeAudioMixPlanV3,
  paths: string[],
): ResolvedAudioMix | null {
  if (plan.inputs.length === 0) return null;
  const inputs: FfmpegAudioInput[] = paths.map((path) => ({ path }));
  const labels: string[] = [];
  const chains: string[] = [];
  for (const [index, input] of plan.inputs.entries()) {
    const segment = input.segments[0];
    if (!segment) continue;
    const sourceStart = segment.sourceStartSample / input.sourceSampleRate;
    const sourceEnd = segment.sourceEndSample / input.sourceSampleRate;
    const delayMs = Math.max(0, Math.round((segment.compositionStartSample - plan.startSample) * 1000 / plan.sampleRate));
    const clip = project.audioTimeline.tracks
      .find((track) => track.trackId === input.trackId)
      ?.clips.find((candidate) => candidate.clipId === input.clipId);
    const filters = [
      `atrim=start=${number(sourceStart)}:end=${number(sourceEnd)}`,
      "asetpts=PTS-STARTPTS",
      ...atempoChain(clip?.playbackRate ?? 1),
      `volume=${number(input.muted ? 0 : input.gainLinear)}`,
      panFilter(input),
      ...fadeFilters(input, plan),
      `adelay=${delayMs}|${delayMs}`,
    ];
    const label = `a${index}`;
    chains.push(`[${index + 1}:a]${filters.join("," )}[${label}]`);
    labels.push(`[${label}]`);
  }
  if (labels.length === 0) return null;
  chains.push(`${labels.join("")}amix=inputs=${labels.length}:duration=longest:dropout_transition=0:normalize=0,aresample=${plan.sampleRate}[aout]`);
  return { inputs, filterComplex: chains.join(";") };
}

export function resolveFfmpegAudioMix(
  project: RuntimeProjectV3,
  plan: RuntimeAudioMixPlanV3,
  assetRoot: string,
): ResolvedAudioMix | null {
  const paths = plan.inputs.map((input) => resolveLocalPreviewAssetPath(audioUri(project, input), assetRoot));
  return buildFfmpegAudioMix(project, plan, paths);
}

export async function resolveProjectAudioMix(project: RuntimeProjectV3, frameCount: number, fps: number, assetRoot: string): Promise<ResolvedAudioMix | null> {
  const frameDurationSamples = Math.ceil((frameCount / fps) * project.audioTimeline.sampleRate);
  const plan = resolveAudioWindow(project, { startSample: 0, frameCount: frameDurationSamples });
  if (plan.inputs.length === 0) return null;
  const materializer = createAudioSourceMaterializer(assetRoot);
  try {
    const paths = await Promise.all(plan.inputs.map((input) => materializer.resolve(audioUri(project, input))));
    const resolved = buildFfmpegAudioMix(project, plan, paths);
    if (!resolved) {
      await materializer.cleanup();
      return null;
    }
    return { ...resolved, cleanup: materializer.cleanup };
  } catch (error) {
    await materializer.cleanup();
    throw error;
  }
}
