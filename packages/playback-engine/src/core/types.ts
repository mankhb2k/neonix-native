import type { AudioSampleRangeV3, RuntimeAudioMixPlanV3, RuntimeProjectV3, VideoRenderPlanV3 } from "@motionvideo/motion-runtime";

export type PlaybackEngineState = "idle" | "loading" | "ready" | "preparing" | "playing" | "paused" | "seeking" | "buffering" | "ended" | "error" | "disposed";
export type PlaybackOperationTokenV3 = { readonly generation: number; readonly operationId: number; readonly kind: "load" | "play" | "pause" | "seek" | "rate" | "tick" };
export type PlaybackTransportIntentV3 =
  | { readonly type: "play"; readonly epoch: number }
  | { readonly type: "pause"; readonly epoch: number }
  | { readonly type: "seek"; readonly epoch: number; readonly timeUs: number }
  | { readonly type: "set-rate"; readonly epoch: number; readonly rate: number };
/**
 * Sole authority for transport position. Implementations may derive time from
 * a monotonic source, AudioContext, or a rendered-sample counter.
 */
export type TransportClockV3 = {
  readonly source: "fake" | "audio" | "monotonic";
  nowUs(): number;
  start(atUs?: number): void;
  pause(atUs?: number): number;
  seek(timeUs: number): void;
  setRate?(rate: number): void;
};
/** @deprecated Use TransportClockV3. */
export type PlaybackClockV3 = TransportClockV3;
export type PlaybackSchedulerV3 = { request(callback: () => void): number; cancel(handle: number): void };
export type PlaybackBackendLifecycleV3 = {
  prepare?(project: RuntimeProjectV3, token: PlaybackOperationTokenV3): void | Promise<void>;
  start?(token: PlaybackOperationTokenV3): void | Promise<void>;
  pause?(token: PlaybackOperationTokenV3): void | Promise<void>;
  flush?(token: PlaybackOperationTokenV3): void;
  dispose?(): void;
};
export type AudioBackendTelemetryV3 = { readonly underruns?: number };
export type VideoPlanSinkV3 = PlaybackBackendLifecycleV3 & { publish(plan: VideoRenderPlanV3, token: PlaybackOperationTokenV3): void };
export type AudioPlanSinkV3 = PlaybackBackendLifecycleV3 & { publish(plan: RuntimeAudioMixPlanV3, token: PlaybackOperationTokenV3): void; telemetry?(): AudioBackendTelemetryV3 };
export type PlaybackReadinessV3 = "unknown" | "loading" | "ready" | "stalled" | "failed";
export type PlaybackMetricsSnapshotV3 = { ticks: number; publishedVideoPlans: number; publishedAudioPlans: number; staleOperations: number; seeks: number; underruns: number };
export type PlaybackEngineOptions = { clock?: TransportClockV3; scheduler?: PlaybackSchedulerV3; videoSink?: VideoPlanSinkV3; audioSink?: AudioPlanSinkV3; audioWindowFrameCount?: number };
export type PlaybackEngineSnapshot = { state: PlaybackEngineState; timeUs: number; durationUs: number; generation: number; projectId?: string; readiness: PlaybackReadinessV3; error?: string; metrics: PlaybackMetricsSnapshotV3 };
export type PlaybackEngine = { load(project: RuntimeProjectV3): PlaybackOperationTokenV3; /** Recompile/update render and mix plans without changing transport state or clock position. */ updateProject(project: RuntimeProjectV3): void; play(): PlaybackOperationTokenV3; pause(): PlaybackOperationTokenV3; seek(timeUs: number): PlaybackOperationTokenV3; setRate(rate: number): PlaybackOperationTokenV3; tick(): void; snapshot(): PlaybackEngineSnapshot; subscribe(listener: (snapshot: PlaybackEngineSnapshot) => void): () => void; isCurrent(token: PlaybackOperationTokenV3): boolean; complete<T>(token: PlaybackOperationTokenV3, completion: () => T): T | undefined; dispose(): void };
export type AudioWindowResolverV3 = (project: RuntimeProjectV3, range: AudioSampleRangeV3) => RuntimeAudioMixPlanV3;
