import { sourceSampleAtCompositionSampleV3, type RuntimeAudioMixPlanV3, type RuntimeMediaSourceRefV3 } from "@motionvideo/motion-runtime";
import type { AudioBackendV3 } from "./audio-backend";
import { requestMediaElementPlayV3, type MediaElementPlayFailureReporterV3 } from "../core/media-element-playback";

export type HTMLAudioElementLikeV3 = { currentTime: number; volume: number; muted: boolean; play(): Promise<void> | void; pause(): void };
export type HTMLMediaAudioBackendOptionsV3 = { createElement(clipId: string, source: RuntimeMediaSourceRefV3): HTMLAudioElementLikeV3; resolveSource(source: RuntimeMediaSourceRefV3): boolean; onPlayFailure?: MediaElementPlayFailureReporterV3 };

/**
 * Bounded browser fallback for MVP preview. Each clip owns an element so
 * overlapping instances remain independent. StreamingWorklet remains the
 * precision path; this adapter deliberately has no decoding assumptions.
 */
export function createHTMLMediaAudioBackendV3(options: HTMLMediaAudioBackendOptionsV3): AudioBackendV3 {
  const entries = new Map<string, HTMLAudioElementLikeV3>();
  let playing = false;
  const releaseInactive = (active: ReadonlySet<string>): void => {
    for (const [clipId, element] of entries) {
      if (active.has(clipId)) continue;
      element.pause();
      entries.delete(clipId);
    }
  };
  return {
    publish(plan: RuntimeAudioMixPlanV3) {
      const active = new Set<string>();
      for (const input of plan.inputs) {
        if (input.muted || !options.resolveSource(input.source)) continue;
        const segment = input.segments.find((candidate) => candidate.compositionStartSample <= plan.startSample && plan.startSample < candidate.compositionEndSample);
        if (!segment) continue;
        active.add(input.clipId);
        let element = entries.get(input.clipId);
        if (!element) {
          element = options.createElement(input.clipId, input.source);
          element.muted = false;
          entries.set(input.clipId, element);
        }
        const sourceSample = sourceSampleAtCompositionSampleV3(segment, plan.startSample);
        element.currentTime = sourceSample / input.sourceSampleRate;
        element.volume = Math.max(0, Math.min(1, input.gainLinear));
        if (playing) requestMediaElementPlayV3(element, "audio", options.onPlayFailure);
      }
      releaseInactive(active);
    },
    start() { playing = true; for (const element of entries.values()) requestMediaElementPlayV3(element, "audio", options.onPlayFailure); },
    pause() { playing = false; for (const element of entries.values()) element.pause(); },
    flush() { for (const element of entries.values()) element.pause(); },
    dispose() { playing = false; for (const element of entries.values()) element.pause(); entries.clear(); },
  };
}
