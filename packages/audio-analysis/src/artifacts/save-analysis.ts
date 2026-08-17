import { AudioAnalysisV1Schema, type AudioAnalysisV1 } from "../schema";
import { audioAnalysisObjectKey } from "./object-keys";
import type { ArtifactStore } from "./store";

/** Serialize an analysis artifact to canonical JSON (validated). */
export function serializeAudioAnalysisV1(analysis: AudioAnalysisV1): string {
  return JSON.stringify(AudioAnalysisV1Schema.parse(analysis));
}

export type SaveAnalysisInput = {
  workspaceId: string;
  projectId: string;
  analysis: AudioAnalysisV1;
};

/**
 * Persist an analysis artifact to the store under its deterministic object
 * key, returning the key. The caller is responsible for recording artifact
 * metadata (`projectId`, `audioAssetId`, `key`, `audioHash`,
 * `analyzerVersion`) in its app DB for cache invalidation.
 */
export async function saveAudioAnalysisArtifact(
  store: ArtifactStore,
  input: SaveAnalysisInput,
): Promise<string> {
  const key = audioAnalysisObjectKey({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    audioAssetId: input.analysis.audioAssetId,
  });
  await store.put(key, serializeAudioAnalysisV1(input.analysis), "application/json");
  return key;
}
