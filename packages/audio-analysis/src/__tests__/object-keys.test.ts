import { describe, it, expect } from "vitest";
import {
  audioAnalysisObjectKey,
  projectAssetObjectKey,
  waveformObjectKey,
  renderArtifactObjectKey,
} from "../artifacts/object-keys";

describe("object keys", () => {
  it("builds a project asset key", () => {
    expect(
      projectAssetObjectKey({
        workspaceId: "ws_123",
        projectId: "proj_123",
        assetType: "audio",
        assetId: "asset.audio.main",
        ext: "mp3",
      }),
    ).toBe("workspaces/ws_123/projects/proj_123/assets/audio/asset.audio.main.mp3");
  });

  it("strips a leading dot from the extension", () => {
    expect(
      projectAssetObjectKey({
        workspaceId: "ws_123",
        projectId: "proj_123",
        assetType: "image",
        assetId: "a",
        ext: ".webp",
      }),
    ).toBe("workspaces/ws_123/projects/proj_123/assets/image/a.webp");
  });

  it("builds an audio analysis key", () => {
    expect(
      audioAnalysisObjectKey({
        workspaceId: "ws_123",
        projectId: "proj_123",
        audioAssetId: "asset.audio.main",
      }),
    ).toBe(
      "workspaces/ws_123/projects/proj_123/analysis/audio/asset.audio.main.audio-analysis.v1.json",
    );
  });

  it("builds a waveform key", () => {
    expect(
      waveformObjectKey({
        workspaceId: "ws_123",
        projectId: "proj_123",
        audioAssetId: "asset.audio.main",
      }),
    ).toBe(
      "workspaces/ws_123/projects/proj_123/generated/waveforms/asset.audio.main.waveform.v1.json",
    );
  });

  it("builds a render artifact key", () => {
    expect(
      renderArtifactObjectKey({
        workspaceId: "ws_123",
        projectId: "proj_123",
        renderJobId: "job_1",
        artifact: "output.mp4",
      }),
    ).toBe("workspaces/ws_123/projects/proj_123/renders/jobs/job_1/output.mp4");
  });

  it("sanitizes path-separator characters", () => {
    expect(
      audioAnalysisObjectKey({
        workspaceId: "ws/1",
        projectId: "proj..1",
        audioAssetId: "../main",
      }),
    ).toBe(
      "workspaces/ws_1/projects/proj..1/analysis/audio/.._main.audio-analysis.v1.json",
    );
  });
});
