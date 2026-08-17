import { describe, it, expect } from "vitest";
import { saveAudioAnalysisArtifact } from "../artifacts/save-analysis";
import { loadAudioAnalysisArtifact } from "../artifacts/load-analysis";
import { audioAnalysisObjectKey } from "../artifacts/object-keys";
import { analyzePcm } from "../analyze";
import { silence } from "./helpers";
import type { ArtifactStore } from "../artifacts/store";

function memoryStore(): ArtifactStore & { keys: () => string[] } {
  const map = new Map<string, string>();
  return {
    keys: () => [...map.keys()],
    async get(key) {
      return map.get(key);
    },
    async put(key, body) {
      map.set(key, body);
    },
  };
}

describe("artifact save/load", () => {
  it("round-trips an analysis through the store", async () => {
    const store = memoryStore();
    const analysis = analyzePcm({
      samples: silence(44100, 1),
      sampleRate: 44100,
      projectId: "proj_123",
      audioAssetId: "asset.audio.main",
    });

    const key = await saveAudioAnalysisArtifact(store, {
      workspaceId: "ws_123",
      projectId: "proj_123",
      analysis,
    });

    expect(key).toBe(
      audioAnalysisObjectKey({
        workspaceId: "ws_123",
        projectId: "proj_123",
        audioAssetId: "asset.audio.main",
      }),
    );

    const loaded = await loadAudioAnalysisArtifact(store, key);
    expect(loaded).toEqual(analysis);
  });

  it("returns null for a missing artifact", async () => {
    const store = memoryStore();
    expect(await loadAudioAnalysisArtifact(store, "does/not/exist.json")).toBeNull();
  });

  it("throws on corrupt JSON", async () => {
    const store = memoryStore();
    await store.put("bad.json", "not json");
    await expect(loadAudioAnalysisArtifact(store, "bad.json")).rejects.toThrow();
  });
});
