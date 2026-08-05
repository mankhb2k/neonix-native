import { describe, expect, it } from "vitest";
import { useRenderJobsStore } from "@/lib/editor/export/render-jobs-store";

describe("render jobs store", () => {
  it("completes mock export with pinned revision", async () => {
    useRenderJobsStore.getState().clear();
    await useRenderJobsStore.getState().startExport({
      projectRevisionId: 12,
      format: "mp4",
    });
    const state = useRenderJobsStore.getState();
    expect(state.phase).toBe("ready");
    expect(state.revisionId).toBe(12);
    expect(state.artifactUrl).toContain("r12.mp4");
  });
});
