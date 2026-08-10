/**
 * Media fallback — main-thread video/texture provider for workers that
 * cannot access media APIs directly.
 *
 * §Phase 9 Task 9.4 in core-engine-tasks.md
 *
 * Workers (Web Workers, OffscreenCanvas) cannot call `document.createElement('video')`
 * or `fetch()` with certain CORS policies. This module provides an interface
 * for the main thread to pump video frames / image bitmaps into the worker
 * via transferable `VideoFrame` or `ImageBitmap` objects.
 *
 * The interface is platform-agnostic — no DOM assumptions in the type signatures.
 * Actual HTMLVideoElement usage is in the `createDOMVideoFallback` factory.
 */

// ── Opaque types (DOM-free) ──────────────────────────────────────────

export type VideoFrameProvider = {
  /** Unique ID for this provider. */
  readonly id: string;
  /** Asset URI being served. */
  readonly assetUri: string;
  /** Current video dimensions. */
  readonly width: number;
  readonly height: number;
  /** Whether a new frame is available. */
  readonly frameReady: boolean;
  /** Current source frame index. */
  readonly sourceFrame: number;

  /**
   * Seek the video to a specific time in seconds.
   */
  seek(timeSeconds: number): void;

  /**
   * Get the current frame as a transferable object.
   * Returns null if no frame is available.
   * The returned VideoFrame/ImageBitmap is transferred to the worker.
   */
  grabFrame(): VideoFrame | ImageBitmap | null;

  /** Release resources. */
  dispose(): void;
};

// ── Media fallback bridge ─────────────────────────────────────────────

export type MediaFallbackBridge = {
  /**
   * Register a video element for a given asset URI.
   * The bridge takes ownership of pumping frames.
   */
  registerVideo(
    assetUri: string,
    provider: VideoFrameProvider,
  ): void;

  /**
   * Unregister a video provider.
   */
  unregister(assetUri: string): void;

  /**
   * Get the provider for an asset URI (or null).
   */
  getProvider(assetUri: string): VideoFrameProvider | null;

  /**
   * Pump all registered videos — call on RAF.
   * This checks frameReady and transfers new frames when available.
   * Returns URIs that have new frames ready for transfer.
   */
  pump(): string[];

  /**
   * Handle a worker requesting video fallback for URIs it cannot decode.
   * Returns the URIs that were successfully resolved.
   */
  handleFallbackRequest(uris: string[]): string[];

  /**
   * Seek all registered videos to a given time (for seek/scrub).
   */
  seekAll(timeSeconds: number): void;

  /** Dispose all providers. */
  dispose(): void;
};

export function createMediaFallbackBridge(): MediaFallbackBridge {
  const providers = new Map<string, VideoFrameProvider>();

  function registerVideo(assetUri: string, provider: VideoFrameProvider): void {
    // Dispose existing provider for same URI
    const existing = providers.get(assetUri);
    if (existing) {
      try { existing.dispose(); } catch { /* ignore */ }
    }
    providers.set(assetUri, provider);
  }

  function unregister(assetUri: string): void {
    const provider = providers.get(assetUri);
    if (provider) {
      try { provider.dispose(); } catch { /* ignore */ }
    }
    providers.delete(assetUri);
  }

  function getProvider(assetUri: string): VideoFrameProvider | null {
    return providers.get(assetUri) ?? null;
  }

  function pump(): string[] {
    const ready: string[] = [];
    for (const [uri, provider] of providers) {
      if (provider.frameReady) {
        ready.push(uri);
      }
    }
    return ready;
  }

  function handleFallbackRequest(uris: string[]): string[] {
    const resolved: string[] = [];
    for (const uri of uris) {
      if (providers.has(uri)) {
        resolved.push(uri);
      }
    }
    return resolved;
  }

  function seekAll(timeSeconds: number): void {
    for (const [, provider] of providers) {
      try { provider.seek(timeSeconds); } catch { /* ignore */ }
    }
  }

  function dispose(): void {
    for (const [, provider] of providers) {
      try { provider.dispose(); } catch { /* ignore */ }
    }
    providers.clear();
  }

  return {
    registerVideo,
    unregister,
    getProvider,
    pump,
    handleFallbackRequest,
    seekAll,
    dispose,
  };
}
