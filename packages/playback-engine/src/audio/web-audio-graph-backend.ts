import {
  clipProgressAtCompositionSampleV3,
  envelopeGainAtClipProgressV3,
  sourceSampleAtCompositionSampleV3,
  type RuntimeAudioMixPlanV3,
  type RuntimeMediaSourceRefV3,
} from "@motionvideo/motion-runtime";
import type { AudioBackendV3 } from "./audio-backend";
import { awaitMediaElementPlayV3, requestMediaElementPlayV3, type MediaElementPlayFailureReporterV3 } from "../core/media-element-playback";

export type WebAudioParamV3 = {
  value: number;
  cancelScheduledValues(time: number): void;
  setValueAtTime(value: number, time: number): void;
  linearRampToValueAtTime(value: number, time: number): void;
};
export type WebAudioNodeV3 = { connect(destination: unknown): unknown; disconnect?(): void };
export type WebAudioGainNodeV3 = WebAudioNodeV3 & { gain: WebAudioParamV3 };
export type WebAudioStereoPannerNodeV3 = WebAudioNodeV3 & { pan: WebAudioParamV3 };
export type WebAudioMediaElementSourceNodeV3 = WebAudioNodeV3;
export type WebAudioContextV3 = {
  currentTime: number;
  destination: unknown;
  state?: "suspended" | "running" | "closed" | "interrupted";
  createMediaElementSource(element: HTMLAudioElement): WebAudioMediaElementSourceNodeV3;
  createGain(): WebAudioGainNodeV3;
  createStereoPanner(): WebAudioStereoPannerNodeV3;
  resume?(): Promise<void>;
  close?(): Promise<void>;
};

export type WebAudioGraphBackendOptionsV3 = {
  createElement(clipId: string, source: RuntimeMediaSourceRefV3): HTMLAudioElement;
  resolveSource(source: RuntimeMediaSourceRefV3): boolean;
  context?: WebAudioContextV3;
  createContext?: () => WebAudioContextV3;
  onPlayFailure?: MediaElementPlayFailureReporterV3;
  onGraphFailure?: (reason: unknown) => void;
};

type Entry = {
  element: HTMLAudioElement;
  source: WebAudioMediaElementSourceNodeV3;
  gain: WebAudioGainNodeV3;
  panner: WebAudioStereoPannerNodeV3;
  scheduledThroughSample?: number;
  automationKey?: string;
};

export type WebAudioGraphBackendV3 = AudioBackendV3 & {
  readonly context: WebAudioContextV3 | undefined;
};

function defaultContext(): WebAudioContextV3 {
  const scope = globalThis as typeof globalThis & {
    AudioContext?: new () => WebAudioContextV3;
    webkitAudioContext?: new () => WebAudioContextV3;
  };
  const Constructor = scope.AudioContext ?? scope.webkitAudioContext;
  if (!Constructor) throw new Error("Web Audio API is unavailable");
  return new Constructor();
}

/**
 * MVP mixer: browser media elements decode, while Web Audio owns gain, pan,
 * fades and the single master output graph. It is intentionally replaceable by
 * StreamingWorklet when PCM-window scheduling is introduced.
 */
export function createWebAudioGraphBackendV3(options: WebAudioGraphBackendOptionsV3): WebAudioGraphBackendV3 {
  const entries = new Map<string, Entry>();
  let context = options.context;
  let master: WebAudioGainNodeV3 | undefined;
  let playing = false;
  const reportGraphFailure = (reason: unknown): void => options.onGraphFailure?.(reason);
  const graph = (): { context: WebAudioContextV3; master: WebAudioGainNodeV3 } | undefined => {
    try {
      if (!context) context = (options.createContext ?? defaultContext)();
      if (!master) {
        master = context.createGain();
        master.gain.value = 1;
        master.connect(context.destination);
      }
      return { context, master };
    } catch (reason) {
      reportGraphFailure(reason);
      return undefined;
    }
  };
  const release = (clipId: string, entry: Entry): void => {
    entry.element.pause();
    entry.source.disconnect?.();
    entry.gain.disconnect?.();
    entry.panner.disconnect?.();
    entries.delete(clipId);
  };
  const entryFor = (clipId: string, source: RuntimeMediaSourceRefV3): Entry | undefined => {
    const existing = entries.get(clipId);
    if (existing) return existing;
    const activeGraph = graph();
    if (!activeGraph) return undefined;
    try {
      const element = options.createElement(clipId, source);
      // Direct element output is routed through MediaElementAudioSourceNode.
      element.muted = false;
      element.volume = 1;
      const mediaSource = activeGraph.context.createMediaElementSource(element);
      const gain = activeGraph.context.createGain();
      const panner = activeGraph.context.createStereoPanner();
      mediaSource.connect(gain);
      gain.connect(panner);
      panner.connect(activeGraph.master);
      const entry = { element, source: mediaSource, gain, panner };
      entries.set(clipId, entry);
      return entry;
    } catch (reason) {
      reportGraphFailure(reason);
      return undefined;
    }
  };
  const play = (entry: Entry): void => {
    // publish() runs on every engine tick; avoid enqueueing a play promise
    // while this media element is already running.
    // Some host test doubles omit `paused`; only skip when the browser
    // explicitly reports that playback is already active.
    if (entry.element.paused === false) return;
    const resume = context?.resume;
    if (!resume) {
      requestMediaElementPlayV3(entry.element, "audio", options.onPlayFailure);
      return;
    }
    void resume.call(context).then(
      () => requestMediaElementPlayV3(entry.element, "audio", options.onPlayFailure),
      reportGraphFailure,
    );
  };
  const applyAutomation = (entry: Entry, plan: RuntimeAudioMixPlanV3, input: RuntimeAudioMixPlanV3["inputs"][number], segment: RuntimeAudioMixPlanV3["inputs"][number]["segments"][number]): void => {
    const activeGraph = graph();
    if (!activeGraph) return;
    const automationKey = `${input.clipId}:${segment.compositionStartSample}:${segment.compositionEndSample}:${input.gainLinear}:${input.pan}:${input.muted}`;
    const endSample = Math.min(plan.endSample, segment.compositionEndSample);
    if (entry.automationKey === automationKey && entry.scheduledThroughSample !== undefined && plan.startSample < entry.scheduledThroughSample) return;
    const at = activeGraph.context.currentTime;
    const gainAt = (sample: number): number => input.muted ? 0 : input.gainLinear * envelopeGainAtClipProgressV3(segment.gainEnvelope, clipProgressAtCompositionSampleV3(segment, sample));
    entry.panner.pan.cancelScheduledValues(at);
    entry.panner.pan.setValueAtTime(input.pan, at);
    entry.gain.gain.cancelScheduledValues(at);
    entry.gain.gain.setValueAtTime(gainAt(plan.startSample), at);
    if (endSample > plan.startSample) {
      entry.gain.gain.linearRampToValueAtTime(gainAt(endSample - 1), at + (endSample - plan.startSample) / plan.sampleRate);
    }
    entry.automationKey = automationKey;
    entry.scheduledThroughSample = endSample;
  };
  return {
    get context() { return context; },
    publish(plan, token) {
      const active = new Set<string>();
      for (const input of plan.inputs) {
        if (!options.resolveSource(input.source)) continue;
        const segment = input.segments.find((candidate) => candidate.compositionStartSample <= plan.startSample && plan.startSample < candidate.compositionEndSample);
        if (!segment) continue;
        const entry = entryFor(input.clipId, input.source);
        if (!entry) continue;
        active.add(input.clipId);
        const targetSeconds = sourceSampleAtCompositionSampleV3(segment, plan.startSample) / input.sourceSampleRate;
        // A tick should not continuously seek a playing media decoder. Seek is
        // authoritative, while drift correction is bounded for the MVP graph.
        if (token.kind !== "tick" || !playing || Math.abs(entry.element.currentTime - targetSeconds) > 0.1) {
          entry.element.currentTime = targetSeconds;
        }
        applyAutomation(entry, plan, input, segment);
        if (playing) play(entry);
      }
      for (const [clipId, entry] of entries) if (!active.has(clipId)) release(clipId, entry);
    },
    async start() {
      playing = true;
      const activeContext = graph()?.context;
      if (activeContext?.resume) await activeContext.resume();
      await Promise.all([...entries.values()].map((entry) => awaitMediaElementPlayV3(entry.element, "audio", options.onPlayFailure)));
    },
    pause() { playing = false; for (const entry of entries.values()) entry.element.pause(); },
    flush() { for (const entry of entries.values()) { entry.element.pause(); entry.scheduledThroughSample = undefined; entry.automationKey = undefined; } },
    dispose() {
      playing = false;
      for (const [clipId, entry] of entries) release(clipId, entry);
      master?.disconnect?.();
      master = undefined;
      void context?.close?.().catch(reportGraphFailure);
      context = undefined;
    },
  };
}
