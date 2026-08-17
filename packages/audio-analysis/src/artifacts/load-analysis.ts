import { parseAudioAnalysisV1, type AudioAnalysisV1 } from "../schema";
import type { ArtifactStore } from "./store";

/**
 * Load an `AudioAnalysisV1` artifact from the store, returning `null` when
 * the object does not exist. Throws if the stored JSON fails schema
 * validation (which indicates a stale/corrupt artifact and should be
 * treated as a cache miss + re-analyze).
 */
export async function loadAudioAnalysisArtifact(
  store: ArtifactStore,
  key: string,
): Promise<AudioAnalysisV1 | null> {
  const raw = await store.get(key);
  if (raw == null) return null;
  return parseAudioAnalysisV1(JSON.parse(raw));
}
