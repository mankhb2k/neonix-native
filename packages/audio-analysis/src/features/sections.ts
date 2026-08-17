import type { Beat, EnergyFrame, Section, SectionType } from "../schema";
import { clamp01 } from "./common";

export type SectionDetectionOptions = {
  /** Analysis window length in seconds. Default 8. */
  windowSeconds?: number;
};

export type SectionDetectionInput = {
  duration: number;
  loudness: EnergyFrame[];
  bassEnergy: EnergyFrame[];
  beats: Beat[];
};

function averageInRange(
  frames: EnergyFrame[],
  start: number,
  end: number,
): number {
  let sum = 0;
  let count = 0;
  for (const frame of frames) {
    if (frame.t >= start && frame.t < end) {
      sum += frame.value;
      count += 1;
    }
  }
  return count === 0 ? 0 : sum / count;
}

/**
 * Heuristic section segmentation (intro/build/drop/main/break/outro).
 *
 * Splits the track into fixed windows, computes average loudness/bass and
 * beat density per window, then labels each window against the global mean.
 * Adjacent windows with the same label are merged.
 */
export function detectSections(
  input: SectionDetectionInput,
  options: SectionDetectionOptions = {},
): Section[] {
  const windowSeconds = options.windowSeconds ?? 8;
  const { duration } = input;

  if (duration <= 0) return [];

  const windowCount = Math.max(1, Math.ceil(duration / windowSeconds));
  const winDur = duration / windowCount;

  type WindowStat = {
    start: number;
    end: number;
    loud: number;
    bass: number;
    beatDensity: number;
    confidence: number;
  };
  const stats: WindowStat[] = [];
  for (let w = 0; w < windowCount; w++) {
    const start = w * winDur;
    const end = start + winDur;
    const loud = averageInRange(input.loudness, start, end);
    const bass = averageInRange(input.bassEnergy, start, end);
    const beatCount = input.beats.filter(
      (b) => b.t >= start && b.t < end,
    ).length;
    stats.push({
      start,
      end,
      loud,
      bass,
      beatDensity: beatCount / winDur,
      confidence: 0,
    });
  }

  const mean =
    stats.reduce((sum, s) => sum + s.loud, 0) / Math.max(1, stats.length);
  const variance =
    stats.reduce((sum, s) => sum + (s.loud - mean) ** 2, 0) /
    Math.max(1, stats.length);
  const std = Math.sqrt(variance) || 1e-3;
  const meanDensity =
    stats.reduce((sum, s) => sum + s.beatDensity, 0) /
    Math.max(1, stats.length);

  const labels: SectionType[] = stats.map((s, i) => {
    const level =
      s.loud > mean + 0.4 * std
        ? "high"
        : s.loud < mean - 0.4 * std
          ? "low"
          : "mid";
    const prevLoud = i > 0 ? stats[i - 1].loud : s.loud;
    const rising = s.loud > prevLoud + 0.2 * std;
    const falling = s.loud < prevLoud - 0.2 * std;
    const isStart = i < windowCount * 0.25;
    const isEnd = i >= windowCount * 0.75;
    const highBeat = s.beatDensity > meanDensity * 1.2;

    stats[i].confidence = clamp01(0.4 + 0.6 * (Math.abs(s.loud - mean) / (2 * std)));

    if (isStart && level !== "high") return "intro";
    if (isEnd && (level === "low" || falling)) return "outro";
    if (highBeat || level === "high") {
      return rising && i > 0 && stats[i - 1].loud < mean ? "drop" : "main";
    }
    if (rising) return "build";
    if (falling && level === "low") return "break";
    return "main";
  });

  // Merge adjacent windows of the same type, keeping the stronger confidence.
  const sections: Section[] = [];
  for (let i = 0; i < labels.length; i++) {
    const type = labels[i];
    if (sections.length > 0 && sections[sections.length - 1].type === type) {
      const last = sections[sections.length - 1];
      last.end = stats[i].end;
      last.confidence = Math.max(last.confidence ?? 0, stats[i].confidence);
    } else {
      sections.push({
        type,
        start: stats[i].start,
        end: stats[i].end,
        confidence: stats[i].confidence,
      });
    }
  }

  if (sections.length > 0) {
    sections[sections.length - 1].end = duration;
  }

  return sections;
}
