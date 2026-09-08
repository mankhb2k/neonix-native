"use client";

import { useCallback, useRef } from "react";
import type { TextEditOverlayHandle } from "./TextEditOverlay";
import type { RuntimeFrameV3 } from "@motionvideo/motion-runtime";

export function useTextTool() {
  const frameRef = useRef<RuntimeFrameV3 | null>(null);
  const overlayRef = useRef<TextEditOverlayHandle | null>(null);
  const onFrameReady = useCallback((frame: RuntimeFrameV3) => {
    frameRef.current = frame;
    overlayRef.current?.refresh();
  }, []);
  return { frameRef, overlayRef, onFrameReady };
}
