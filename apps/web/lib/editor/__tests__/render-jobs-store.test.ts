import { beforeEach, describe, expect, it } from "vitest";
import { useRenderJobsStore } from "@/lib/editor/export/render-jobs-store";

describe("render jobs store", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_EXPORT_MOCK = "1";
    useRenderJobsStore.getState().clear();
  });

  it("completes mock export with pinned revision", async () => {
    await useRenderJobsStore.getState().startExport({
      projectRevisionId: 12,
      format: "mp4",
      project: null,
    });
    const state = useRenderJobsStore.getState();
    expect(state.phase).toBe("ready");
    expect(state.revisionId).toBe(12);
    expect(state.artifactUrl).toContain("r12.mp4");
  });
});
