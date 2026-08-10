import type { CaptionTrack } from "@motionvideo/motion-protocol";

export type CompiledCaptionCueToken = {
  tokenId: string;
  text: string;
  start: number;
  end: number;
};

export type CompiledCaptionCue = {
  id: string;
  trackId: string;
  start: number;
  end: number;
  tokens: CompiledCaptionCueToken[];
  lines: string[];
};

export type CompiledCaptionTrack = {
  trackId: string;
  enabled: boolean;
  style: CaptionTrack["style"];
  animation: CaptionTrack["animation"];
  cues: CompiledCaptionCue[];
};

/**
 * Deterministic token → cue segmentation for caption tracks.
 * Timing stays in global project seconds.
 */
export function compileCaptionTracks(tracks: CaptionTrack[]): CompiledCaptionTrack[] {
  return tracks.map((track) => ({
    trackId: track.id,
    enabled: track.enabled !== false,
    style: track.style,
    animation: track.animation,
    cues: segmentTokens(track),
  }));
}

function segmentTokens(track: CaptionTrack): CompiledCaptionCue[] {
  const tokens = [...track.tokens].sort((a, b) => a.start - b.start || a.end - b.end);
  if (tokens.length === 0) return [];

  const maxWords = track.segmentation.maxWordsPerCue ?? 8;
  const maxChars = track.segmentation.maxCharactersPerLine ?? 32;
  const maxLines = track.segmentation.maxLines ?? 2;
  const gapThreshold = track.segmentation.gapThreshold ?? 0.35;
  const maxCueDuration = track.segmentation.maxCueDuration ?? 6;

  const cues: CompiledCaptionCue[] = [];
  let bucket: typeof tokens = [];
  let cueIndex = 0;

  const flush = () => {
    if (bucket.length === 0) return;
    const start = bucket[0]!.start;
    const end = bucket[bucket.length - 1]!.end;
    const words = bucket.map((t) => t.text);
    const lines = packLines(words, maxChars, maxLines);
    cues.push({
      id: `${track.id}::cue::${cueIndex}`,
      trackId: track.id,
      start,
      end,
      tokens: bucket.map((t) => ({
        tokenId: t.id,
        text: t.text,
        start: t.start,
        end: t.end,
      })),
      lines,
    });
    cueIndex += 1;
    bucket = [];
  };

  for (const token of tokens) {
    const wouldExceedWords = bucket.length >= maxWords;
    const gapBreak =
      bucket.length > 0 && token.start - bucket[bucket.length - 1]!.end > gapThreshold;
    const durationBreak =
      bucket.length > 0 && token.end - bucket[0]!.start > maxCueDuration;
    if (wouldExceedWords || gapBreak || durationBreak) flush();
    bucket.push(token);
    if (cues.length + (bucket.length > 0 ? 1 : 0) > MOTION_CAPTION_CUE_SOFT_LIMIT) {
      flush();
      break;
    }
  }
  flush();
  return cues.slice(0, 1024);
}

const MOTION_CAPTION_CUE_SOFT_LIMIT = 1024;

function packLines(words: string[], maxChars: number, maxLines: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current.length === 0 ? word : `${current} ${word}`;
    if (next.length > maxChars && current.length > 0) {
      lines.push(current);
      current = word;
      if (lines.length >= maxLines) break;
    } else {
      current = next;
    }
  }
  if (current.length > 0 && lines.length < maxLines) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

export type ActiveCaptionState = {
  trackId: string;
  cueId: string | null;
  activeTokenIds: string[];
  lines: string[];
};

/** Evaluate which cue/tokens are active at a global time. */
export function evaluateCaptionStateAtTime(
  compiled: CompiledCaptionTrack[],
  globalTime: number,
): ActiveCaptionState[] {
  return compiled
    .filter((track) => track.enabled)
    .map((track) => {
      const cue =
        track.cues.find((c) => globalTime >= c.start && globalTime < c.end) ??
        null;
      const activeTokenIds = cue
        ? cue.tokens
            .filter((t) => globalTime >= t.start && globalTime < t.end)
            .map((t) => t.tokenId)
        : [];
      return {
        trackId: track.trackId,
        cueId: cue?.id ?? null,
        activeTokenIds,
        lines: cue?.lines ?? [],
      };
    });
}
