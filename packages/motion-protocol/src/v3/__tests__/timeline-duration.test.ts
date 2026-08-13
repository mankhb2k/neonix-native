/**
 * Timeline duration derivation + canonicalization tests.
 */
import { describe, expect, it } from "vitest";
import {
  deriveTimelineDurationV3,
  hasTimelineContentV3,
  getVisualTimelineEndV3,
  getAudioTimelineEndV3,
  getCaptionTimelineEndV3,
  canonicalizeTimelineDurationV3 as canonicalize,
  CanonicalProjectTimelineV3Schema,
  ProjectTimelineV3Schema,
  type ProjectTimelineV3,
} from "../timeline";
import {
  CanonicalMotionProjectV3Schema,
  MotionProjectV3Schema,
  type MotionProjectV3,
} from "../project";

function visualClip(id: string, start: number, duration: number) {
  return {
    id,
    source: { kind: "scene" as const, sceneId: "scene-1" },
    start,
    duration,
  };
}

function audioTrack(id: string, start: number, duration: number) {
  return {
    id,
    order: -1,
    clips: [{ id: `${id}-clip`, assetId: "asset-audio", start, duration }],
  };
}

function captionToken(id: string, start: number, end: number) {
  return { id, text: "hello", start, end };
}

function timeline(partial: Record<string, unknown> = {}): ProjectTimelineV3 {
  return ProjectTimelineV3Schema.parse({ visualTracks: [], ...partial });
}

function project(timelinePatch: Record<string, unknown> = {}): MotionProjectV3 {
  return MotionProjectV3Schema.parse({
    format: "motion-project",
    formatVersion: 3,
    metadata: { id: "p", name: "P", locale: "vi-VN" },
    composition: { width: 1920, height: 1080, fps: 30 },
    dependencies: { compiler: { range: ">=1.0.0" }, components: [] },
    timeline: { visualTracks: [], ...timelinePatch },
    bindings: [],
  });
}

describe("deriveTimelineDurationV3", () => {
  it("returns 0 for an empty timeline", () => {
    const t = timeline();
    expect(deriveTimelineDurationV3(t)).toBe(0);
    expect(hasTimelineContentV3(t)).toBe(false);
  });

  it("derives from a visual clip (start 6 + duration 4 → 10)", () => {
    const t = timeline({
      visualTracks: [
        {
          id: "main",
          order: 0,
          clips: [visualClip("clip-1", 6, 4)],
        },
      ],
    });
    expect(getVisualTimelineEndV3(t)).toBe(10);
    expect(deriveTimelineDurationV3(t)).toBe(10);
  });

  it("derives from an audio track ending at 12", () => {
    const t = timeline({ audioTracks: [audioTrack("audio-1", 0, 12)] });
    expect(getAudioTimelineEndV3(t)).toBe(12);
    expect(deriveTimelineDurationV3(t)).toBe(12);
  });

  it("derives from a caption token ending at 15", () => {
    const t = timeline({
      captionTracks: [
        {
          id: "caption-1",
          locale: "vi-VN",
          tokens: [captionToken("tok-1", 0, 15)],
          style: { fontSize: 48, fill: "#ffffff" },
        },
      ],
    });
    expect(getCaptionTimelineEndV3(t)).toBe(15);
    expect(deriveTimelineDurationV3(t)).toBe(15);
  });

  it("uses max end across mixed visual/audio/caption content", () => {
    const t = timeline({
      visualTracks: [
        {
          id: "main",
          order: 0,
          clips: [visualClip("clip-1", 0, 8)],
        },
      ],
      audioTracks: [audioTrack("audio-1", 2, 8)],
      captionTracks: [
        {
          id: "caption-1",
          locale: "vi-VN",
          tokens: [captionToken("tok-1", 0, 6)],
          style: { fontSize: 48, fill: "#ffffff" },
        },
      ],
    });
    expect(deriveTimelineDurationV3(t)).toBe(10);
  });

  it("preserves gaps between clips in the derived duration", () => {
    const t = timeline({
      visualTracks: [
        {
          id: "main",
          order: 0,
          clips: [visualClip("clip-1", 0, 3), visualClip("clip-2", 5, 2)],
        },
      ],
    });
    // last clip ends at 7, first ends at 3 — gap 3..5 is preserved.
    expect(deriveTimelineDurationV3(t)).toBe(7);
  });

  it("an overlay clip extending beyond the main track sets the duration", () => {
    const t = timeline({
      visualTracks: [
        {
          id: "main",
          order: 0,
          clips: [visualClip("clip-main", 0, 4)],
        },
        {
          id: "overlay",
          order: 1,
          clips: [visualClip("clip-overlay", 2, 6)],
        },
      ],
    });
    expect(deriveTimelineDurationV3(t)).toBe(8);
  });
});

describe("timeline schema duration validation", () => {
  it("declared duration larger than content is valid (manual tail)", () => {
    const result = ProjectTimelineV3Schema.safeParse({
      duration: 20,
      visualTracks: [
        {
          id: "main",
          order: 0,
          clips: [visualClip("clip-1", 0, 10)],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("declared duration smaller than content is invalid", () => {
    const result = ProjectTimelineV3Schema.safeParse({
      duration: 8,
      visualTracks: [
        {
          id: "main",
          order: 0,
          clips: [visualClip("clip-1", 0, 10)],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("workArea.end beyond duration is invalid", () => {
    const result = ProjectTimelineV3Schema.safeParse({
      duration: 5,
      workArea: { start: 0, end: 6 },
      visualTracks: [],
    });
    expect(result.success).toBe(false);
  });

  it("marker beyond duration is invalid", () => {
    const result = ProjectTimelineV3Schema.safeParse({
      duration: 5,
      markers: [{ id: "m1", t: 6 }],
      visualTracks: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("canonicalizeTimelineDurationV3", () => {
  it("fills a missing duration from timeline content", () => {
    const p = project({
      visualTracks: [
        {
          id: "main",
          order: 0,
          clips: [visualClip("clip-1", 6, 4)],
        },
      ],
    });
    const result = canonicalize(p);
    expect(result.project.timeline.duration).toBe(10);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]!.path).toBe("timeline.duration");
  });

  it("does not override a declared larger duration", () => {
    const p = project({
      duration: 20,
      visualTracks: [
        {
          id: "main",
          order: 0,
          clips: [visualClip("clip-1", 0, 10)],
        },
      ],
    });
    const result = canonicalize(p);
    expect(result.project.timeline.duration).toBe(20);
    expect(result.issues).toHaveLength(0);
  });

  it("does not mutate the input", () => {
    const p = project({
      visualTracks: [
        {
          id: "main",
          order: 0,
          clips: [visualClip("clip-1", 0, 3)],
        },
      ],
    });
    expect(p.timeline.duration).toBeUndefined();
    canonicalize(p);
    expect(p.timeline.duration).toBeUndefined();
  });
});

describe("canonical schemas", () => {
  it("CanonicalProjectTimelineV3Schema requires duration", () => {
    const withoutDuration = ProjectTimelineV3Schema.parse({ visualTracks: [] });
    const bad = CanonicalProjectTimelineV3Schema.safeParse(withoutDuration);
    expect(bad.success).toBe(false);

    const good = CanonicalProjectTimelineV3Schema.safeParse({
      duration: 0,
      visualTracks: [],
    });
    expect(good.success).toBe(true);
  });

  it("CanonicalMotionProjectV3Schema requires timeline.duration", () => {
    expect(CanonicalMotionProjectV3Schema.safeParse(project()).success).toBe(
      false,
    );

    const canonical = project({ duration: 10 });
    expect(CanonicalMotionProjectV3Schema.safeParse(canonical).success).toBe(
      true,
    );
  });

  it("CanonicalMotionProjectV3Schema rejects off-grid duration at 1fps", () => {
    const offGrid = MotionProjectV3Schema.parse({
      format: "motion-project",
      formatVersion: 3,
      metadata: { id: "p", name: "P", locale: "vi-VN" },
      composition: { width: 1920, height: 1080, fps: 1 },
      dependencies: { compiler: { range: ">=1.0.0" }, components: [] },
      timeline: { duration: 1.001, visualTracks: [] },
      bindings: [],
    });
    const result = CanonicalMotionProjectV3Schema.safeParse(offGrid);
    expect(result.success).toBe(false);
  });
});

describe("frame-grid snap", () => {
  it("snaps 1.001 @ 1fps to 1 during canonicalize", () => {
    const p = MotionProjectV3Schema.parse({
      format: "motion-project",
      formatVersion: 3,
      metadata: { id: "p", name: "P", locale: "vi-VN" },
      composition: { width: 1920, height: 1080, fps: 1 },
      dependencies: { compiler: { range: ">=1.0.0" }, components: [] },
      timeline: {
        duration: 1.001,
        visualTracks: [
          {
            id: "main",
            order: 0,
            clips: [visualClip("clip-1", 0, 1.001)],
          },
        ],
      },
      bindings: [],
    });
    const result = canonicalize(p);
    expect(result.project.timeline.duration).toBe(1);
    expect(result.project.timeline.visualTracks[0]!.clips[0]!.duration).toBe(1);
    expect(
      CanonicalMotionProjectV3Schema.safeParse(result.project).success,
    ).toBe(true);
  });

  it("raises declared duration when snap makes content end past it", () => {
    // fps=1: start 0.6→1, duration 1.6→2 → end 3; declared 2.4→2
    // After snap, max(declared=2, derived=3) → duration 3.
    const p = MotionProjectV3Schema.parse({
      format: "motion-project",
      formatVersion: 3,
      metadata: { id: "p", name: "P", locale: "vi-VN" },
      composition: { width: 1920, height: 1080, fps: 1 },
      dependencies: { compiler: { range: ">=1.0.0" }, components: [] },
      timeline: {
        duration: 2.4,
        visualTracks: [
          {
            id: "main",
            order: 0,
            clips: [visualClip("clip-1", 0.6, 1.6)],
          },
        ],
      },
      bindings: [],
    });
    const result = canonicalize(p);
    const clip = result.project.timeline.visualTracks[0]!.clips[0]!;
    expect(clip.start + clip.duration).toBeLessThanOrEqual(
      result.project.timeline.duration! + 1e-9,
    );
    expect(result.project.timeline.duration).toBe(3);
    expect(
      result.issues.some((i) => i.message.includes("Raised timeline.duration")),
    ).toBe(true);
  });
});
