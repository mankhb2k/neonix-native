/// <reference types="vite/client" />

import type { MotionVideoDesktopBridge } from "../../src/shared/ipc/contracts";

declare global {
  interface Window {
    motionvideoDesktop?: MotionVideoDesktopBridge;
  }
}

export {};
