/**
 * Planner beat tools — never dump raw energy envelopes into model context.
 */

export type BeatMarker = {
  time: number;
  strength?: number;
  downbeat?: boolean;
};

export type AudioAnalysisLike = {
  version: number;
  bpm?: number;
  beats?: BeatMarker[];
  energy?: {
    sampleRateHz: number;
    values: number[];
  };
};

export function findBeatNear(
  analysis: AudioAnalysisLike | undefined,
  time: number,
  tolerance = 0.12,
): BeatMarker | null {
  const beats = analysis?.beats ?? [];
  if (beats.length === 0) return null;
  let best: BeatMarker | null = null;
  let bestDist = Infinity;
  for (const beat of beats) {
    const dist = Math.abs(beat.time - time);
    if (dist <= tolerance && dist < bestDist) {
      best = beat;
      bestDist = dist;
    }
  }
  return best;
}

export function listDownbeats(
  analysis: AudioAnalysisLike | undefined,
  range?: { start: number; end: number },
): BeatMarker[] {
  const beats = analysis?.beats ?? [];
  return beats.filter((beat) => {
    if (!beat.downbeat) return false;
    if (!range) return true;
    return beat.time >= range.start && beat.time <= range.end;
  });
}

export function summarizeEnergy(
  analysis: AudioAnalysisLike | undefined,
  range: { start: number; end: number },
  buckets = 8,
): { bucketCount: number; averages: number[]; peak: number; mean: number } {
  const energy = analysis?.energy;
  if (!energy || energy.values.length === 0 || buckets <= 0) {
    return { bucketCount: 0, averages: [], peak: 0, mean: 0 };
  }
  const startSample = Math.max(0, Math.floor(range.start * energy.sampleRateHz));
  const endSample = Math.min(
    energy.values.length,
    Math.ceil(range.end * energy.sampleRateHz),
  );
  const slice = energy.values.slice(startSample, endSample);
  if (slice.length === 0) {
    return { bucketCount: buckets, averages: Array(buckets).fill(0), peak: 0, mean: 0 };
  }
  const averages: number[] = [];
  const size = Math.max(1, Math.floor(slice.length / buckets));
  for (let i = 0; i < buckets; i += 1) {
    const part = slice.slice(i * size, i === buckets - 1 ? slice.length : (i + 1) * size);
    const avg = part.length === 0 ? 0 : part.reduce((a, b) => a + b, 0) / part.length;
    averages.push(Math.round(avg * 1000) / 1000);
  }
  const peak = Math.max(...slice, 0);
  const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
  return {
    bucketCount: buckets,
    averages,
    peak: Math.round(peak * 1000) / 1000,
    mean: Math.round(mean * 1000) / 1000,
  };
}

export function createSceneMarkersFromBeats(
  analysis: AudioAnalysisLike | undefined,
  options?: { downbeatsOnly?: boolean; prefix?: string; maxMarkers?: number },
): Array<{ id: string; t: number }> {
  const prefix = options?.prefix ?? "beat";
  const max = options?.maxMarkers ?? 256;
  const source = options?.downbeatsOnly
    ? listDownbeats(analysis)
    : (analysis?.beats ?? []);
  return source.slice(0, max).map((beat, index) => ({
    id: `${prefix}.${index}`,
    t: beat.time,
  }));
}

export function snapClipToBeat(
  analysis: AudioAnalysisLike | undefined,
  time: number,
  tolerance = 0.12,
): number {
  const beat = findBeatNear(analysis, time, tolerance);
  return beat ? beat.time : time;
}
