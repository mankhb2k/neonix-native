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

export function requestMediaElementPlayV3(
  element: MediaElementPlayLikeV3,
  backend: MediaElementPlayFailureV3["backend"],
  reportFailure?: MediaElementPlayFailureReporterV3,
): void {
  try {
    Promise.resolve(element.play()).catch((reason: unknown) => {
      // AbortError is normal when an engine pause/seek overtakes play(). The
      // optional reporter lets the host surface meaningful policy failures
      // (for example NotAllowedError) without handing timing back to Chrome.
      reportFailure?.({ backend, reason });
    });
  } catch (reason) {
    reportFailure?.({ backend, reason });
  }
}
