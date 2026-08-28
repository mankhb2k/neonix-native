import { resolveAudioWindow, resolveVideoAt, validateRuntimeProjectV3 } from "@motionvideo/motion-runtime";
import { createMonotonicClock } from "../clock/index";
import { createOperationRegistry, createResourceDisposalGuard } from "./operation-token";
import { createReadinessCoordinator } from "./readiness-coordinator";
import { transitionPlaybackStateV3 } from "./transport-state-machine";
import type { PlaybackEngineNext, PlaybackEngineNextOptions, PlaybackEngineNextSnapshot, PlaybackOperationTokenV3, PlaybackEngineNextState } from "./types";

export function createPlaybackEngineNext(options: PlaybackEngineNextOptions = {}): PlaybackEngineNext {
  const clock = options.clock ?? createMonotonicClock();
  const scheduler = options.scheduler;
  const operations = createOperationRegistry();
  const resources = createResourceDisposalGuard();
  const readiness = createReadinessCoordinator("unknown");
  let project: Parameters<PlaybackEngineNext["load"]>[0] | undefined;
  let state: PlaybackEngineNextState = "idle";
  let error: string | undefined;
  let scheduled: number | undefined;
  const metrics = { ticks: 0, publishedVideoPlans: 0, publishedAudioPlans: 0, staleOperations: 0, seeks: 0, underruns: 0 };
  const token = (kind: PlaybackOperationTokenV3["kind"]) => operations.begin(kind);
  const schedule = () => { if (scheduler && scheduled === undefined && state === "playing") scheduled = scheduler.request(() => { scheduled = undefined; tick(); }); };
  const fail = (reason: unknown): void => {
    error = reason instanceof Error ? reason.message : String(reason);
    readiness.set("failed");
    state = transitionPlaybackStateV3(state, "error");
    clock.setPlaying(false);
    if (scheduler && scheduled !== undefined) scheduler.cancel(scheduled);
    scheduled = undefined;
  };
  const publishAt = (timeUs: number, current: PlaybackOperationTokenV3): void => {
    if (!project || resources.isDisposed()) return;
    try {
      options.videoSink?.publish(resolveVideoAt(project, timeUs), current);
      metrics.publishedVideoPlans += options.videoSink ? 1 : 0;
      const startSample = Math.floor(timeUs / 1_000_000 * 48000);
      const endSample = startSample + (options.audioWindowSamples ?? 2048);
      options.audioSink?.publish(resolveAudioWindow(project, { startSample, endSample }), current);
      metrics.publishedAudioPlans += options.audioSink ? 1 : 0;
      metrics.underruns = Math.max(metrics.underruns, options.audioSink?.telemetry?.().underruns ?? 0);
    } catch (reason) {
      fail(reason);
    }
  };
  const tick = () => {
    if (state !== "playing" || !project || resources.isDisposed() || !readiness.canPlay()) return;
    metrics.ticks += 1;
    const current = token("tick");
    const timeUs = clock.nowUs();
    publishAt(timeUs, current);
    if (state === "playing") schedule();
  };
  const engine: PlaybackEngineNext = {
    load(nextProject) {
      if (resources.isDisposed()) return token("load");
      operations.invalidate();
      const current = token("load");
      state = transitionPlaybackStateV3(state, "load");
      readiness.set("loading");
      error = undefined;
      project = nextProject;
      clock.setPlaying(false);
      clock.seek(0);
      const validation = validateRuntimeProjectV3(nextProject);
      if (!validation.ok) {
        fail(validation.diagnostics.map((diagnostic) => diagnostic.message).join("; "));
        return current;
      }
      try {
        const preparations = [options.videoSink?.prepare?.(nextProject, current), options.audioSink?.prepare?.(nextProject, current)].filter((value): value is Promise<void> => value instanceof Promise);
        if (preparations.length === 0) {
          readiness.set("ready");
          state = transitionPlaybackStateV3(state, "ready");
        } else {
          void Promise.all(preparations).then(() => {
            if (!operations.current(current) || resources.isDisposed()) return;
            readiness.set("ready");
            state = transitionPlaybackStateV3(state, "ready");
          }).catch(fail);
        }
      } catch (reason) {
        fail(reason);
      }
      return current;
    },
    play() {
      const current = token("play");
      if (!readiness.canPlay() || (state !== "ready" && state !== "paused")) return current;
      try {
        clock.setPlaying(true);
        state = transitionPlaybackStateV3(state, "play");
        options.videoSink?.start?.(current);
        options.audioSink?.start?.(current);
        schedule();
      } catch (reason) {
        fail(reason);
      }
      return current;
    },
    pause() {
      const current = token("pause");
      if (state === "playing") {
        try { options.videoSink?.pause?.(current); options.audioSink?.pause?.(current); } catch (reason) { fail(reason); return current; }
        clock.setPlaying(false);
        state = transitionPlaybackStateV3(state, "pause");
        if (scheduler && scheduled !== undefined) scheduler.cancel(scheduled);
        scheduled = undefined;
      }
      return current;
    },
    seek(timeUs) {
      const current = token("seek");
      if (!project || resources.isDisposed() || !readiness.canPlay()) return current;
      operations.invalidate();
      const seekToken = token("seek");
      metrics.seeks += 1;
      const wasPlaying = state === "playing";
      state = transitionPlaybackStateV3(state, "seek");
      clock.seek(Math.max(0, timeUs));
      try {
        options.videoSink?.flush?.(seekToken);
        options.audioSink?.flush?.(seekToken);
        publishAt(clock.nowUs(), seekToken);
        if (wasPlaying) {
          options.videoSink?.start?.(seekToken);
          options.audioSink?.start?.(seekToken);
          state = "playing";
          schedule();
        } else state = "paused";
      } catch (reason) {
        fail(reason);
      }
      return seekToken;
    },
    tick,
    snapshot(): PlaybackEngineNextSnapshot { return { state, timeUs: clock.nowUs(), generation: operations.generation(), ...(project ? { projectId: project.projectId } : {}), readiness: readiness.status(), ...(error ? { error } : {}), metrics: { ...metrics } }; },
    isCurrent: (candidate) => operations.current(candidate),
    complete(candidate, completion) { if (!operations.current(candidate)) { metrics.staleOperations += 1; return undefined; } return completion(); },
    dispose() { if (state === "disposed") return; if (scheduler && scheduled !== undefined) scheduler.cancel(scheduled); const current = token("pause"); options.videoSink?.pause?.(current); options.audioSink?.pause?.(current); options.videoSink?.dispose?.(); options.audioSink?.dispose?.(); resources.dispose(); state = transitionPlaybackStateV3(state, "dispose"); },
  };
  return engine;
}

export type { PlaybackEngineNext, PlaybackEngineNextOptions, PlaybackEngineNextSnapshot } from "./types";
