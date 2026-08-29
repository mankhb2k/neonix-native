import type { RuntimeMediaResourceV3, RuntimeMediaSourceRefV3, RuntimeProjectV3, VideoRenderPlanV3 } from "@motionvideo/motion-runtime";
import type { PlaybackOperationTokenV3, VideoPlanSinkV3 } from "../core/types";
import { requestMediaElementPlayV3, type MediaElementPlayFailureReporterV3 } from "../core/media-element-playback";
import type { MediaResourceProviderV3, ResolvedMediaResourceV3 } from "../resources/media-resource-provider";

export type VideoElementLikeV3 = { src: string; currentTime: number; readyState: number; muted: boolean; preload: "none" | "metadata" | "auto"; play(): Promise<void> | void; pause(): void; load(): void; addEventListener(type: string, listener: () => void): void; removeEventListener(type: string, listener: () => void): void; requestVideoFrameCallback?(callback: (now: number, metadata: { mediaTime: number }) => void): number; cancelVideoFrameCallback?(handle: number): void };
export type VideoElementFactoryV3 = (instanceId: string, source: RuntimeMediaSourceRefV3) => VideoElementLikeV3;
export type ResolvedVideoElementFactoryV3 = (instanceId: string, source: RuntimeMediaSourceRefV3, resource: ResolvedMediaResourceV3) => VideoElementLikeV3;
export type VideoFrameResourceV3 = { kind: "video-frame"; instanceId: string; revision: number; frame: unknown };
export type VideoFrameResourceBridgeV3 = { publish(resource: VideoFrameResourceV3): void; release?(resource: VideoFrameResourceV3): void };

type Entry = { instanceId: string; source: RuntimeMediaSourceRefV3; element: VideoElementLikeV3; revision: number; frame: unknown; generation: number; pendingSeek?: { mediaTimeUs: number; generation: number }; callback?: number; onReady: () => void };

export type HTMLVideoBackendV3 = VideoPlanSinkV3 & { seek(instanceId: string, mediaTimeUs: number, generation: number): void; correctDrift(instanceId: string, targetMediaTimeUs: number, toleranceUs?: number): boolean; resource(instanceId: string): VideoFrameResourceV3 | undefined; entries(): readonly string[] };

const sameSource = (left: RuntimeMediaSourceRefV3, right: RuntimeMediaSourceRefV3): boolean => left.mediaId === right.mediaId && left.streamId === right.streamId;

/** HTMLVideoElement adapter; ownership is by playback instance, never asset id. */
export function createHTMLVideoBackendV3(factory: VideoElementFactoryV3, bridge?: VideoFrameResourceBridgeV3, onPlayFailure?: MediaElementPlayFailureReporterV3): HTMLVideoBackendV3 {
  const pool = new Map<string, Entry>();
  let playing = false;
  const resource = (entry: Entry): VideoFrameResourceV3 | undefined => entry.frame === undefined ? undefined : { kind: "video-frame", instanceId: entry.instanceId, revision: entry.revision, frame: entry.frame };
  const release = (entry: Entry): void => {
    entry.element.pause();
    entry.element.removeEventListener("loadedmetadata", entry.onReady);
    entry.element.removeEventListener("canplay", entry.onReady);
    if (entry.callback !== undefined) entry.element.cancelVideoFrameCallback?.(entry.callback);
    const frame = resource(entry);
    if (frame) bridge?.release?.(frame);
  };
  const create = (instanceId: string, source: RuntimeMediaSourceRefV3): Entry => {
    const element = factory(instanceId, source);
    element.muted = true;
    element.preload = "auto";
    let entry: Entry;
    entry = { instanceId, source, element, revision: 0, frame: undefined, generation: 0, onReady: () => {
      if (entry.pendingSeek && entry.element.readyState >= 1) {
        entry.element.currentTime = entry.pendingSeek.mediaTimeUs / 1e6;
        entry.pendingSeek = undefined;
      }
    } };
    element.addEventListener("loadedmetadata", entry.onReady);
    element.addEventListener("canplay", entry.onReady);
    if (element.requestVideoFrameCallback) {
      const callback = (_now: number, metadata: { mediaTime: number }): void => {
        entry.revision += 1;
        entry.frame = metadata;
        bridge?.publish({ kind: "video-frame", instanceId, revision: entry.revision, frame: metadata });
        entry.callback = element.requestVideoFrameCallback?.(callback);
      };
      entry.callback = element.requestVideoFrameCallback(callback);
    }
    pool.set(instanceId, entry);
    return entry;
  };
  const get = (instanceId: string, source: RuntimeMediaSourceRefV3): Entry => {
    const existing = pool.get(instanceId);
    if (existing && sameSource(existing.source, source)) return existing;
    if (existing) { release(existing); pool.delete(instanceId); }
    return create(instanceId, source);
  };
  const applySeek = (entry: Entry, mediaTimeUs: number, generation: number): void => {
    if (generation < entry.generation) return;
    entry.generation = generation;
    if (entry.element.readyState >= 1) {
      entry.element.currentTime = mediaTimeUs / 1e6;
      entry.pendingSeek = undefined;
    } else entry.pendingSeek = { mediaTimeUs, generation };
  };
  return {
    publish(plan: VideoRenderPlanV3, token: PlaybackOperationTokenV3) {
      const active = new Set(plan.instances.map((request) => request.instanceId));
      for (const [instanceId, entry] of pool) {
        if (active.has(instanceId)) continue;
        release(entry);
        pool.delete(instanceId);
      }
      for (const request of plan.instances) {
        const entry = get(request.instanceId, request.source);
        applySeek(entry, request.mediaTimeUs, token.generation);
        if (playing) requestMediaElementPlayV3(entry.element, "video", onPlayFailure);
      }
    },
    start() { playing = true; for (const entry of pool.values()) requestMediaElementPlayV3(entry.element, "video", onPlayFailure); },
    pause() { playing = false; for (const entry of pool.values()) entry.element.pause(); },
    flush() { for (const entry of pool.values()) entry.element.pause(); },
    seek(instanceId, mediaTimeUs, generation) { const entry = pool.get(instanceId); if (entry) applySeek(entry, mediaTimeUs, generation); },
    correctDrift(instanceId, targetMediaTimeUs, toleranceUs = 50_000) {
      const entry = pool.get(instanceId);
      if (!entry) return false;
      const drift = targetMediaTimeUs - entry.element.currentTime * 1e6;
      if (Math.abs(drift) <= toleranceUs) return false;
      entry.element.currentTime = targetMediaTimeUs / 1e6;
      return true;
    },
    resource(instanceId) { const entry = pool.get(instanceId); return entry ? resource(entry) : undefined; },
    entries: () => [...pool.keys()],
    dispose() { playing = false; for (const entry of pool.values()) release(entry); pool.clear(); },
  };
}

/** Resource resolution is a readiness concern, separate from element ownership. */
export function createResourceBackedHTMLVideoBackendV3(factory: ResolvedVideoElementFactoryV3, provider: MediaResourceProviderV3, bridge?: VideoFrameResourceBridgeV3, onPlayFailure?: MediaElementPlayFailureReporterV3): HTMLVideoBackendV3 {
  const resolved = new Map<string, ResolvedMediaResourceV3>();
  const backend = createHTMLVideoBackendV3((instanceId, source) => {
    const resource = resolved.get(`${source.mediaId}:${source.streamId}`);
    if (!resource) throw new Error(`Video resource '${source.mediaId}:${source.streamId}' was not prepared`);
    return factory(instanceId, source, resource);
  }, bridge, onPlayFailure);
  return {
    ...backend,
    async prepare(project: RuntimeProjectV3) {
      const resources = project.mediaCatalog.assets.flatMap((asset) => asset.video?.map((stream) => ({ source: { mediaId: asset.mediaId, streamId: stream.streamId }, resource: stream.resource })) ?? []);
      await Promise.all(resources.map(async ({ source, resource }) => {
        resolved.set(`${source.mediaId}:${source.streamId}`, await provider.resolve(resource));
      }));
    },
    dispose() {
      resolved.clear();
      backend.dispose?.();
    },
  };
}
