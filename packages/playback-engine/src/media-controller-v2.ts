import type { RuntimeFrameV2 } from "@motionvideo/motion-runtime";
import { createMediaFrameProvider, type MediaFrameProvider } from "./media-frame-provider";
import {
  createVideoMediaSession,
  type VideoMediaSession,
  type VideoMediaSessionOptions,
  type VideoMediaSessionStats,
} from "./video-media-session";

/** A video paint command that a media adapter may make visible at a tick. */
export type PlaybackMediaCommandV2 = Extract<
  RuntimeFrameV2["commands"][number],
  { op: "drawVideo" }
>;

export type PlaybackMediaSyncContextV2 = {
  /** Composition time represented by the frame. */
  time: number;
  /** Whether the shared engine clock is actively running. */
  playing: boolean;
  /** Monotonic engine generation; stale async media work must not win. */
  generation: number;
};

export type PlaybackMediaStatsV2 = VideoMediaSessionStats;

/**
 * Transport-facing media boundary. The controller delegates all DOM video
 * ownership, drift correction, rVFC tracking and stale guards to one session.
 */
export type PlaybackMediaControllerV2 = {
  sync(
    commands: readonly PlaybackMediaCommandV2[],
    context: PlaybackMediaSyncContextV2,
  ): void | Promise<void>;
  pauseAll(): void;
  dispose(): void;
  getStats?(): PlaybackMediaStatsV2;
};

export type DOMMediaControllerV2Options = {
  /** Reuse a host-owned decoded video element when one already exists. */
  resolveVideo?: (assetId: string) => HTMLVideoElement | null | undefined;
  /** Override the source frame rate when a paint command has no metadata. */
  defaultFps?: number;
  /** Drift tolerated during playback before performing a disruptive seek. */
  playingDriftToleranceSec?: number;
  provider?: MediaFrameProvider;
  session?: VideoMediaSession;
  onFrameReady?: (assetId: string, element: HTMLVideoElement) => void;
  onError?: (assetId: string, error: Error) => void;
};

/**
 * Browser media adapter for the shared transport. The composition engine is
 * the clock; VideoMediaSession is the only owner of DOM media lifecycle.
 */
export function createDOMMediaControllerV2(
  options: DOMMediaControllerV2Options = {},
): PlaybackMediaControllerV2 {
  const provider = options.provider ?? createMediaFrameProvider({ onError: options.onError });
  const sessionOptions: VideoMediaSessionOptions = {
    defaultFps: options.defaultFps,
    playingDriftToleranceSec: options.playingDriftToleranceSec,
    onError: options.onError,
    onFrameReady: options.onFrameReady,
  };
  const session = options.session ?? createVideoMediaSession(sessionOptions);

  return {
    sync(commands, context) {
      for (const command of commands) {
        if (command.mediaVisible === false || !command.uri) continue;
        const existing = options.resolveVideo?.(command.assetId);
        const handle = existing || options.resolveVideo
          ? null
          : provider.acquire(command.assetId, command.uri, { muted: true });
        const element = existing ?? handle?.element;
        if (!element) continue;
        // Registration is normally performed by PlaybackController for the
        // editor host path. ensure() covers standalone/fallback consumers.
        session.ensure(command.assetId, element);
      }
      session.sync(commands, context);
    },
    pauseAll: () => session.pauseAll(),
    dispose: () => {
      session.dispose();
      provider.dispose();
    },
    getStats: () => session.getStats(),
  };
}

export {
  createVideoMediaSession,
  type VideoMediaSession,
  type VideoMediaSessionContext,
  type VideoMediaSessionOptions,
  type VideoMediaSessionStats,
} from "./video-media-session";
