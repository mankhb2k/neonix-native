/**
 * Giải thuật trim clip thuần — dùng chung cho ghost preview và commit.
 */

export type ClipTrimEdge = "left" | "right";

export type ClipTrimPreview = {
  kind: "trim";
  clipId: string;
  startTime: number;
  duration: number;
};

export function resolveClipTrimUpdate(input: {
  edge: ClipTrimEdge;
  originStart: number;
  originDuration: number;
  deltaSec: number;
  minDuration: number;
  maxDuration?: number;
}): { startTime: number; duration: number } {
  const originEnd = input.originStart + input.originDuration;
  if (input.edge === "right") {
    return {
      startTime: input.originStart,
      duration: Math.min(
        input.maxDuration ?? Number.POSITIVE_INFINITY,
        Math.max(input.minDuration, input.originDuration + input.deltaSec),
      ),
    };
  }
  const nextStart = Math.min(
    originEnd - input.minDuration,
    Math.max(
      0,
      originEnd - (input.maxDuration ?? Number.POSITIVE_INFINITY),
      input.originStart + input.deltaSec,
    ),
  );
  return {
    startTime: nextStart,
    duration: originEnd - nextStart,
  };
}
