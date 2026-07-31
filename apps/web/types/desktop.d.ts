export {};

type DesktopInfo = {
  platform: string;
  version: string;
  packaged: boolean;
  renderer?: "legacy" | "vite";
};

/** Flat legacy surface (Phase 0/1) — web consumers keep using these. */
type MotionVideoDesktopFlat = {
  isDesktop: true;
  getInfo: () => Promise<DesktopInfo>;
  windowMinimize?: () => Promise<void>;
  windowMaximize?: () => Promise<boolean>;
  windowClose?: () => Promise<void>;
  windowIsMaximized?: () => Promise<boolean>;
  onRequestCloseSave?: (cb: () => void) => () => void;
  confirmClose?: (ok: boolean) => Promise<void>;
};

/** Nested Phase 2 API — optional on the same bridge object. */
type MotionVideoDesktopNested = {
  app?: {
    getInfo(): Promise<DesktopInfo>;
  };
  window?: {
    minimize(): Promise<void>;
    toggleMaximize(): Promise<boolean>;
    close(): Promise<void>;
    isMaximized(): Promise<boolean>;
    onRequestCloseSave(cb: () => void): () => void;
    confirmClose(ok: boolean): Promise<void>;
  };
};

type MotionVideoDesktop = MotionVideoDesktopFlat & MotionVideoDesktopNested;

declare global {
  interface Window {
    motionvideoDesktop?: MotionVideoDesktop;
  }
}
