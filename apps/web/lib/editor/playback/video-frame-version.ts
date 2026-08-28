type VideoFrameCallbackVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: () => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

/** Track decoded video frames without making rVFC the composition clock. */
export function trackVideoFrameVersion(
  video: HTMLVideoElement,
  onDecodedFrame: () => void,
): () => void {
  const target = video as VideoFrameCallbackVideo;
  let active = true;
  let callbackHandle: number | null = null;
  const request = () => {
    if (!active || typeof target.requestVideoFrameCallback !== "function") return;
    callbackHandle = target.requestVideoFrameCallback(() => {
      callbackHandle = null;
      if (!active) return;
      onDecodedFrame();
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
  const onTimeUpdate = () => {
    if (active) onDecodedFrame();
  };
  video.addEventListener("timeupdate", onTimeUpdate);
  return () => {
    active = false;
    video.removeEventListener("timeupdate", onTimeUpdate);
  };
}
