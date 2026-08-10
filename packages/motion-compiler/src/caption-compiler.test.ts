import { describe, expect, it } from "vitest";
import {
  compileCaptionTracks,
  evaluateCaptionStateAtTime,
} from "./caption-compiler";
import type { CaptionTrack } from "@motionvideo/motion-protocol";

const track: CaptionTrack = {
  id: "cap1",
  locale: "vi-VN",
  enabled: true,
  tokens: [
    { id: "w1", text: "Xin", start: 0, end: 0.3 },
    { id: "w2", text: "chao", start: 0.3, end: 0.6 },
    { id: "w3", text: "ban", start: 1.0, end: 1.3 },
  ],
  segmentation: { maxLines: 2, maxWordsPerCue: 2, gapThreshold: 0.2 },
  style: { fontSize: 42, fill: "#ffffff", safeArea: "tiktok", position: "bottom" },
  animation: { presetId: "karaoke" },
};

describe("caption-compiler", () => {
  it("segments tokens into deterministic cues", () => {
    const compiled = compileCaptionTracks([track]);
    expect(compiled[0]!.cues.length).toBeGreaterThanOrEqual(2);
    expect(compiled[0]!.cues[0]!.tokens.map((t) => t.tokenId)).toEqual(["w1", "w2"]);
  });

  it("evaluates active tokens by global time", () => {
    const compiled = compileCaptionTracks([track]);
    const at = evaluateCaptionStateAtTime(compiled, 0.35);
    expect(at[0]!.activeTokenIds).toContain("w2");
  });
});
