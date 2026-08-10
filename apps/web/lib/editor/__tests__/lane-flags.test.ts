import { describe, expect, it } from "vitest";
import {
  applyLaneFlagPatch,
  selectionHasLockedLane,
} from "@motionvideo/editor-core";
import { DEFAULT_VISUAL_POLICY, type TimelineClip, type TimelineLane } from "@motionvideo/editor-core";

const lanes: TimelineLane[] = [
  {
    id: "base",
    kind: "visual",
    role: "base",
    order: -1,
    name: "Main",
    policy: { ...DEFAULT_VISUAL_POLICY },
  },
  {
    id: "audio",
    kind: "audio",
    role: "audio",
    order: 0,
    name: "Audio",
  },
];

const clips: TimelineClip[] = [
  {
    id: "c1",
    kind: "scene",
    sceneId: "s1",
    laneId: "base",
    startTime: 0,
    duration: 2,
    name: "A",
  },
];

describe("lane flags", () => {
  it("locks a visual lane and blocks selection mutate", () => {
    const next = applyLaneFlagPatch(lanes, "base", { locked: true });
    expect(selectionHasLockedLane(clips, next, ["c1"])).toBe(true);
  });

  it("hides visual lane without touching audio muted", () => {
    const next = applyLaneFlagPatch(lanes, "base", { visible: false, muted: true });
    const base = next.find((l) => l.id === "base");
    expect(base?.kind === "visual" && base.visible).toBe(false);
    const audio = next.find((l) => l.id === "audio");
    expect(audio?.kind === "audio" && audio.muted).toBeFalsy();
  });

  it("mutes audio lane", () => {
    const next = applyLaneFlagPatch(lanes, "audio", { muted: true });
    const audio = next.find((l) => l.id === "audio");
    expect(audio?.kind === "audio" && audio.muted).toBe(true);
  });
});
