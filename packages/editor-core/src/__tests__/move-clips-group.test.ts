import { describe, expect, it } from "vitest";
import {
  executeTimelineCommand,
  resolveClipGroupMove,
  validateTimelineDocument,
  type TimelineDocument,
} from "..";
import {
  fixtureBasePlusOverlay,
  fixtureMainOnly,
} from "../testing/fixtures/projects";
import {
  createHistoryState,
  pushHistory,
  undoHistory,
} from "../history/history-manager";

describe("move-clips atomic group", () => {
  it("time-shifts main pair with shared delta and one spacing", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const doc: TimelineDocument = { project, clips, lanes };
    const a = clips.find((c) => c.id === "clip.main.a")!;
    const b = clips.find((c) => c.id === "clip.main.b")!;
    const gap = b.startTime - a.startTime;

    const result = executeTimelineCommand(doc, {
      type: "move-clips",
      clipIds: ["clip.main.a", "clip.main.b"],
      deltaTime: 1,
    });

    expect(result.status).toBe("applied");
    if (result.status !== "applied") return;
    expect(validateTimelineDocument(result.document).valid).toBe(true);
    const na = result.document.clips.find((c) => c.id === "clip.main.a")!;
    const nb = result.document.clips.find((c) => c.id === "clip.main.b")!;
    expect(na.startTime).toBe(a.startTime + 1);
    expect(nb.startTime - na.startTime).toBeCloseTo(gap, 6);
    expect(result.events.filter((e) => e.type === "clip-moved")).toHaveLength(2);
  });

  it("omit-track keep-lane leaves overlay on overlay", () => {
    const { project, clips, lanes } = fixtureBasePlusOverlay();
    const doc: TimelineDocument = { project, clips, lanes };
    const ov = clips.find((c) => c.id === "clip.overlay")!;

    const result = executeTimelineCommand(doc, {
      type: "move-clip",
      clipId: "clip.overlay",
      patch: { startTime: ov.startTime + 0.5 },
    });

    expect(result.status).toBe("applied");
    if (result.status !== "applied") return;
    const moved = result.document.clips.find((c) => c.id === "clip.overlay")!;
    expect(moved.laneId).toBe("lane.overlay.0");
    expect(moved.startTime).toBeCloseTo(ov.startTime + 0.5, 6);
  });

  it("group move keeps overlay on overlay lane", () => {
    const { project, clips, lanes } = fixtureBasePlusOverlay();
    const doc: TimelineDocument = { project, clips, lanes };
    const base = clips.find((c) => c.id === "clip.base")!;

    const result = executeTimelineCommand(doc, {
      type: "move-clips",
      clipIds: ["clip.base", "clip.overlay"],
      deltaTime: 0.5 - base.startTime,
    });

    expect(result.status).toBe("applied");
    if (result.status !== "applied") return;
    expect(
      result.document.clips.find((c) => c.id === "clip.overlay")?.laneId,
    ).toBe("lane.overlay.0");
    expect(
      result.document.clips.find((c) => c.id === "clip.base")?.startTime,
    ).toBe(0.5);
  });

  it("shared clamp preserves spacing when dragging past zero", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const doc: TimelineDocument = { project, clips, lanes };
    const a = clips.find((c) => c.id === "clip.main.a")!;
    const b = clips.find((c) => c.id === "clip.main.b")!;
    const gap = b.startTime - a.startTime;

    const result = executeTimelineCommand(doc, {
      type: "move-clips",
      clipIds: ["clip.main.a", "clip.main.b"],
      deltaTime: -2,
    });

    expect(result.status).toBe("applied");
    if (result.status !== "applied") return;
    const na = result.document.clips.find((c) => c.id === "clip.main.a")!;
    const nb = result.document.clips.find((c) => c.id === "clip.main.b")!;
    expect(na.startTime).toBe(0);
    expect(nb.startTime - na.startTime).toBeCloseTo(gap, 6);
  });

  it("rejects when non-group clip blocks target", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const blocker = {
      ...clips[0]!,
      id: "clip.blocker",
      sceneId: "scene.main.a",
      startTime: 5,
      duration: 2,
      name: "Blocker",
    };
    const doc: TimelineDocument = {
      project,
      lanes,
      clips: [...clips, blocker],
    };
    const a = clips.find((c) => c.id === "clip.main.a")!;

    const result = executeTimelineCommand(doc, {
      type: "move-clips",
      clipIds: ["clip.main.a", "clip.main.b"],
      deltaTime: 5 - a.startTime,
    });

    expect(result.status).toBe("rejected");
  });

  it("resolveClipGroupMove marks collision invalid for preview", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const blocker = {
      ...clips[0]!,
      id: "clip.blocker",
      sceneId: "scene.main.a",
      startTime: 5,
      duration: 2,
      name: "Blocker",
    };
    const doc: TimelineDocument = {
      project,
      lanes,
      clips: [...clips, blocker],
    };
    const a = clips.find((c) => c.id === "clip.main.a")!;
    const resolved = resolveClipGroupMove(
      doc,
      ["clip.main.a", "clip.main.b"],
      5 - a.startTime,
    );
    expect(resolved.valid).toBe(false);
    if (resolved.valid) return;
    expect(resolved.reason).toBe("collision");
  });

  it("rejects duplicate clip ids", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const doc: TimelineDocument = { project, clips, lanes };
    const result = executeTimelineCommand(doc, {
      type: "move-clips",
      clipIds: ["clip.main.a", "clip.main.a"],
      deltaTime: 1,
    });
    expect(result.status).toBe("rejected");
    if (result.status !== "rejected") return;
    expect(result.reason).toBe("duplicate_clip");
  });

  it("group members do not collide with each other while shifting", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const doc: TimelineDocument = { project, clips, lanes };
    const result = executeTimelineCommand(doc, {
      type: "move-clips",
      clipIds: ["clip.main.a", "clip.main.b"],
      deltaTime: 1,
    });
    expect(result.status).toBe("applied");
  });

  it("undo restores both clips from one history entry", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const before: TimelineDocument = { project, clips, lanes };
    const result = executeTimelineCommand(before, {
      type: "move-clips",
      clipIds: ["clip.main.a", "clip.main.b"],
      deltaTime: 1,
    });
    expect(result.status).toBe("applied");
    if (result.status !== "applied") return;

    let history = createHistoryState();
    history = pushHistory(history, {
      id: "h1",
      timestamp: 1,
      label: "Move clips",
      before,
      after: result.document,
    });
    const undone = undoHistory(history);
    expect(undone.entry?.before.clips.find((c) => c.id === "clip.main.a")?.startTime).toBe(
      0,
    );
  });
});
