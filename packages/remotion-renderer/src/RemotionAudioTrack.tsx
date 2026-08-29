import { useEffect, useState } from "react";
import { Audio, continueRender, delayRender } from "remotion";
import type {
  RuntimeAudioMixPlanV3,
  RuntimeMediaSourceRefV3,
  RuntimeProjectV3,
} from "@motionvideo/motion-runtime";
import { clipProgressAtCompositionSampleV3, envelopeGainAtClipProgressV3, sourceSampleAtCompositionSampleV3 } from "@motionvideo/motion-runtime";
import { buildRemotionAudioPlan } from "./remotion-audio-plan";

const OUTPUT_SAMPLE_RATE = 48000;

type DecodedAudio = {
  buffer: AudioBuffer;
  source: RuntimeMediaSourceRefV3;
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
  if (!Constructor) throw new Error("Remotion V3 audio export requires OfflineAudioContext");
  return new Constructor(channels, length, sampleRate);
}

async function decodeSource(
  source: RuntimeMediaSourceRefV3,
  decodeContext: OfflineAudioContext,
  runtime: RuntimeProjectV3,
): Promise<AudioBuffer> {
  const stream = runtime.mediaCatalog.assets.find((asset) => asset.mediaId === source.mediaId)?.audio?.find((candidate) => candidate.streamId === source.streamId);
  if (!stream) throw new Error(`Audio stream ${source.mediaId}/${source.streamId} is missing from the media catalog`);
  const response = await fetch(stream.resource.uri);
  if (!response.ok) throw new Error(`Audio asset ${source.mediaId} returned HTTP ${response.status}`);
  let decoded: AudioBuffer;
  try {
    decoded = await decodeContext.decodeAudioData(await response.arrayBuffer());
  } catch (error) {
    if (runtime.mediaCatalog.assets.find((asset) => asset.mediaId === source.mediaId)?.video?.length) {
      throw new Error(
        `Unable to decode embedded audio from video asset ${source.mediaId}; ` +
        "an audio derivative is required for this export format",
        { cause: error },
      );
    }
    throw error;
  }
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

function scheduleInput(
  context: OfflineAudioContext,
  plan: RuntimeAudioMixPlanV3,
  input: RuntimeAudioMixPlanV3["inputs"][number],
  buffer: AudioBuffer,
): void {
  if (input.muted) return;
  for (const segment of input.segments) {
    const compositionStart = segment.compositionStartSample / plan.sampleRate;
    const compositionEnd = segment.compositionEndSample / plan.sampleRate;
    const duration = compositionEnd - compositionStart;
    if (duration <= 0) continue;

    const sourceStart = sourceSampleAtCompositionSampleV3(segment, segment.compositionStartSample);
    const sourceEnd = sourceSampleAtCompositionSampleV3(segment, segment.compositionEndSample);
    const sourceDuration = (sourceEnd - sourceStart) / input.sourceSampleRate;
    const playbackRate = sourceDuration > 0 ? sourceDuration / duration : 1;
    const startProgress = clipProgressAtCompositionSampleV3(segment, segment.compositionStartSample);
    const endProgress = clipProgressAtCompositionSampleV3(segment, segment.compositionEndSample);
    const sourceNode = context.createBufferSource();
    const gainNode = context.createGain();
    const panner = context.createStereoPanner();
    sourceNode.buffer = buffer;
    sourceNode.playbackRate.setValueAtTime(playbackRate, compositionStart);
    panner.pan.setValueAtTime(input.pan, compositionStart);
    gainNode.gain.setValueAtTime(input.gainLinear * envelopeGainAtClipProgressV3(segment.gainEnvelope, startProgress), compositionStart);
    gainNode.gain.linearRampToValueAtTime(
      input.gainLinear * envelopeGainAtClipProgressV3(segment.gainEnvelope, endProgress),
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

async function renderAudioPlanToWav(plan: RuntimeAudioMixPlanV3, runtime: RuntimeProjectV3): Promise<Blob> {
  const outputLength = Math.max(1, plan.endSample - plan.startSample);
  const decodeContext = offlineContext(2, 1, OUTPUT_SAMPLE_RATE);
  const decoded = new Map<string, DecodedAudio>();
  for (const input of plan.inputs) {
    const key = `${input.source.mediaId}:${input.source.streamId}`;
    if (input.muted || decoded.has(key)) continue;
    decoded.set(key, {
      source: input.source,
      buffer: await decodeSource(input.source, decodeContext, runtime),
    });
  }

  const context = offlineContext(2, outputLength, plan.sampleRate);
  for (const input of plan.inputs) {
    const asset = decoded.get(`${input.source.mediaId}:${input.source.streamId}`);
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
  runtime: RuntimeProjectV3;
};

/** Remotion export surface for the complete V3 runtime audio domain. */
export function RemotionAudioTrack({ runtime }: RemotionAudioTrackProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const plan = buildRemotionAudioPlan(runtime);
    setSrc(null);
    setError(null);
    if (!plan) return undefined;
    const handle = delayRender("Prepare Runtime V3 audio mix");
    let cancelled = false;
    let handleReleased = false;
    const releaseHandle = () => {
      if (handleReleased) return;
      handleReleased = true;
      continueRender(handle);
    };
    void renderAudioPlanToWav(plan, runtime)
      .then((wav) => {
        if (cancelled) return;
        return blobToDataUrl(wav).then((dataUrl) => {
          if (cancelled) return;
          setSrc(dataUrl);
          releaseHandle();
        });
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(errorMessage(reason));
        releaseHandle();
      });
    return () => {
      cancelled = true;
      releaseHandle();
    };
  }, [runtime]);

  if (error) throw new Error(`Remotion V3 audio export failed: ${error}`);
  return src ? <Audio src={src} /> : null;
}
