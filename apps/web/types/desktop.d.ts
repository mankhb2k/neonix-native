export {};

type MotionVideoDesktop = {
  isDesktop: true;
  getInfo: () => Promise<{
    platform: string;
    version: string;
    packaged: boolean;
  }>;
  windowMinimize?: () => Promise<void>;
  windowMaximize?: () => Promise<boolean>;
  windowClose?: () => Promise<void>;
  windowIsMaximized?: () => Promise<boolean>;
};

declare global {
  interface Window {
    motionvideoDesktop?: MotionVideoDesktop;
  }
}
