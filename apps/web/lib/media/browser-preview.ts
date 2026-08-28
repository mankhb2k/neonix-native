export type BrowserVideoPreview = {
  poster: Blob | null;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  error?: string;
};

const POSTER_MAX_WIDTH = 320;
const POSTER_TYPE = "image/webp";
const MEDIA_TIMEOUT_MS = 15_000;
const DEBUG_VIDEO_PREVIEW = process.env.NODE_ENV !== "production";

function debugVideoPreview(message: string, details?: unknown) {
  if (!DEBUG_VIDEO_PREVIEW) return;
  // Do not print source URLs because remote sources may contain signed query
  // credentials.
  // eslint-disable-next-line no-console
  console.log(`[video-preview] ${message}`, details ?? "");
}

type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (
    callback: (now: number, metadata: VideoFrameCallbackMetadata) => void,
  ) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

function waitForEvent<T extends Event>(
  target: EventTarget,
  eventName: string,
  timeoutMs = MEDIA_TIMEOUT_MS,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out while waiting for ${eventName}`));
    }, timeoutMs);

    const cleanup = () => {
      target.removeEventListener(eventName, onEvent);
      target.removeEventListener("error", onError);
      if (timeout) clearTimeout(timeout);
    };
    const onEvent = (event: Event) => {
      cleanup();
      resolve(event as T);
    };
    const onError = () => {
      cleanup();
      reject(new Error(`Unable to decode media while waiting for ${eventName}`));
    };

    target.addEventListener(eventName, onEvent, { once: true });
    target.addEventListener("error", onError, { once: true });
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Unable to encode media poster"))),
      POSTER_TYPE,
      0.82,
    );
  });
}

/**
 * `loadeddata` means that a decoded frame is available to the media element,
 * but it does not guarantee that the frame has reached the compositor yet.
 * Drawing at that point can produce a valid, all-black canvas in Chromium.
 * Wait for the compositor callback and keep playback muted so this helper
 * never leaks audio or violates autoplay policy.
 */
async function waitForPresentedVideoFrame(video: HTMLVideoElement): Promise<void> {
  const frameVideo = video as VideoWithFrameCallback;
  if (typeof frameVideo.requestVideoFrameCallback === "function") {
    debugVideoPreview("waiting for compositor frame");
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error("Timed out while waiting for the first video frame"));
      }, MEDIA_TIMEOUT_MS);
      frameVideo.requestVideoFrameCallback(() => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve();
      });
    });
    return;
  }

  // Older browsers do not expose requestVideoFrameCallback. Two animation
  // frames let the decoded frame reach the canvas without requiring playback.
  if (typeof requestAnimationFrame !== "function") return;
  debugVideoPreview("waiting for animation frame fallback");
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/**
 * Reads lightweight metadata and decodes only the first video frame locally.
 * The source file is never uploaded or fetched by this helper.
 */
export async function createBrowserVideoPreview(file: File): Promise<BrowserVideoPreview> {
  const objectUrl = URL.createObjectURL(file);
  return createBrowserVideoPreviewFromSource(objectUrl, true);
}

/**
 * Captures the first frame from a CORS-enabled remote source. This is used as
 * an ephemeral fallback for videos uploaded before poster metadata existed;
 * callers may persist the returned WebP through the authenticated preview API.
 */
export async function createBrowserVideoPreviewFromUrl(url: string): Promise<BrowserVideoPreview> {
  return createBrowserVideoPreviewFromSource(url, false);
}

async function createBrowserVideoPreviewFromSource(
  source: string,
  revokeSource: boolean,
): Promise<BrowserVideoPreview> {
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  if (!revokeSource) video.crossOrigin = "anonymous";

  try {
    debugVideoPreview("loading source", { remote: !revokeSource });
    video.src = source;
    video.load();
    await waitForEvent<Event>(video, "loadedmetadata");

    const durationMs = Number.isFinite(video.duration) && video.duration >= 0
      ? Math.round(video.duration * 1000)
      : null;
    const width = video.videoWidth > 0 ? video.videoWidth : null;
    const height = video.videoHeight > 0 ? video.videoHeight : null;
    debugVideoPreview("metadata ready", {
      durationMs,
      width,
      height,
      readyState: video.readyState,
      networkState: video.networkState,
    });

    if (!width || !height) {
      return { poster: null, durationMs, width, height, error: "Video dimensions are unavailable" };
    }

    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      await waitForEvent<Event>(video, "loadeddata");
    }

    // A source can already be positioned at zero and not emit `seeked`.
    if (video.currentTime !== 0) {
      video.currentTime = 0;
      await waitForEvent<Event>(video, "seeked");
    }

    // A muted play is allowed by browser autoplay policy and ensures Chrome
    // presents the first decoded frame before canvas capture. Pause before
    // returning so this utility never starts background playback.
    const playableVideo = video as HTMLVideoElement & {
      play?: () => Promise<void>;
      pause?: () => void;
    };
    let startedPlayback = false;
    if (typeof playableVideo.play === "function") {
      try {
        await playableVideo.play();
        startedPlayback = true;
        debugVideoPreview("muted playback started");
      } catch {
        debugVideoPreview("muted playback rejected; trying compositor frame directly");
        // A browser may still reject play despite muted=true; the compositor
        // callback below can capture an already decoded paused frame.
      }
    }
    await waitForPresentedVideoFrame(video);
    if (startedPlayback && typeof playableVideo.pause === "function") {
      playableVideo.pause();
    }

    const canvas = document.createElement("canvas");
    const scale = Math.min(1, POSTER_MAX_WIDTH / width);
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context is unavailable");

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const poster = await canvasToBlob(canvas);
    debugVideoPreview("poster encoded", { bytes: poster.size, width: canvas.width, height: canvas.height });
    return { poster, durationMs, width, height };
  } catch (error) {
    debugVideoPreview("capture failed", {
      error: error instanceof Error ? error.message : String(error),
      readyState: video.readyState,
      networkState: video.networkState,
      mediaError: video.error?.code ?? null,
    });
    return {
      poster: null,
      durationMs: Number.isFinite(video.duration) && video.duration >= 0
        ? Math.round(video.duration * 1000)
        : null,
      width: video.videoWidth || null,
      height: video.videoHeight || null,
      error: error instanceof Error ? error.message : "Unable to create video poster",
    };
  } finally {
    video.removeAttribute("src");
    video.load();
    if (revokeSource) URL.revokeObjectURL(source);
  }
}
