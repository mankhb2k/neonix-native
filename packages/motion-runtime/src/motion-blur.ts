export type MotionBlurSettings = {
  enabled: boolean;
  shutterAngle: number; // e.g. 180 degrees
  sampleCount: number;  // e.g. 8 samples per frame
};

export function calculateMotionBlurTimestamps(
  frameTime: number,
  fps: number,
  settings: MotionBlurSettings = { enabled: false, shutterAngle: 180, sampleCount: 4 },
): number[] {
  if (!settings.enabled || settings.sampleCount <= 1) return [frameTime];
  const frameDuration = 1 / fps;
  const shutterOpenDuration = (settings.shutterAngle / 360) * frameDuration;
  const startTime = frameTime - shutterOpenDuration / 2;
  const step = shutterOpenDuration / (settings.sampleCount - 1);

  const times: number[] = [];
  for (let i = 0; i < settings.sampleCount; i += 1) {
    times.push(startTime + i * step);
  }
  return times;
}
