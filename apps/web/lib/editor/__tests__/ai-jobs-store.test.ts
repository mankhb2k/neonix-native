import { describe, expect, it } from "vitest";
import { useAiJobsStore } from "@/lib/editor/ai/ai-jobs-store";

describe("ai jobs store", () => {
  it("runs mock generation to a proposal", async () => {
    useAiJobsStore.getState().cancel();
    useAiJobsStore.setState({ prompt: "", proposal: null, phase: "idle" });
    const run = useAiJobsStore.getState().startGeneration({
      prompt: "Make CTA punchier",
      scope: "element",
      baseRevision: 3,
      selectionLabel: "scene.demo/node.title",
    });
    await run;
    const state = useAiJobsStore.getState();
    expect(state.phase).toBe("ready");
    expect(state.proposal?.baseRevision).toBe(3);
    expect(state.proposal?.scope).toBe("element");
    expect(state.proposal?.summary).toContain("CTA");
  });
});
