import { resolveAudioWindow, resolveVideoAt } from "@motionvideo/motion-runtime";
import { createFakeClock } from "../clock/index";
import { createOperationRegistry, createResourceDisposalGuard } from "./operation-token";
import { createReadinessCoordinator } from "./readiness-coordinator";
import type { PlaybackEngineNext, PlaybackEngineNextOptions, PlaybackEngineNextSnapshot, PlaybackOperationTokenV3, PlaybackEngineNextState } from "./types";

export function createPlaybackEngineNext(options: PlaybackEngineNextOptions = {}): PlaybackEngineNext {
  const clock = options.clock ?? createFakeClock();
  const scheduler = options.scheduler;
  const operations = createOperationRegistry();
  const resources = createResourceDisposalGuard();
  const readiness = createReadinessCoordinator("unknown");
  let project: Parameters<PlaybackEngineNext["load"]>[0] | undefined;
  let state: PlaybackEngineNextState = "idle";
  let scheduled: number | undefined;
  const metrics = { ticks: 0, publishedVideoPlans: 0, publishedAudioPlans: 0, staleOperations: 0, seeks: 0, underruns: 0 };
  const token = (kind: PlaybackOperationTokenV3["kind"]) => operations.begin(kind);
  const schedule = () => { if (scheduler && scheduled === undefined && state === "playing") scheduled = scheduler.request(() => { scheduled = undefined; tick(); }); };
  const tick = () => {
    if (state !== "playing" || !project || resources.isDisposed()) return;
    metrics.ticks += 1;
    const current = token("tick");
    const timeUs = clock.nowUs();
    options.videoSink?.publish(resolveVideoAt(project, timeUs), current);
    metrics.publishedVideoPlans += options.videoSink ? 1 : 0;
    const startSample = Math.floor(timeUs / 1_000_000 * 48000);
    const endSample = startSample + (options.audioWindowSamples ?? 2048);
    options.audioSink?.publish(resolveAudioWindow(project, { startSample, endSample }), current);
    metrics.publishedAudioPlans += options.audioSink ? 1 : 0;
    schedule();
  };
  const engine: PlaybackEngineNext = {
    load(nextProject) { if (resources.isDisposed()) return token("load"); operations.invalidate(); const current = token("load"); state = "loading"; project = nextProject; clock.seek(0); readiness.set("ready"); state = "ready"; return current; },
    play() { const current = token("play"); if (state === "ready" || state === "paused") { clock.setPlaying(true); state = "playing"; schedule(); } return current; },
    pause() { const current = token("pause"); if (state === "playing") { clock.setPlaying(false); state = "paused"; if (scheduler && scheduled !== undefined) scheduler.cancel(scheduled); scheduled = undefined; } return current; },
    seek(timeUs) { const current = token("seek"); if (!project || resources.isDisposed()) return current; operations.invalidate(); const seekToken = token("seek"); metrics.seeks += 1; const wasPlaying = state === "playing"; state = "seeking"; clock.seek(Math.max(0, timeUs)); const nowUs = clock.nowUs(); options.videoSink?.publish(resolveVideoAt(project, nowUs), seekToken); const startSample = Math.floor(nowUs / 1_000_000 * 48000); options.audioSink?.publish(resolveAudioWindow(project, { startSample, endSample: startSample + (options.audioWindowSamples ?? 2048) }), seekToken); state = wasPlaying ? "playing" : "paused"; return seekToken; },
    tick,
    snapshot(): PlaybackEngineNextSnapshot { return { state, timeUs: clock.nowUs(), generation: operations.generation(), ...(project ? { projectId: project.projectId } : {}), readiness: readiness.status(), metrics: { ...metrics } }; },
    isCurrent: (candidate) => operations.current(candidate),
    complete(candidate, completion) { if (!operations.current(candidate)) { metrics.staleOperations += 1; return undefined; } return completion(); },
    dispose() { if (state === "disposed") return; if (scheduler && scheduled !== undefined) scheduler.cancel(scheduled); options.videoSink?.dispose?.(); options.audioSink?.dispose?.(); resources.dispose(); state = "disposed"; },
  };
  return engine;
}

export type { PlaybackEngineNext, PlaybackEngineNextOptions, PlaybackEngineNextSnapshot } from "./types";
