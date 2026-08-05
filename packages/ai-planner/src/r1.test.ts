import { describe, expect, it } from "vitest";
import {
  executeCommandBatch,
  parseCreativeBriefV1,
  parseCreativePlanV1,
  planMotionProject,
  type PlanResult,
} from "./index";

describe("ai-planner R1 contracts", () => {
  it("rejects invalid brief aspect ratio", () => {
    expect(() =>
      parseCreativeBriefV1({
        format: "moticlip-creative-brief",
        formatVersion: 1,
        objective: "x",
        durationSeconds: 10,
        aspectRatio: "21:9",
        script: "Hello",
        language: "vi",
      }),
    ).toThrow(/CreativeBriefV1/);
  });

  it("rejects empty creative plan scenes", () => {
    expect(() =>
      parseCreativePlanV1({
        format: "moticlip-creative-plan",
        formatVersion: 1,
        concept: "x",
        tone: [],
        artDirection: {},
        pacing: {},
        scenes: [],
      }),
    ).toThrow(/CreativePlanV1/);
  });
});

describe("ai-planner R1 commands", () => {
  it("builds blank project via command batch and compiles", () => {
    const result = executeCommandBatch({
      format: "moticlip-command-batch",
      formatVersion: 1,
      baseRevision: 0,
      commands: [
        {
          type: "createProject",
          projectId: "proj.test",
          name: "Test",
          aspectRatio: "9:16",
          brandName: "Brand",
        },
        { type: "addScene", sceneId: "scene.a", duration: 2 },
        {
          type: "addNode",
          sceneId: "scene.a",
          nodeId: "text.a",
          nodeType: "text",
          text: "Hi",
        },
        {
          type: "addTrack",
          sceneId: "scene.a",
          clipId: "clip.a",
          targetId: "text.a",
          property: "transform.opacity",
          duration: 1,
          keys: [
            { t: 0, v: 0 },
            { t: 1, v: 1, easing: "easeOut" },
          ],
        },
        { type: "removeNode", sceneId: "scene.a", nodeId: "text.a" },
        {
          type: "addNode",
          sceneId: "scene.a",
          nodeId: "text.b",
          nodeType: "text",
          text: "Hello",
        },
        { type: "compileProject" },
      ],
    });
    expect(result.ok).toBe(true);
    expect(result.project?.scenes[0]?.nodes).toHaveLength(1);
    expect(result.project?.scenes[0]?.nodes[0]?.id).toBe("text.b");
    expect(result.compiled?.format).toBe("motion-runtime");
  });

  it("rolls back batch when unsupported command fails", () => {
    const result = executeCommandBatch({
      format: "moticlip-command-batch",
      formatVersion: 1,
      baseRevision: 0,
      commands: [
        {
          type: "createProject",
          projectId: "proj.test",
          name: "Test",
          aspectRatio: "1:1",
          brandName: "Brand",
        },
        { type: "addAudioCue" },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.project).toBeNull();
    expect(result.receipts.at(-1)?.diagnostics[0]?.code).toBe("unsupported_capability");
    expect(result.receipts.at(-1)?.diagnostics[0]?.repairHint).toBeTruthy();
  });

  it("applies setLayoutConstraint, setCamera, addMask, and cubic addTrack", () => {
    const result = executeCommandBatch({
      format: "moticlip-command-batch",
      formatVersion: 1,
      baseRevision: 0,
      commands: [
        {
          type: "createProject",
          projectId: "proj.r2",
          name: "R2",
          aspectRatio: "1:1",
          brandName: "Brand",
        },
        { type: "addScene", sceneId: "scene.1", duration: 2 },
        {
          type: "addNode",
          sceneId: "scene.1",
          nodeId: "stack",
          nodeType: "group",
          transform: { x: 0, y: 0, width: 400, height: 400, anchorX: 0, anchorY: 0 },
        },
        {
          type: "addNode",
          sceneId: "scene.1",
          nodeId: "child",
          nodeType: "shape",
          parentId: "stack",
          transform: { x: 0, y: 0, width: 100, height: 100, anchorX: 0, anchorY: 0 },
        },
        {
          type: "setLayoutConstraint",
          sceneId: "scene.1",
          nodeId: "stack",
          modifierId: "lay",
          constraint: { kind: "stack", direction: "vertical", gap: 8 },
        },
        {
          type: "setCamera",
          sceneId: "scene.1",
          cameraId: "cam",
          zoom: 1,
          parallaxStrength: 1,
          makeActive: true,
        },
        {
          type: "addMask",
          sceneId: "scene.1",
          nodeId: "child",
          sourceNodeId: "stack",
          mode: "luma",
        },
        {
          type: "addTrack",
          sceneId: "scene.1",
          clipId: "clip.x",
          targetId: "child",
          property: "transform.x",
          duration: 1,
          keys: [
            { t: 0, v: 0 },
            { t: 1, v: 50, easing: { type: "cubic-bezier", x1: 0.4, y1: 0, x2: 0.2, y2: 1 } },
          ],
        },
        { type: "compileProject" },
      ],
    });
    expect(result.ok).toBe(true);
    expect(result.project?.scenes[0]?.activeCameraId).toBe("cam");
    expect(result.project?.scenes[0]?.space).toBe("layered-2.5d");
    const child = result.project?.scenes[0]?.nodes.find((node) => node.id === "child");
    expect(child?.mask?.mode).toBe("luma");
    expect(result.compiled?.scenes[0]?.tracks.some((track) => track.property === "transform.x")).toBe(true);
  });
});

describe("ai-planner R1 from-scratch", () => {
  it("creates blank MotionProject from brief through commands", () => {
    const result = planMotionProject({
      brief: {
        format: "moticlip-creative-brief",
        formatVersion: 1,
        objective: "Sell coffee",
        durationSeconds: 12,
        aspectRatio: "9:16",
        script: "Wake up.\nSave more.\nOrder now.",
        language: "vi",
        brand: { name: "Cafe", primaryColor: "#D9381E" },
        constraints: { mustIncludeCta: true, maxScenes: 3 },
      },
      mode: "from-scratch",
      seed: "unit-from-scratch",
    }) as PlanResult;

    expect(result.project.format).toBe("motion-project");
    expect(result.project.scenes.length).toBeGreaterThanOrEqual(1);
    expect(result.generation.model).toContain("from-scratch");
    expect(result.generation.planId).toBe("plan_unit-from-scratch");
    expect(result.receipts.some((receipt) => receipt.diagnostics.some((d) => d.code === "compiled"))).toBe(true);
  });

  it("keeps template mode as optional prior", () => {
    const result = planMotionProject({
      brief: {
        format: "moticlip-creative-brief",
        formatVersion: 1,
        objective: "F&B ad",
        durationSeconds: 15,
        aspectRatio: "9:16",
        script: "Hook\nOffer\nCTA",
        language: "vi",
        brand: { name: "Cà Phê Sáng", primaryColor: "#D9381E" },
      },
      mode: "template",
      industry: "fnb",
      templateId: "fnb-hook-offer-cta",
      seed: "unit-template",
    }) as PlanResult;

    expect(result.project.scenes.length).toBeGreaterThan(0);
    expect(result.generation.model).toContain("template");
  });

  it("preserves legacy PlanInput returning MotionProject", () => {
    const project = planMotionProject({
      brandName: "Legacy",
      industry: "fnb",
      script: "A\nB\nC",
      templateId: "fnb-hook-offer-cta",
    });
    expect("format" in project && project.format === "motion-project").toBe(true);
    expect("generation" in project).toBe(false);
  });
});
