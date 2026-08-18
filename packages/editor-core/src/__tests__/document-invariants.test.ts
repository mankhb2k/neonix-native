import { describe, expect, it } from "vitest";
import {
  fixtureBasePlusOverlay,
  fixtureMainOnly,
  fixtureMainPlusAudioOverlap,
  fixtureMultiSceneReferences,
} from "../testing/fixtures/projects";
import {
  validateTimelineDocument,
  type TimelineDocument,
} from "../document/document";
import type { TimelineClip } from "../timeline/model/timeline-types";
import {
  clipsById,
  clipsByLane,
  contentEndSeconds,
  lanesById,
  visualCompositionIndex,
} from "../timeline/indexes";
import { migrateLanesAndClips } from "../timeline/timeline-clips";

describe("TimelineDocument Invariants & Validation", () => {
  it("validates fixtureMainOnly correctly", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const doc: TimelineDocument = { project, clips, lanes };
    const res = validateTimelineDocument(doc);
    expect(res.valid).toBe(true);
  });

  it("validates fixtureBasePlusOverlay correctly", () => {
    const { project, clips, lanes } = fixtureBasePlusOverlay();
    const doc: TimelineDocument = { project, clips, lanes };
    const res = validateTimelineDocument(doc);
    expect(res.valid).toBe(true);
  });

  it("validates fixtureMainPlusAudioOverlap after migration", () => {
    const { project, clips, lanes, overlayScenes } =
      fixtureMainPlusAudioOverlap();
    const migrated = migrateLanesAndClips(project, overlayScenes, clips, lanes);
    const doc: TimelineDocument = {
      project,
      lanes: migrated.lanes,
      clips: migrated.clips,
    };
    const res = validateTimelineDocument(doc);
    expect(res.valid).toBe(true);
  });

  it("validates fixtureMultiSceneReferences correctly", () => {
    const { project, clips, lanes } = fixtureMultiSceneReferences();
    const doc: TimelineDocument = { project, clips, lanes };
    const res = validateTimelineDocument(doc);
    expect(res.valid).toBe(true);
  });

  it("catches missing base lane violation", () => {
    const { project, clips } = fixtureMainOnly();
    const doc: TimelineDocument = { project, clips, lanes: [] };
    const res = validateTimelineDocument(doc);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.violations.some((v) => v.reason === "missing_base_lane")).toBe(
        true,
      );
    }
  });

  it("catches multiple base lanes violation", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const extraBase = { ...lanes[0], id: "lane.base.extra" };
    const doc: TimelineDocument = {
      project,
      clips,
      lanes: [...lanes, extraBase],
    };
    const res = validateTimelineDocument(doc);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(
        res.violations.some((v) => v.reason === "multiple_base_lanes"),
      ).toBe(true);
    }
  });

  it("catches duplicate lane ID violation", () => {
    const { project, clips, lanes } = fixtureBasePlusOverlay();
    const duplicateLane = { ...lanes[1] };
    const doc: TimelineDocument = {
      project,
      clips,
      lanes: [...lanes, duplicateLane],
    };
    const res = validateTimelineDocument(doc);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.violations.some((v) => v.reason === "duplicate_lane_id")).toBe(
        true,
      );
    }
  });

  it("catches duplicate clip ID violation", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const duplicateClip = { ...clips[0] };
    const doc: TimelineDocument = {
      project,
      clips: [...clips, duplicateClip],
      lanes,
    };
    const res = validateTimelineDocument(doc);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.violations.some((v) => v.reason === "duplicate_clip_id")).toBe(
        true,
      );
    }
  });

  it("catches clip overlap violation on base lane", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const overlappingClip = {
      ...clips[0],
      id: "clip.overlapping",
      startTime: clips[0].startTime + 0.5,
    };
    const doc: TimelineDocument = {
      project,
      clips: [...clips, overlappingClip],
      lanes,
    };
    const res = validateTimelineDocument(doc);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(
        res.violations.some((v) => v.reason === "clip_overlap_violation"),
      ).toBe(true);
    }
  });

  it("catches dangling clip laneId reference violation", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const danglingClip: TimelineClip = {
      ...clips[0]!,
      id: "clip.ghost",
      laneId: "lane.missing",
    };
    const doc: TimelineDocument = {
      project,
      clips: [...clips, danglingClip],
      lanes,
    };
    const res = validateTimelineDocument(doc);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(
        res.violations.some((v) => v.reason === "dangling_clip_lane_id"),
      ).toBe(true);
    }
  });

  it("catches dangling scene reference violation", () => {
    const { project, clips, lanes } = fixtureBasePlusOverlay();
    const ghost: TimelineClip = {
      ...clips[0]!,
      id: "clip.ghost",
      sceneId: "scene.missing",
      laneId: "lane.overlay.0",
      startTime: 5,
      duration: 1,
      name: "Ghost",
    };
    const doc: TimelineDocument = { project, clips: [...clips, ghost], lanes };
    const res = validateTimelineDocument(doc);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(
        res.violations.some((v) => v.reason === "dangling_scene_reference"),
      ).toBe(true);
    }
  });

  it("catches dangling audio track reference violation", () => {
    const { project, clips, lanes } = fixtureMainPlusAudioOverlap();
    const ghost: TimelineClip = {
      id: "clip.ghost-audio",
      kind: "audio",
      audioTrackId: "audio.missing",
      assetId: "asset.missing",
      laneId: lanes[0]!.id,
      startTime: 10,
      duration: 1,
      name: "Ghost Audio",
    };
    const doc: TimelineDocument = { project, clips: [...clips, ghost], lanes };
    const res = validateTimelineDocument(doc);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(
        res.violations.some(
          (v) => v.reason === "dangling_audio_track_reference",
        ),
      ).toBe(true);
    }
  });
});

describe("Timeline Index Builders", () => {
  it("builds lanesById and clipsById indexes correctly", () => {
    const { project, clips, lanes } = fixtureBasePlusOverlay();
    const doc: TimelineDocument = { project, clips, lanes };

    const lMap = lanesById(doc);
    const cMap = clipsById(doc);

    expect(lMap.size).toBe(lanes.length);
    expect(cMap.size).toBe(clips.length);
    expect(lMap.get("lane.main")).toBeDefined();
    expect(cMap.get("clip.base")).toBeDefined();
  });

  it("builds clipsByLane and calculates contentEndSeconds correctly", () => {
    const { project, clips, lanes } = fixtureBasePlusOverlay();
    const doc: TimelineDocument = { project, clips, lanes };

    const byLane = clipsByLane(doc);
    expect(byLane.get("lane.main")?.length).toBe(1);
    expect(byLane.get("lane.overlay.0")?.length).toBe(1);

    expect(contentEndSeconds(doc)).toBe(4);
  });

  it("builds visualCompositionIndex ordered by lane order", () => {
    const { project, clips, lanes } = fixtureBasePlusOverlay();
    const doc: TimelineDocument = { project, clips, lanes };

    const compIndex = visualCompositionIndex(doc);
    expect(compIndex.length).toBe(2); // base + 1 overlay
    expect(compIndex[0].lane.role).toBe("base");
    expect(compIndex[1].lane.role).toBe("overlay");
    expect(compIndex[0].clips[0].id).toBe("clip.base");
    expect(compIndex[1].clips[0].id).toBe("clip.overlay");
  });
});
