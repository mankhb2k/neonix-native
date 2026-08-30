/**
 * Minimal pluggable artifact store.
 *
 * The real implementation is provided by the Web-owned storage layer
 * (R2 + metadata records). Keeping this as an interface means the
 * audio-analysis package stays free of any storage dependency and is easy
 * to unit-test with an in-memory store.
 */
export type ArtifactStore = {
  get(key: string): Promise<string | undefined>;
  put(key: string, body: string, contentType?: string): Promise<void>;
};
