import { useEffect, useState } from "react";
import { Audio, continueRender, delayRender } from "remotion";
import type {
  RuntimeAudioMixPlanV2,
  RuntimeAudioMixSegmentV2,
  RuntimeAudioSourceV2,
  RuntimeProjectV2,
} from "@motionvideo/motion-runtime";
import { buildRemotionAudioPlanV2 } from "./remotion-audio-plan";

const OUTPUT_SAMPLE_RATE = 48000;

type DecodedAudio = {
  buffer: AudioBuffer;
  source: RuntimeAudioSourceV2;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function offlineContext(
  channels: number,
  length: number,
  sampleRate: number,
): OfflineAudioContext {
  const scope = globalThis as typeof globalThis & {
    webkitOfflineAudioContext?: typeof OfflineAudioContext;
  };
  const Constructor = scope.OfflineAudioContext ?? scope.webkitOfflineAudioContext;
  if (!Constructor) throw new Error("Remotion V2 audio export requires OfflineAudioContext");
  return new Constructor(channels, length, sampleRate);
}

async function decodeSource(
  source: RuntimeAudioSourceV2,
  decodeContext: OfflineAudioContext,
): Promise<AudioBuffer> {
  const response = await fetch(source.uri);
  if (!response.ok) throw new Error(`Audio asset ${source.assetId} returned HTTP ${response.status}`);
  const decoded = await decodeContext.decodeAudioData(await response.arrayBuffer());
  if (decoded.sampleRate === OUTPUT_SAMPLE_RATE) return decoded;

  const resampleContext = offlineContext(
    decoded.numberOfChannels,
    Math.ceil(decoded.duration * OUTPUT_SAMPLE_RATE),
    OUTPUT_SAMPLE_RATE,
  );
  const sourceNode = resampleContext.createBufferSource();
  sourceNode.buffer = decoded;
  sourceNode.connect(resampleContext.destination);
  sourceNode.start(0);
  return resampleContext.startRendering();
}

function curveValue(progress: number, curve: "linear" | "equal-power"): number {
  const clamped = Math.min(1, Math.max(0, progress));
  return curve === "equal-power" ? Math.sin(clamped * Math.PI / 2) : clamped;
}

function gainAt(
  segment: RuntimeAudioMixSegmentV2,
  progress: number,
): number {
  let multiplier = 1;
  const fadeIn = segment.gainEnvelope.fadeIn;
  const fadeOut = segment.gainEnvelope.fadeOut;
  if (fadeIn) {
    multiplier *= curveValue(
      fadeIn.start + (fadeIn.end - fadeIn.start) * progress,
      fadeIn.curve,
    );
  }
  if (fadeOut) {
    multiplier *= 1 - curveValue(
      fadeOut.start + (fadeOut.end - fadeOut.start) * progress,
      fadeOut.curve,
    );
  }
  return segment.gainEnvelope.baseGain * multiplier;
}

function sourceSampleAt(segment: RuntimeAudioMixSegmentV2, sample: number): number {
  const compositionSpan = segment.compositionEndSample - segment.compositionStartSample;
  if (compositionSpan <= 0) return segment.sourceStartSample;
  return segment.sourceStartSample +
    ((sample - segment.compositionStartSample) / compositionSpan) *
    (segment.sourceEndSample - segment.sourceStartSample);
}

function scheduleInput(
  context: OfflineAudioContext,
  plan: RuntimeAudioMixPlanV2,
  input: RuntimeAudioMixPlanV2["inputs"][number],
  buffer: AudioBuffer,
): void {
  if (input.muted) return;
  for (const segment of input.segments) {
    const compositionStart = segment.compositionStartSample / plan.sampleRate;
    const compositionEnd = segment.compositionEndSample / plan.sampleRate;
    const duration = compositionEnd - compositionStart;
    if (duration <= 0) continue;

    const sourceStart = sourceSampleAt(segment, segment.compositionStartSample);
    const sourceEnd = sourceSampleAt(segment, segment.compositionEndSample);
    const sourceDuration = (sourceEnd - sourceStart) / input.sourceSampleRate;
    const playbackRate = sourceDuration > 0 ? sourceDuration / duration : 1;
    const startProgress = 0;
    const endProgress = 1;
    const sourceNode = context.createBufferSource();
    const gainNode = context.createGain();
    const panner = context.createStereoPanner();
    sourceNode.buffer = buffer;
    sourceNode.playbackRate.setValueAtTime(playbackRate, compositionStart);
    panner.pan.setValueAtTime(input.pan, compositionStart);
    gainNode.gain.setValueAtTime(gainAt(segment, startProgress), compositionStart);
    gainNode.gain.linearRampToValueAtTime(
      gainAt(segment, endProgress),
      compositionEnd,
    );
    sourceNode.connect(gainNode);
    gainNode.connect(panner);
    panner.connect(context.destination);
    sourceNode.start(
      compositionStart,
      Math.max(0, sourceStart / input.sourceSampleRate),
      duration,
    );
  }
}

async function renderAudioPlanToWav(plan: RuntimeAudioMixPlanV2): Promise<Blob> {
  const outputLength = Math.max(1, plan.endSample - plan.startSample);
  const decodeContext = offlineContext(2, 1, OUTPUT_SAMPLE_RATE);
  const decoded = new Map<string, DecodedAudio>();
  for (const input of plan.inputs) {
    if (input.muted || decoded.has(input.assetId)) continue;
    decoded.set(input.assetId, {
      source: input.source,
      buffer: await decodeSource(input.source, decodeContext),
    });
  }

  const context = offlineContext(2, outputLength, plan.sampleRate);
  for (const input of plan.inputs) {
    const asset = decoded.get(input.assetId);
    if (asset) scheduleInput(context, plan, input, asset.buffer);
  }
  return audioBufferToWav(await context.startRendering());
}

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const channels = Math.min(2, buffer.numberOfChannels);
  const frames = buffer.length;
  const bytesPerSample = 2;
  const dataLength = frames * channels * bytesPerSample;
  const output = new ArrayBuffer(44 + dataLength);
  const view = new DataView(output);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataLength, true);

  const channelData = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel));
  let offset = 44;
  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = Math.min(1, Math.max(-1, channelData[channel]![frame] ?? 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([output], { type: "audio/wav" });
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return `data:${blob.type || "audio/wav"};base64,${btoa(binary)}`;
}

export type RemotionAudioTrackProps = {
  runtime: RuntimeProjectV2;
};

/** Remotion export surface for the complete V2 runtime audio domain. */
export function RemotionAudioTrack({ runtime }: RemotionAudioTrackProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const plan = buildRemotionAudioPlanV2(runtime);
    if (!plan) return undefined;
    const handle = delayRender("Prepare Runtime V2 audio mix");
    let cancelled = false;
    void renderAudioPlanToWav(plan)
      .then((wav) => {
        if (cancelled) return;
        return blobToDataUrl(wav).then((dataUrl) => {
          if (cancelled) return;
          setSrc(dataUrl);
          continueRender(handle);
        });
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(errorMessage(reason));
        continueRender(handle);
      });
    return () => {
      cancelled = true;
    };
  }, [runtime]);

  if (error) throw new Error(`Remotion V2 audio export failed: ${error}`);
  return src ? <Audio src={src} /> : null;
}
