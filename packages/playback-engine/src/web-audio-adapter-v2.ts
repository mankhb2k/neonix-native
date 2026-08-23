import type {
  RuntimeAudioMixInputV2,
  RuntimeAudioMixPlanV2,
  RuntimeAudioMixSegmentV2,
  RuntimeAudioSourceV2,
} from "@motionvideo/motion-runtime";
import type { PlaybackAudioPlanContextV2 } from "./playback-engine-v2";

export type WebAudioDiagnosticCodeV2 =
  | "audio-context-unavailable"
  | "audio-autoplay-blocked"
  | "audio-context-closed"
  | "audio-source-unavailable"
  | "audio-decode-failed"
  | "audio-resample-unavailable"
  | "audio-plan-invalid";

export type WebAudioDiagnosticV2 = {
  code: WebAudioDiagnosticCodeV2;
  message: string;
  assetId?: string;
  uri?: string;
};

export type WebAudioParamV2 = {
  value: number;
  cancelScheduledValues(time: number): void;
  setValueAtTime(value: number, time: number): void;
  linearRampToValueAtTime(value: number, time: number): void;
};

export type WebAudioBufferV2 = {
  duration: number;
  sampleRate: number;
  numberOfChannels: number;
  length: number;
};

export type WebAudioNodeV2 = {
  connect(destination: unknown): unknown;
  disconnect?(): void;
};

export type WebAudioBufferSourceV2 = WebAudioNodeV2 & {
  buffer: WebAudioBufferV2 | null;
  playbackRate: WebAudioParamV2;
  start(when: number, offset?: number, duration?: number): void;
  stop?(when?: number): void;
  onended: (() => void) | null;
};

export type WebAudioGainNodeV2 = WebAudioNodeV2 & {
  gain: WebAudioParamV2;
};

export type WebAudioPannerNodeV2 = WebAudioNodeV2 & {
  pan: WebAudioParamV2;
};

export type WebAudioContextV2 = {
  currentTime: number;
  sampleRate: number;
  state: "suspended" | "running" | "closed" | "interrupted";
  destination: unknown;
  createBufferSource(): WebAudioBufferSourceV2;
  createGain(): WebAudioGainNodeV2;
  createStereoPanner(): WebAudioPannerNodeV2;
  decodeAudioData(data: ArrayBuffer): Promise<WebAudioBufferV2>;
  resume(): Promise<void>;
};

export type WebAudioOfflineContextV2 = WebAudioContextV2 & {
  startRendering(): Promise<WebAudioBufferV2>;
};

export type WebAudioAdapterV2Options = {
  audioContext?: WebAudioContextV2;
  fetchSource?: (uri: string) => Promise<ArrayBuffer>;
  decodeAudioData?: (
    data: ArrayBuffer,
    context: WebAudioContextV2,
  ) => Promise<WebAudioBufferV2>;
  resampleAudioBuffer?: (
    buffer: WebAudioBufferV2,
    targetSampleRate: number,
  ) => Promise<WebAudioBufferV2>;
  scheduleLeadSeconds?: number;
  onDiagnostic?: (diagnostic: WebAudioDiagnosticV2) => void;
};

export type WebAudioAdapterV2 = {
  consumeAudioMixPlan(
    plan: RuntimeAudioMixPlanV2,
    context: PlaybackAudioPlanContextV2,
  ): void;
  resume(): Promise<boolean>;
  pause(): void;
  seek(time: number): void;
  dispose(): void;
  readonly state: "ready" | "suspended" | "unavailable" | "disposed";
  readonly diagnostics: readonly WebAudioDiagnosticV2[];
};

const OUTPUT_SAMPLE_RATE = 48000;

type ScheduledSource = {
  source: WebAudioBufferSourceV2;
  gain: WebAudioGainNodeV2;
  panner: WebAudioPannerNodeV2;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function defaultFetchSource(uri: string): Promise<ArrayBuffer> {
  return fetch(uri).then(async (response) => {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.arrayBuffer();
  });
}

function createBrowserAudioContext(): WebAudioContextV2 {
  const scope = globalThis as typeof globalThis & {
    AudioContext?: new (options?: { sampleRate?: number }) => WebAudioContextV2;
    webkitAudioContext?: new (options?: { sampleRate?: number }) => WebAudioContextV2;
  };
  const Constructor = scope.AudioContext ?? scope.webkitAudioContext;
  if (!Constructor) throw new Error("Web Audio API is unavailable");
  return new Constructor({ sampleRate: OUTPUT_SAMPLE_RATE }) as unknown as WebAudioContextV2;
}

function createBrowserOfflineContext(
  channels: number,
  length: number,
  sampleRate: number,
): WebAudioOfflineContextV2 {
  const scope = globalThis as typeof globalThis & {
    OfflineAudioContext?: new (
      channels: number,
      length: number,
      sampleRate: number,
    ) => WebAudioOfflineContextV2;
    webkitOfflineAudioContext?: new (
      channels: number,
      length: number,
      sampleRate: number,
    ) => WebAudioOfflineContextV2;
  };
  const Constructor = scope.OfflineAudioContext ?? scope.webkitOfflineAudioContext;
  if (!Constructor) throw new Error("OfflineAudioContext is unavailable for resampling");
  return new Constructor(channels, length, sampleRate) as unknown as WebAudioOfflineContextV2;
}

async function defaultResampleAudioBuffer(
  buffer: WebAudioBufferV2,
  targetSampleRate: number,
): Promise<WebAudioBufferV2> {
  if (buffer.sampleRate === targetSampleRate) return buffer;
  const offline = createBrowserOfflineContext(
    buffer.numberOfChannels,
    Math.ceil(buffer.duration * targetSampleRate),
    targetSampleRate,
  );
  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start(0);
  return offline.startRendering();
}

function curveValue(progress: number, curve: "linear" | "equal-power"): number {
  const clamped = Math.min(1, Math.max(0, progress));
  return curve === "equal-power" ? Math.sin(clamped * Math.PI / 2) : clamped;
}

function fadeMultiplier(
  segment: RuntimeAudioMixSegmentV2,
  progress: number,
): number {
  let multiplier = 1;
  const fadeIn = segment.gainEnvelope.fadeIn;
  const fadeOut = segment.gainEnvelope.fadeOut;
  if (fadeIn) {
    const fadeProgress = fadeIn.start + (fadeIn.end - fadeIn.start) * progress;
    multiplier *= curveValue(fadeProgress, fadeIn.curve);
  }
  if (fadeOut) {
    const fadeProgress = fadeOut.start + (fadeOut.end - fadeOut.start) * progress;
    multiplier *= 1 - curveValue(fadeProgress, fadeOut.curve);
  }
  return multiplier;
}

function gainAt(
  segment: RuntimeAudioMixSegmentV2,
  progress: number,
): number {
  return segment.gainEnvelope.baseGain * fadeMultiplier(segment, progress);
}

function assetCacheKey(source: RuntimeAudioSourceV2): string {
  return [source.assetId, source.uri, source.integrity ?? "", OUTPUT_SAMPLE_RATE].join("|");
}

function sourceRangeAt(
  segment: RuntimeAudioMixSegmentV2,
  sample: number,
): number {
  const compositionSpan = segment.compositionEndSample - segment.compositionStartSample;
  const sourceSpan = segment.sourceEndSample - segment.sourceStartSample;
  if (compositionSpan <= 0) return segment.sourceStartSample;
  return segment.sourceStartSample +
    ((sample - segment.compositionStartSample) / compositionSpan) * sourceSpan;
}

/**
 * Browser-only V2 audio adapter. It consumes backend-neutral mix plans and
 * creates short-lived WebAudio nodes; it never evaluates protocol semantics.
 */
export function createWebAudioAdapterV2(
  options: WebAudioAdapterV2Options = {},
): WebAudioAdapterV2 {
  const diagnostics: WebAudioDiagnosticV2[] = [];
  const cache = new Map<string, Promise<WebAudioBufferV2>>();
  const activeSources = new Set<ScheduledSource>();
  const scheduledThroughByClip = new Map<string, number>();
  const fetchSource = options.fetchSource ?? defaultFetchSource;
  const decodeAudioData = options.decodeAudioData ?? ((data, context) => context.decodeAudioData(data));
  const resampleAudioBuffer = options.resampleAudioBuffer ?? defaultResampleAudioBuffer;
  const scheduleLeadSeconds = options.scheduleLeadSeconds ?? 0.01;
  let context: WebAudioContextV2 | null = options.audioContext ?? null;
  let anchorContextTime: number | null = null;
  let generation = 0;
  let disposed = false;
  let state: WebAudioAdapterV2["state"] = "suspended";

  const report = (
    code: WebAudioDiagnosticCodeV2,
    message: string,
    source?: RuntimeAudioSourceV2,
  ): void => {
    const diagnostic: WebAudioDiagnosticV2 = {
      code,
      message,
      ...(source ? { assetId: source.assetId, uri: source.uri } : {}),
    };
    diagnostics.push(diagnostic);
    options.onDiagnostic?.(diagnostic);
  };

  if (!context) {
    try {
      context = createBrowserAudioContext();
    } catch (error) {
      state = "unavailable";
      report("audio-context-unavailable", errorMessage(error));
    }
  } else if (context.state === "closed") {
    state = "unavailable";
    report("audio-context-closed", "The supplied AudioContext is already closed");
  } else if (context.state === "running") {
    state = "ready";
  }

  const stopAllSources = (): void => {
    for (const scheduled of activeSources) {
      try {
        scheduled.source.stop?.();
      } catch {
        // A source may already have ended; cleanup remains best-effort.
      }
      scheduled.source.disconnect?.();
      scheduled.gain.disconnect?.();
      scheduled.panner.disconnect?.();
    }
    activeSources.clear();
  };

  const resetTransport = (time: number | null): void => {
    generation += 1;
    stopAllSources();
    scheduledThroughByClip.clear();
    anchorContextTime = context && time !== null ? context.currentTime - time : null;
  };

  const loadBuffer = (source: RuntimeAudioSourceV2): Promise<WebAudioBufferV2> => {
    if (!context) return Promise.reject(new Error("Web Audio context unavailable"));
    const key = assetCacheKey(source);
    const cached = cache.get(key);
    if (cached) return cached;
    const promise = fetchSource(source.uri)
      .then(
        (data) => decodeAudioData(data, context!).catch((error) => {
          report("audio-decode-failed", errorMessage(error), source);
          throw error;
        }),
        (error) => {
          report("audio-source-unavailable", errorMessage(error), source);
          throw error;
        },
      )
      .then((decoded) => {
        if (decoded.sampleRate === OUTPUT_SAMPLE_RATE) return decoded;
        return resampleAudioBuffer(decoded, OUTPUT_SAMPLE_RATE).catch((error) => {
          report("audio-resample-unavailable", errorMessage(error), source);
          throw error;
        });
      });
    cache.set(key, promise);
    return promise;
  };

  const scheduleSegment = (
    input: RuntimeAudioMixInputV2,
    segment: RuntimeAudioMixSegmentV2,
    buffer: WebAudioBufferV2,
    plan: RuntimeAudioMixPlanV2,
    contextInfo: PlaybackAudioPlanContextV2,
    generationAtRequest: number,
  ): void => {
    if (!context || disposed || generationAtRequest !== generation) return;
    if (context.state === "closed") {
      state = "unavailable";
      report("audio-context-closed", "AudioContext closed while scheduling", input.source);
      return;
    }
    if (buffer.duration <= 0 || segment.compositionEndSample <= segment.compositionStartSample) return;

    if (anchorContextTime === null) {
      anchorContextTime = context.currentTime - contextInfo.time;
    }
    const currentSample = Math.floor(
      Math.max(0, context.currentTime - anchorContextTime) * plan.sampleRate,
    );
    const previousSample = scheduledThroughByClip.get(input.clipId) ?? plan.startSample;
    const startSample = Math.max(
      segment.compositionStartSample,
      previousSample,
      currentSample,
    );
    const endSample = segment.compositionEndSample;
    if (startSample >= endSample) return;

    const sourceStart = sourceRangeAt(segment, startSample);
    const sourceEnd = sourceRangeAt(segment, endSample);
    const compositionDuration = (endSample - startSample) / plan.sampleRate;
    const sourceDuration = (sourceEnd - sourceStart) / input.sourceSampleRate;
    const playbackRate = sourceDuration > 0 && compositionDuration > 0
      ? sourceDuration / compositionDuration
      : 1;
    const when = Math.max(
      context.currentTime + scheduleLeadSeconds,
      anchorContextTime + startSample / plan.sampleRate,
    );
    const offset = Math.min(
      buffer.duration,
      Math.max(0, sourceStart / input.sourceSampleRate),
    );
    const source = context.createBufferSource();
    const gain = context.createGain();
    const panner = context.createStereoPanner();
    source.buffer = buffer;
    source.playbackRate.setValueAtTime(playbackRate, when);
    panner.pan.setValueAtTime(input.pan, when);
    const segmentSpan = segment.compositionEndSample - segment.compositionStartSample;
    const startProgress = (startSample - segment.compositionStartSample) / segmentSpan;
    const endProgress = (endSample - segment.compositionStartSample) / segmentSpan;
    const startGain = gainAt(segment, startProgress);
    const endGain = gainAt(segment, endProgress);
    gain.gain.cancelScheduledValues(when);
    gain.gain.setValueAtTime(startGain, when);
    gain.gain.linearRampToValueAtTime(endGain, when + compositionDuration);
    source.connect(gain);
    gain.connect(panner);
    panner.connect(context.destination);
    const scheduled: ScheduledSource = { source, gain, panner };
    activeSources.add(scheduled);
    source.onended = () => {
      activeSources.delete(scheduled);
      source.disconnect?.();
      gain.disconnect?.();
      panner.disconnect?.();
    };
    try {
      source.start(when, offset, compositionDuration);
    } catch (error) {
      activeSources.delete(scheduled);
      report("audio-decode-failed", `Unable to schedule ${input.clipId}: ${errorMessage(error)}`, input.source);
    }
    scheduledThroughByClip.set(input.clipId, endSample);
  };

  const scheduleInput = (
    input: RuntimeAudioMixInputV2,
    plan: RuntimeAudioMixPlanV2,
    contextInfo: PlaybackAudioPlanContextV2,
    generationAtRequest: number,
  ): void => {
    if (input.muted) return;
    void loadBuffer(input.source)
      .then((buffer) => {
        for (const segment of input.segments) {
          scheduleSegment(input, segment, buffer, plan, contextInfo, generationAtRequest);
        }
      })
      .catch(() => {
        // The diagnostic is emitted at the failing boundary above.
      });
  };

  return {
    consumeAudioMixPlan(plan, contextInfo) {
      if (disposed || !context) return;
      if (plan.sampleRate !== OUTPUT_SAMPLE_RATE || plan.endSample <= plan.startSample) {
        report("audio-plan-invalid", "AudioMixPlanV2 must use a positive 48 kHz sample window");
        return;
      }
      if (contextInfo.preroll) resetTransport(contextInfo.time);
      if (anchorContextTime === null) anchorContextTime = context.currentTime - contextInfo.time;
      const generationAtRequest = generation;
      for (const input of plan.inputs) {
        scheduleInput(input, plan, contextInfo, generationAtRequest);
      }
    },
    async resume() {
      if (disposed || !context) return false;
      if (context.state === "closed") {
        state = "unavailable";
        report("audio-context-closed", "Cannot resume a closed AudioContext");
        return false;
      }
      try {
        await context.resume();
        state = "ready";
        return true;
      } catch (error) {
        state = "suspended";
        report("audio-autoplay-blocked", errorMessage(error));
        return false;
      }
    },
    pause() {
      if (disposed) return;
      resetTransport(null);
      if (context?.state === "running") state = "suspended";
    },
    seek(time) {
      if (disposed) return;
      resetTransport(Math.max(0, time));
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      resetTransport(null);
      cache.clear();
      state = "disposed";
    },
    get state() {
      return state;
    },
    get diagnostics() {
      return diagnostics;
    },
  };
}
