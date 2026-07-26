export {};

export type DesktopInfo = {
  platform: string;
  version: string;
  packaged: boolean;
};

export type MotionVideoDesktop = {
  isDesktop: true;
  getInfo: () => Promise<DesktopInfo>;
  windowMinimize: () => Promise<void>;
  windowMaximize: () => Promise<boolean>;
  windowClose: () => Promise<void>;
  windowIsMaximized: () => Promise<boolean>;
};

declare global {
  interface Window {
    motionvideoDesktop?: MotionVideoDesktop;
  }
}
