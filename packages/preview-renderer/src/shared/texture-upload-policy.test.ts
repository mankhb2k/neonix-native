import { describe, expect, it } from "vitest";
import { decideTextureUpdate } from "./texture-upload-policy";

const revision = (overrides: Partial<Parameters<typeof decideTextureUpdate>[1]> = {}) => ({
  assetId: "asset",
  resourceGeneration: 1,
  contentRevision: 1,
  decodedFrameRevision: 0,
  width: 100,
  height: 100,
  format: "rgba8" as const,
  ...overrides,
});

describe("texture upload policy", () => {
  it("reuses unchanged assets and uploads only decoded revisions", () => {
    const first = revision();
    expect(decideTextureUpdate(null, first).kind).toBe("recreate-and-upload");
    expect(decideTextureUpdate(first, revision()).kind).toBe("reuse");
    expect(decideTextureUpdate(first, revision({ decodedFrameRevision: 1 })).kind).toBe("upload-in-place");
  });

  it("recreates when resource/content identity or dimensions change", () => {
    const first = revision();
    expect(decideTextureUpdate(first, revision({ contentRevision: 2 })).kind).toBe("recreate-and-upload");
    expect(decideTextureUpdate(first, revision({ resourceGeneration: 2 })).kind).toBe("recreate-and-upload");
    expect(decideTextureUpdate(first, revision({ width: 200 })).kind).toBe("recreate-and-upload");
  });

  it("returns remove for a missing revision", () => {
    expect(decideTextureUpdate(revision(), null).kind).toBe("remove");
  });
});
