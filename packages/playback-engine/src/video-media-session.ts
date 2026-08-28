import type { PlaybackMediaCommandV2 } from "./media-controller-v2";
import { decideVideoPreload } from "./video-preload-policy";

type VideoFrameCallbackVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: (...args: readonly unknown[]) => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

export type VideoMediaSessionContext = {
  time: number;
  playing: boolean;
  generation: number;
  /** Optional asset ids in the decoder lookahead window. */
  preloadAssetIds?: readonly string[];
  /** Host visibility signal; hidden previews never keep video decoding. */
  hidden?: boolean;
  /** Host memory pressure signal; constrain preload to metadata. */
  memoryPressure?: boolean;
};

export type VideoMediaSessionOptions = {
  defaultFps?: number;
  playingDriftToleranceSec?: number;
  onError?: (assetId: string, error: Error) => void;
  onFrameReady?: (assetId: string, element: HTMLVideoElement) => void;
  /** Automatically pause/reduce preload when the browser tab is hidden. */
  manageVisibility?: boolean;
};

export type VideoMediaSessionStats = {
  syncCalls: number;
  activeVideos: number;
  seekRequests: number;
  suppressedSeeks: number;
  hardCorrections: number;
  playRequests: number;
  playRejections: number;
  decodedFrameCallbacks: number;
};

export type VideoMediaSession = {
  register(
    assetId: string,
    element: HTMLVideoElement,
    onFrameReady?: () => void,
  ): () => void;
  ensure(assetId: string, element: HTMLVideoElement): void;
  get(assetId: string): HTMLVideoElement | null;
  sync(
    commands: readonly PlaybackMediaCommandV2[],
    context: VideoMediaSessionContext,
  ): void;
  pauseAll(): void;
  dispose(): void;
  setMemoryPressure(pressure: boolean): void;
  getStats(): VideoMediaSessionStats;
};

type VideoEntry = {
  assetId: string;
  element: HTMLVideoElement;
  refs: number;
  onFrameReady?: () => void;
  releaseFrameTracking: () => void;
};

function errorMessage(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/**
 * Owns DOM video playback lifecycle independently of React and render backend.
 * The composition engine remains the clock; this session only handles decode,
 * drift correction, play/pause and decoded-frame readiness.
 */
export function createVideoMediaSession(
  options: VideoMediaSessionOptions = {},
): VideoMediaSession {
  const defaultFps = options.defaultFps ?? 30;
  const playingDriftToleranceSec = options.playingDriftToleranceSec ?? 0.25;
  const entries = new Map<string, VideoEntry>();
  const pendingPlayRequests = new Map<
    HTMLVideoElement,
    { generation: number; lifecycle: number }
  >();
  let lifecycleGeneration = 0;
  let latestGeneration = 0;
  let disposed = false;
  let memoryPressure = false;
  let hidden = false;
  const stats: VideoMediaSessionStats = {
    syncCalls: 0,
    activeVideos: 0,
    seekRequests: 0,
    suppressedSeeks: 0,
    hardCorrections: 0,
    playRequests: 0,
    playRejections: 0,
    decodedFrameCallbacks: 0,
  };

  const trackFrames = (
    assetId: string,
    element: HTMLVideoElement,
    onFrameReady?: () => void,
  ): (() => void) => {
    const target = element as VideoFrameCallbackVideo;
    let active = true;
    let callbackHandle: number | null = null;
    const notify = () => {
      if (!active) return;
      stats.decodedFrameCallbacks += 1;
      onFrameReady?.();
      options.onFrameReady?.(assetId, element);
    };
    const request = () => {
      if (!active || typeof target.requestVideoFrameCallback !== "function") return;
      callbackHandle = target.requestVideoFrameCallback(() => {
        callbackHandle = null;
        notify();
        request();
      });
    };
    if (typeof target.requestVideoFrameCallback === "function") {
      request();
      return () => {
        active = false;
        if (callbackHandle != null) target.cancelVideoFrameCallback?.(callbackHandle);
        callbackHandle = null;
      };
    }
    const onTimeUpdate = () => notify();
    const onSeeked = () => notify();
    // Keep the session usable with lightweight host/test doubles that expose
    // the media properties but not the full EventTarget surface.
    const addEventListener = (element as HTMLVideoElement & {
      addEventListener?: typeof element.addEventListener;
    }).addEventListener;
    const removeEventListener = (element as HTMLVideoElement & {
      removeEventListener?: typeof element.removeEventListener;
    }).removeEventListener;
    if (typeof addEventListener !== "function") return () => undefined;
    addEventListener.call(element, "timeupdate", onTimeUpdate);
    addEventListener.call(element, "seeked", onSeeked);
    return () => {
      active = false;
      removeEventListener?.call(element, "timeupdate", onTimeUpdate);
      removeEventListener?.call(element, "seeked", onSeeked);
    };
  };

  const disposeEntry = (entry: VideoEntry): void => {
    entry.releaseFrameTracking();
    try {
      entry.element.pause();
    } catch {
      // Best-effort pause during lifecycle cleanup.
    }
  };

  const applyPreloadPolicy = (
    activeIds: ReadonlySet<string>,
    lookaheadIds: ReadonlySet<string>,
    playing: boolean,
    hiddenSignal: boolean,
  ): void => {
    for (const [assetId, entry] of entries) {
      const decision = decideVideoPreload({
        active: activeIds.has(assetId),
        lookahead: lookaheadIds.has(assetId),
        playing,
        hidden: hiddenSignal,
        memoryPressure,
      });
      entry.element.preload = decision.preload;
      if (decision.shouldPause && !entry.element.paused) entry.element.pause();
    }
  };

  const visibilityTarget = options.manageVisibility === false || typeof document === "undefined"
    ? null
    : document;
  const onVisibilityChange = () => {
    hidden = visibilityTarget?.hidden ?? false;
    if (hidden) {
      lifecycleGeneration += 1;
      pendingPlayRequests.clear();
      for (const entry of entries.values()) entry.element.pause();
      applyPreloadPolicy(new Set(), new Set(), false, true);
    }
  };
  visibilityTarget?.addEventListener("visibilitychange", onVisibilityChange);

  const register = (
    assetId: string,
    element: HTMLVideoElement,
    onFrameReady?: () => void,
  ): (() => void) => {
    if (disposed) return () => undefined;
    const existing = entries.get(assetId);
    if (existing && existing.element === element) {
      existing.refs += 1;
      existing.onFrameReady = onFrameReady;
      return () => {
        existing.refs = Math.max(0, existing.refs - 1);
        if (existing.refs === 0 && entries.get(assetId) === existing) {
          entries.delete(assetId);
          disposeEntry(existing);
        }
      };
    }
    if (existing) {
      entries.delete(assetId);
      disposeEntry(existing);
    }
    element.muted = true;
    const entry: VideoEntry = {
      assetId,
      element,
      refs: 1,
      onFrameReady,
      releaseFrameTracking: () => undefined,
    };
    entry.releaseFrameTracking = trackFrames(assetId, element, onFrameReady);
    entries.set(assetId, entry);
    return () => {
      if (entries.get(assetId) !== entry) return;
      entry.refs = Math.max(0, entry.refs - 1);
      if (entry.refs === 0) {
        entries.delete(assetId);
        disposeEntry(entry);
      }
    };
  };

  return {
    register,
    ensure(assetId, element) {
      if (disposed) return;
      const existing = entries.get(assetId);
      if (existing?.element === element) return;
      if (existing) {
        entries.delete(assetId);
        disposeEntry(existing);
      }
      element.muted = true;
      const entry: VideoEntry = {
        assetId,
        element,
        refs: 0,
        releaseFrameTracking: () => undefined,
      };
      entry.releaseFrameTracking = trackFrames(assetId, element);
      entries.set(assetId, entry);
    },
    get(assetId) {
      return entries.get(assetId)?.element ?? null;
    },
    sync(commands, context) {
      stats.syncCalls += 1;
      if (context.generation < latestGeneration) return;
      latestGeneration = context.generation;
      const active = new Set<string>();
      for (const command of commands) {
        if (command.mediaVisible === false || !command.uri) continue;
        const entry = entries.get(command.assetId);
        if (!entry) continue;
        active.add(command.assetId);
        const element = entry.element;
        const targetTime = Math.max(0, command.mediaTime);
        const drift = Math.abs(element.currentTime - targetTime);
        if (context.playing) {
          const threshold = element.paused
            ? 1 / Math.max(1, defaultFps)
            : playingDriftToleranceSec;
          if (drift > threshold) {
            if (element.seeking) {
              stats.suppressedSeeks += 1;
            } else {
              element.currentTime = targetTime;
              stats.seekRequests += 1;
              if (!element.paused) stats.hardCorrections += 1;
            }
          }
          if (element.paused && !pendingPlayRequests.has(element)) {
            const token = { generation: context.generation, lifecycle: lifecycleGeneration };
            pendingPlayRequests.set(element, token);
            stats.playRequests += 1;
            void element.play()
              .then(() => {
                if (
                  token.lifecycle !== lifecycleGeneration
                  || token.generation !== latestGeneration
                ) element.pause();
              })
              .catch((error: unknown) => {
                stats.playRejections += 1;
                options.onError?.(command.assetId, errorMessage(error));
              })
              .finally(() => pendingPlayRequests.delete(element));
          }
        } else {
          element.pause();
          if (!element.seeking && drift > 0.0005) {
            element.currentTime = targetTime;
            stats.seekRequests += 1;
          } else if (element.seeking && drift > 0.0005) {
            stats.suppressedSeeks += 1;
          }
        }
      }
      for (const [assetId, entry] of entries) {
        if (!active.has(assetId)) entry.element.pause();
      }
      const lookahead = new Set(context.preloadAssetIds ?? []);
      hidden = context.hidden ?? hidden;
      applyPreloadPolicy(active, lookahead, context.playing, hidden);
      stats.activeVideos = active.size;
    },
    pauseAll() {
      lifecycleGeneration += 1;
      pendingPlayRequests.clear();
      for (const entry of entries.values()) entry.element.pause();
    },
    setMemoryPressure(pressure) {
      memoryPressure = pressure;
      const active = new Set<string>();
      for (const entry of entries.values()) {
        if (!entry.element.paused) active.add(entry.assetId);
      }
      applyPreloadPolicy(active, new Set(), !hidden, hidden);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      lifecycleGeneration += 1;
      pendingPlayRequests.clear();
      for (const entry of entries.values()) disposeEntry(entry);
      entries.clear();
      visibilityTarget?.removeEventListener("visibilitychange", onVisibilityChange);
      stats.activeVideos = 0;
    },
    getStats() {
      return { ...stats };
    },
  };
}
