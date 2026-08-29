import { resolveAudioWindow, resolveVideoAt } from "@motionvideo/motion-runtime";
import type { RuntimeProjectV3 } from "@motionvideo/motion-runtime";

export type PlaybackShadowProbeV3 = { readonly timeUs: number; readonly startSample: number; readonly frameCount: number };
export type PlaybackShadowMismatchV3 = { readonly probe: PlaybackShadowProbeV3; readonly videoEqual: boolean; readonly audioEqual: boolean; readonly nextVideo: unknown; readonly referenceVideo: unknown; readonly nextAudio: unknown; readonly referenceAudio: unknown };
export type PlaybackShadowReportV3 = { readonly equal: boolean; readonly probes: number; readonly mismatches: readonly PlaybackShadowMismatchV3[] };

/** Compares semantic plan output, never backend/resource identity. */
export function compareRuntimePlansV3(next: RuntimeProjectV3, reference: RuntimeProjectV3, probes: readonly PlaybackShadowProbeV3[]): PlaybackShadowReportV3 {
  const mismatches: PlaybackShadowMismatchV3[] = [];
  for (const probe of probes) {
    const nextVideo = resolveVideoAt(next, probe.timeUs); const referenceVideo = resolveVideoAt(reference, probe.timeUs);
    const nextAudio = resolveAudioWindow(next, { startSample: probe.startSample, frameCount: probe.frameCount }); const referenceAudio = resolveAudioWindow(reference, { startSample: probe.startSample, frameCount: probe.frameCount });
    const videoEqual = stableJsonV3(nextVideo) === stableJsonV3(referenceVideo); const audioEqual = stableJsonV3(nextAudio) === stableJsonV3(referenceAudio);
    if (!videoEqual || !audioEqual) mismatches.push({ probe, videoEqual, audioEqual, nextVideo, referenceVideo, nextAudio, referenceAudio });
  }
  return { equal: mismatches.length === 0, probes: probes.length, mismatches };
}

function stableJsonV3(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => { if (item && typeof item === "object" && "length" in item && typeof (item as { length?: unknown }).length === "number" && (item as { constructor?: { name?: string } }).constructor?.name?.endsWith("Array")) return Array.from(item as ArrayLike<unknown>); if (item && typeof item === "object" && !Array.isArray(item)) return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))); return item; });
}
