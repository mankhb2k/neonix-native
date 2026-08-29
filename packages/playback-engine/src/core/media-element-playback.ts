/**
 * Browser media elements own the asynchronous play promise.  PlaybackEngine
 * owns transport intent, so a superseded play must never turn into an
 * unhandled rejection or mutate engine state from an adapter callback.
 */
export type MediaElementPlayLikeV3 = {
  play(): Promise<void> | void;
};

export type MediaElementPlayFailureV3 = {
  readonly backend: "audio" | "video";
  readonly reason: unknown;
};

export type MediaElementPlayFailureReporterV3 = (
  failure: MediaElementPlayFailureV3,
) => void;

/** Awaitable form used by a backend start/preroll operation. */
export async function awaitMediaElementPlayV3(
  element: MediaElementPlayLikeV3,
  backend: MediaElementPlayFailureV3["backend"],
  reportFailure?: MediaElementPlayFailureReporterV3,
): Promise<void> {
  try {
    await element.play();
  } catch (reason) {
    reportFailure?.({ backend, reason });
    throw reason;
  }
}

export function requestMediaElementPlayV3(
  element: MediaElementPlayLikeV3,
  backend: MediaElementPlayFailureV3["backend"],
  reportFailure?: MediaElementPlayFailureReporterV3,
): void {
  void awaitMediaElementPlayV3(element, backend, reportFailure).catch(() => {
      // AbortError is normal when an engine pause/seek overtakes play(). The
      // optional reporter lets the host surface meaningful policy failures
      // (for example NotAllowedError) without handing timing back to Chrome.
  });
}
