import type { RuntimeMediaCatalogV3, RuntimeMediaResourceV3 } from "@motionvideo/motion-runtime";
import type { MediaProbeRecordV3 } from "./media-probe-v3";

export type SignedMediaResourceV3 = { uri: string; expiresAt: string; headers?: Record<string, string> };
export type MediaResourceProviderV3 = { resolve(resource: RuntimeMediaResourceV3): Promise<SignedMediaResourceV3>; refresh(resource: RuntimeMediaResourceV3): Promise<SignedMediaResourceV3>; manifest?(resource: RuntimeMediaResourceV3): Promise<unknown>; chunk?(resource: RuntimeMediaResourceV3, start: number, end: number): Promise<ArrayBuffer> };
export type RuntimeMediaCatalogSnapshotV3 = { catalog: RuntimeMediaCatalogV3; capturedAt: string; sourceVersion: number; diagnostics?: Array<{ code: string; assetId: string; streamId: string }> };

/** Hydrate immutable runtime metadata; signed URLs are resolved by an adapter. */
export function hydrateRuntimeMediaCatalogV3(record: MediaProbeRecordV3, originalUri: string, originalMimeType: string): RuntimeMediaCatalogSnapshotV3 {
  const diagnostics: RuntimeMediaCatalogSnapshotV3["diagnostics"] = [];
  const video = record.streams.filter((stream) => stream.kind === "video").map((stream) => ({ streamId: stream.streamId, resource: { resourceId: `${record.assetId}:${stream.streamId}:original`, role: "original" as const, uri: originalUri, mimeType: originalMimeType, integrity: record.sourceIntegrity }, durationUs: stream.durationUs ?? 0, width: stream.width ?? 1, height: stream.height ?? 1, frameRate: stream.frameRate ?? 30 }));
  const audio = record.streams.filter((stream) => stream.kind === "audio").flatMap((stream) => {
    const derivative = record.derivatives.find((item) => item.kind === "audio");
    if (!derivative) { diagnostics.push({ code: "missing_audio_derivative", assetId: record.assetId, streamId: stream.streamId }); return []; }
    return [{ streamId: stream.streamId, resource: { resourceId: derivative.derivativeId, role: "audio-proxy" as const, uri: derivative.uri, mimeType: derivative.mimeType, integrity: derivative.integrity }, durationSamples: stream.durationSamples ?? 0, sampleRate: stream.sampleRate ?? 48000, channels: stream.channels ?? 2, codec: derivative.codec }];
  });
  const asset = { mediaId: record.assetId, ...(video.length ? { video } : {}), ...(audio.length ? { audio } : {}) };
  return { catalog: { assets: [asset] }, capturedAt: new Date().toISOString(), sourceVersion: record.version, ...(diagnostics.length ? { diagnostics } : {}) };
}
