import { afterEach, describe, expect, it, vi } from "vitest";
import { useAiJobsStore } from "@/lib/editor/ai/ai-jobs-store";
import { parseMotionProjectV1 } from "@motionvideo/motion-protocol";

const mockProject = parseMotionProjectV1({
  format: "motion-project",
  formatVersion: 1,
  metadata: { id: "p1", name: "Demo", locale: "vi-VN" },
  composition: { width: 1080, height: 1920, fps: 30 },
  layers: [],
});

describe("ai jobs store", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    useAiJobsStore.getState().cancel();
    useAiJobsStore.setState({ prompt: "", proposal: null, phase: "idle" });
  });

  it("runs mock generation to a proposal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          proposal: {
            id: "prop_test",
            baseRevision: 3,
            scope: "element",
            summary: "Make CTA punchier",
            affectedElementKeys: ["scene.demo/node.title"],
            warnings: [],
            commandLabels: [],
            project: mockProject,
            revision: 4,
          },
        }),
      }),
    );

    const run = useAiJobsStore.getState().startGeneration({
      prompt: "Make CTA punchier",
      scope: "element",
      baseRevision: 3,
      selectionLabel: "scene.demo/node.title",
      project: mockProject,
    });
    await run;
    const state = useAiJobsStore.getState();
    expect(state.phase).toBe("ready");
    expect(state.proposal?.baseRevision).toBe(3);
    expect(state.proposal?.scope).toBe("element");
    expect(state.proposal?.summary).toContain("CTA");
  });
});
