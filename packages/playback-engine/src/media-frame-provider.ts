/**
 * MediaFrameProvider — video texture management independent of renderer.
 *
 * §Phase 7 Task 7.5 in core-engine-tasks.md
 *
 * Responsibilities:
 *   - Acquire/release video textures by asset identity
 *   - Track frame changes so renderers only update on new frames
 *   - HTMLVideoElement baseline (with requestVideoFrameCallback where available)
 *   - WebCodecs path after capability detection (stub)
 *   - CORS / decode failure / stale / dispose lifecycle
 *   - Separate audio track for video (audio is handled by AudioScheduler)
 *
 * The provider is renderer-agnostic — no Pixi, no DOM assumptions beyond
 * the HTMLVideoElement baseline. Texture handles are opaque to the consumer.
 */

// ── Opaque handle ─────────────────────────────────────────────────────

export type MediaTextureHandle = {
  /** Unique handle ID. */
  readonly id: string;
  /** Asset ID this handle belongs to. */
  readonly assetId: string;
  /** The underlying media element (HTMLVideoElement for now). */
  readonly element: HTMLVideoElement;
  /** Whether a new frame is available since last acquire. */
  frameReady: boolean;
  /** Last source frame index that was rendered. */
  lastSourceFrame: number;
};

// ── Provider options ──────────────────────────────────────────────────

export type MediaFrameProviderOptions = {
  /** Callback when a video has a new frame ready (for rVFC). */
  onFrameReady?: (handle: MediaTextureHandle) => void;
  /** Callback on load/decode errors. */
  onError?: (assetId: string, error: Error) => void;
  /** Timeout in ms for video load before giving up. */
  loadTimeoutMs?: number;
};

// ── Provider interface ────────────────────────────────────────────────

export type MediaFrameProvider = {
  /**
   * Acquire a media texture for an asset.
   * If already loaded, returns the existing handle.
   */
  acquire(
    assetId: string,
    uri: string,
    options?: {
      /** Playback rate. */
      playbackRate?: number;
      /** Whether to mute the video (audio handled separately). */
      muted?: boolean;
      /** CORS mode. Default "anonymous". */
      crossOrigin?: string;
    },
  ): MediaTextureHandle;

  /**
   * Release a media texture. Stops the video and frees resources.
   * No-op if the handle is already released.
   */
  release(handle: MediaTextureHandle): void;

  /**
   * Update the video to a specific source frame.
   * Returns true if the frame actually changed since last call.
   */
  updateFrame(
    handle: MediaTextureHandle,
    sourceFrame: number,
    fps: number,
  ): boolean;

  /**
   * Check if a new video frame is available (for rVFC-aware consumers).
   */
  pollFrameReady(handle: MediaTextureHandle): boolean;

  /**
   * Get all currently active handles.
   */
  getActiveHandles(): MediaTextureHandle[];

  /**
   * Release all handles and clean up.
   */
  dispose(): void;

  /**
   * Whether WebCodecs is available (for capability detection).
   */
  readonly webCodecsAvailable: boolean;
};

// ── HTMLVideoElement implementation ───────────────────────────────────

export function createMediaFrameProvider(
  opts?: MediaFrameProviderOptions,
): MediaFrameProvider {
  const handles = new Map<string, MediaTextureHandle>();
  const loadPromises = new Map<string, Promise<void>>();
  let handleCounter = 0;

  const onError = opts?.onError;
  const loadTimeoutMs = opts?.loadTimeoutMs ?? 30000;
  const webCodecsAvailable =
    typeof VideoDecoder !== "undefined" &&
    typeof EncodedVideoChunk !== "undefined";

  function acquire(
    assetId: string,
    uri: string,
    options?: {
      playbackRate?: number;
      muted?: boolean;
      crossOrigin?: string;
    },
  ): MediaTextureHandle {
    // Return existing handle if already loaded
    const existing = handles.get(assetId);
    if (existing) return existing;

    const id = `media:${assetId}:${++handleCounter}`;
    const video = document.createElement("video");

    video.src = uri;
    video.loop = false;
    video.muted = options?.muted ?? true; // always mute — audio via scheduler
    video.crossOrigin = options?.crossOrigin ?? "anonymous";
    video.preload = "auto";
    video.playsInline = true;

    if (options?.playbackRate) {
      video.playbackRate = options.playbackRate;
    }

    const handle: MediaTextureHandle = {
      id,
      assetId,
      element: video,
      frameReady: false,
      lastSourceFrame: -1,
    };

    handles.set(assetId, handle);

    // Start loading
    const loadPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Video load timeout: ${uri}`));
      }, loadTimeoutMs);

      const onLoaded = () => {
        clearTimeout(timeout);
        video.removeEventListener("loadeddata", onLoaded);
        video.removeEventListener("error", onErrorHandler);
        handle.frameReady = true;
        resolve();
      };

      const onErrorHandler = () => {
        clearTimeout(timeout);
        video.removeEventListener("loadeddata", onLoaded);
        video.removeEventListener("error", onErrorHandler);
        const err = new Error(
          `Video load failed: ${uri} (${video.error?.message ?? "unknown"})`,
        );
        onError?.(assetId, err);
        reject(err);
      };

      video.addEventListener("loadeddata", onLoaded, { once: false });
      video.addEventListener("error", onErrorHandler, { once: false });
    });

    loadPromises.set(assetId, loadPromise);

    // Attempt rVFC if available
    if ("requestVideoFrameCallback" in video) {
      const rvfc = () => {
        handle.frameReady = true;
        opts?.onFrameReady?.(handle);
        if (handles.has(assetId)) {
          (
            video as HTMLVideoElement & {
              requestVideoFrameCallback(cb: () => void): void;
            }
          ).requestVideoFrameCallback(rvfc);
        }
      };
      (
        video as HTMLVideoElement & {
          requestVideoFrameCallback(cb: () => void): void;
        }
      ).requestVideoFrameCallback(rvfc);
    }

    return handle;
  }

  function release(handle: MediaTextureHandle): void {
    const existing = handles.get(handle.assetId);
    if (!existing || existing.id !== handle.id) return;

    try {
      handle.element.pause();
      handle.element.removeAttribute("src");
      handle.element.load();
    } catch {
      // Best-effort cleanup
    }

    handles.delete(handle.assetId);
    loadPromises.delete(handle.assetId);
  }

  function updateFrame(
    handle: MediaTextureHandle,
    sourceFrame: number,
    fps: number,
  ): boolean {
    if (handle.lastSourceFrame === sourceFrame) return false;

    const targetTime = sourceFrame / Math.max(1, fps);

    // Seek the video to the target frame
    if (Math.abs(handle.element.currentTime - targetTime) > 0.05) {
      handle.element.currentTime = targetTime;
    }

    handle.lastSourceFrame = sourceFrame;
    return true;
  }

  function pollFrameReady(handle: MediaTextureHandle): boolean {
    const ready = handle.frameReady;
    if (ready) {
      handle.frameReady = false;
    }
    return ready;
  }

  function getActiveHandles(): MediaTextureHandle[] {
    return Array.from(handles.values());
  }

  function dispose(): void {
    for (const [, handle] of handles) {
      try {
        handle.element.pause();
        handle.element.removeAttribute("src");
        handle.element.load();
      } catch {
        // Best-effort
      }
    }
    handles.clear();
    loadPromises.clear();
  }

  return {
    acquire,
    release,
    updateFrame,
    pollFrameReady,
    getActiveHandles,
    dispose,
    webCodecsAvailable,
  };
}
