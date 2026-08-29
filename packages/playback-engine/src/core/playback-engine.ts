import { resolveAudioWindow, resolveVideoAt, validateRuntimeProjectV3 } from "@motionvideo/motion-runtime";
import { createMonotonicClock } from "../clock/index";
import { createOperationRegistry, createResourceDisposalGuard } from "./operation-token";
import { createReadinessCoordinator } from "./readiness-coordinator";
import { transitionPlaybackStateV3 } from "./transport-state-machine";
import type { PlaybackEngine, PlaybackEngineOptions, PlaybackEngineSnapshot, PlaybackOperationTokenV3, PlaybackEngineState } from "./types";

export function createPlaybackEngine(options: PlaybackEngineOptions = {}): PlaybackEngine {
  const clock = options.clock ?? createMonotonicClock();
  const scheduler = options.scheduler;
  const operations = createOperationRegistry();
  const resources = createResourceDisposalGuard();
  const readiness = createReadinessCoordinator("unknown");
  let project: Parameters<PlaybackEngine["load"]>[0] | undefined;
  let state: PlaybackEngineState = "idle";
  let error: string | undefined;
  let scheduled: number | undefined;
  const listeners = new Set<(snapshot: PlaybackEngineSnapshot) => void>();
  const metrics = { ticks: 0, publishedVideoPlans: 0, publishedAudioPlans: 0, staleOperations: 0, seeks: 0, underruns: 0 };
  const notify = (): void => {
    const snapshot: PlaybackEngineSnapshot = { state, timeUs: clock.nowUs(), generation: operations.generation(), ...(project ? { projectId: project.projectId } : {}), readiness: readiness.status(), ...(error ? { error } : {}), metrics: { ...metrics } };
    for (const listener of listeners) listener(snapshot);
  };
  const token = (kind: PlaybackOperationTokenV3["kind"]) => operations.begin(kind);
  const schedule = () => { if (scheduler && scheduled === undefined && state === "playing") scheduled = scheduler.request(() => { scheduled = undefined; tick(); }); };
  const fail = (reason: unknown): void => {
    error = reason instanceof Error ? reason.message : String(reason);
    readiness.set("failed");
    state = transitionPlaybackStateV3(state, "error");
    clock.pause();
    if (scheduler && scheduled !== undefined) scheduler.cancel(scheduled);
    scheduled = undefined;
    notify();
  };
  const publishAt = (timeUs: number, current: PlaybackOperationTokenV3): void => {
    if (!project || resources.isDisposed()) return;
    try {
      options.videoSink?.publish(resolveVideoAt(project, timeUs), current);
      metrics.publishedVideoPlans += options.videoSink ? 1 : 0;
      const startSample = Math.floor(timeUs / 1_000_000 * project.audioTimeline.sampleRate);
      options.audioSink?.publish(resolveAudioWindow(project, {
        startSample,
        frameCount: options.audioWindowFrameCount ?? 12_000,
      }), current);
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
    notify();
    if (state === "playing") schedule();
  };
  const engine: PlaybackEngine = {
    load(nextProject) {
      if (resources.isDisposed()) return token("load");
      operations.invalidate();
      const current = token("load");
      state = transitionPlaybackStateV3(state, "load");
      readiness.set("loading");
      error = undefined;
      project = nextProject;
      clock.pause();
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
          notify();
        } else {
          void Promise.all(preparations).then(() => {
            if (!operations.current(current) || resources.isDisposed()) return;
            readiness.set("ready");
            state = transitionPlaybackStateV3(state, "ready");
            notify();
          }).catch((reason) => { if (operations.current(current)) fail(reason); });
        }
      } catch (reason) {
        fail(reason);
      }
      return current;
    },
    updateProject(nextProject) {
      if (resources.isDisposed()) return;
      const validation = validateRuntimeProjectV3(nextProject);
      if (!validation.ok) {
        fail(validation.diagnostics.map((diagnostic) => diagnostic.message).join("; "));
        return;
      }
      // A document patch changes plans, never transport. In particular, a
      // mute edit must not pause the composition clock or invalidate play.
      project = nextProject;
      error = undefined;
      publishAt(clock.nowUs(), token("tick"));
      notify();
    },
    play() {
      const current = token("play");
      if (!readiness.canPlay() || (state !== "ready" && state !== "paused")) return current;
      try {
        state = "preparing";
        notify();
        const starts = [options.videoSink?.start?.(current), options.audioSink?.start?.(current)]
          .filter((value): value is Promise<void> => value instanceof Promise);
        const commit = () => {
          if (!operations.current(current) || resources.isDisposed() || state !== "preparing") return;
          // Anchor the composition clock only after every backend has accepted
          // the start. Time must not advance while the engine is still
          // preparing/prerolling.
          clock.start();
          state = transitionPlaybackStateV3(state, "play");
          notify();
          schedule();
        };
        if (starts.length === 0) commit();
        else void Promise.all(starts).then(commit).catch((reason) => { if (operations.current(current)) fail(reason); });
      } catch (reason) {
        fail(reason);
      }
      return current;
    },
    pause() {
      // Invalidate first: a pending play/prepare must never be allowed to
      // publish `playing` after this pause command.
      operations.invalidate();
      const current = token("pause");
      if (state === "playing" || state === "preparing" || state === "buffering" || state === "seeking") {
        try { options.videoSink?.pause?.(current); options.audioSink?.pause?.(current); } catch (reason) { fail(reason); return current; }
        clock.pause();
        state = transitionPlaybackStateV3(state, "pause");
        notify();
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
      notify();
      clock.seek(Math.max(0, timeUs));
      try {
        options.videoSink?.flush?.(seekToken);
        options.audioSink?.flush?.(seekToken);
        publishAt(clock.nowUs(), seekToken);
        if (wasPlaying) {
          const starts = [options.videoSink?.start?.(seekToken), options.audioSink?.start?.(seekToken)].filter((value): value is Promise<void> => value instanceof Promise);
          const resume = () => { if (!operations.current(seekToken) || resources.isDisposed()) return; state = "playing"; notify(); schedule(); };
          if (starts.length === 0) resume();
          else void Promise.all(starts).then(resume).catch((reason) => { if (operations.current(seekToken)) fail(reason); });
        } else { state = "paused"; notify(); }
      } catch (reason) {
        fail(reason);
      }
      return seekToken;
    },
    setRate(rate) {
      const current = token("rate");
      if (!Number.isFinite(rate) || rate <= 0 || resources.isDisposed()) return current;
      clock.setRate?.(rate);
      notify();
      return current;
    },
    tick,
    snapshot(): PlaybackEngineSnapshot { return { state, timeUs: clock.nowUs(), generation: operations.generation(), ...(project ? { projectId: project.projectId } : {}), readiness: readiness.status(), ...(error ? { error } : {}), metrics: { ...metrics } }; },
    subscribe(listener) { listeners.add(listener); listener(engine.snapshot()); return () => listeners.delete(listener); },
    isCurrent: (candidate) => operations.current(candidate),
    complete(candidate, completion) { if (!operations.current(candidate)) { metrics.staleOperations += 1; return undefined; } return completion(); },
    dispose() { if (state === "disposed") return; if (scheduler && scheduled !== undefined) scheduler.cancel(scheduled); const current = token("pause"); options.videoSink?.pause?.(current); options.audioSink?.pause?.(current); options.videoSink?.dispose?.(); options.audioSink?.dispose?.(); resources.dispose(); state = transitionPlaybackStateV3(state, "dispose"); notify(); listeners.clear(); },
  };
  return engine;
}

export type { PlaybackEngine, PlaybackEngineOptions, PlaybackEngineSnapshot } from "./types";
