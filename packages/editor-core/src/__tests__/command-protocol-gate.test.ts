/**
 * Contract test: mọi applied command phải phát ra project hợp lệ protocol V1.
 * Khóa ranh giới command → protocol JSON (schema-only; reference được trì hoãn
 * ở store boundary cho asset registration).
 */
import { describe, expect, it } from "vitest";
import { MotionProjectV1Schema } from "@motionvideo/motion-protocol";
import {
  fixtureMainOnly,
  fixtureBasePlusOverlay,
} from "../testing/fixtures/projects";
import {
  executeTimelineCommand,
  validateTimelineDocument,
  type TimelineDocument,
  type TimelineCommand,
  type EditorSelection,
  type ClipClipboardItem,
} from "..";

function assertAppliedValid(
  doc: TimelineDocument,
  command: TimelineCommand,
  selection?: EditorSelection,
  clipboard?: ClipClipboardItem[],
): void {
  const result = executeTimelineCommand(doc, command, selection, clipboard);
  if (result.status !== "applied") {
    throw new Error(
      `Command ${command.type} rejected unexpectedly: ${result.message}`,
    );
  }

  // 1. Ranh giới protocol: project phải parse được theo schema V1.
  const parsed = MotionProjectV1Schema.safeParse(result.document.project);
  expect(parsed.success, `command ${command.type} project không hợp lệ`).toBe(
    true,
  );

  // 2. Freshness: revision + fingerprint phải được stamp ở core.
  expect(result.document.revision).toBeGreaterThanOrEqual(1);
  expect(result.document.fingerprint).toBeDefined();

  // 3. Document invariants vẫn giữ.
  expect(validateTimelineDocument(result.document).valid).toBe(true);
}

describe("command → protocol contract", () => {
  const { project, clips, lanes } = fixtureMainOnly();
  const baseDoc: TimelineDocument = { project, clips, lanes };

  it("add-clip-draft (text) → protocol-valid", () => {
    assertAppliedValid(baseDoc, {
      type: "add-clip-draft",
      draft: { id: "d.t", name: "T", text: "T", duration: 2, kind: "text" },
      target: { track: "main" },
    });
  });

  it("add-clip-draft (image) → protocol-valid (asset deferred)", () => {
    assertAppliedValid(baseDoc, {
      type: "add-clip-draft",
      draft: {
        id: "d.img",
        name: "Photo",
        text: "Photo",
        duration: 3,
        kind: "image",
        assetId: "asset.photo",
      },
      target: { track: "main" },
    });
  });

  it("add-scene-node → protocol-valid", () => {
    assertAppliedValid(baseDoc, {
      type: "add-scene-node",
      sceneId: "scene.main.a",
      draft: { id: "d.n", name: "N", text: "N", duration: 2, kind: "text" },
      timing: { start: 0.5, duration: 1.5 },
    });
  });

  it("add-audio-clip → protocol-valid", () => {
    assertAppliedValid(baseDoc, {
      type: "add-audio-clip",
      item: { title: "Bed", assetId: "asset.bed", duration: 4 },
      target: { track: "audio" },
    });
  });

  it("move-clip → protocol-valid", () => {
    assertAppliedValid(baseDoc, {
      type: "move-clip",
      clipId: "clip.main.b",
      patch: { startTime: 1 },
    });
  });

  it("clip/trim → protocol-valid", () => {
    assertAppliedValid(baseDoc, {
      type: "clip/trim",
      clipId: "clip.main.a",
      duration: 1.5,
    });
  });

  it("split-selected-clips → protocol-valid (child timing clamped)", () => {
    assertAppliedValid(
      baseDoc,
      { type: "split-selected-clips", time: 1 },
      { kind: "clips", ids: ["clip.main.a"], primaryId: "clip.main.a" },
    );
  });

  it("duplicate-selected-clips → protocol-valid", () => {
    assertAppliedValid(
      baseDoc,
      { type: "duplicate-selected-clips" },
      { kind: "clips", ids: ["clip.main.a"], primaryId: "clip.main.a" },
    );
  });

  it("delete-selected-clips → protocol-valid", () => {
    assertAppliedValid(
      fixtureBasePlusOverlayDoc(),
      { type: "delete-selected-clips" },
      { kind: "clips", ids: ["clip.overlay"], primaryId: "clip.overlay" },
    );
  });

  it("update-scene-duration → protocol-valid", () => {
    assertAppliedValid(baseDoc, {
      type: "update-scene-duration",
      sceneId: "scene.main.a",
      duration: 4,
    });
  });

  it("update-lane-flags → protocol-valid", () => {
    assertAppliedValid(baseDoc, {
      type: "update-lane-flags",
      laneId: "lane.main",
      patch: { locked: true },
    });
  });

  it("rename-lane → protocol-valid", () => {
    assertAppliedValid(baseDoc, {
      type: "rename-lane",
      laneId: "lane.main",
      name: "Base",
    });
  });

  it("transition/add → protocol-valid", () => {
    assertAppliedValid(baseDoc, {
      type: "transition/add",
      id: "tr.1",
      fromClipId: "clip.main.a",
      toClipId: "clip.main.b",
      kind: "fade",
    });
  });

  it("paste-clips → protocol-valid", () => {
    const scene = project.layers[0]!;
    const clipboard: ClipClipboardItem[] = [
      {
        kind: "main",
        name: "Intro",
        duration: 2,
        offsetStart: 0,
        scene,
      },
    ];
    assertAppliedValid(
      baseDoc,
      { type: "paste-clips", atTime: 5 },
      undefined,
      clipboard,
    );
  });
});

function fixtureBasePlusOverlayDoc(): TimelineDocument {
  const { project, clips, lanes } = fixtureBasePlusOverlay();
  return { project, clips, lanes };
}
