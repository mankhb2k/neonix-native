/** Export result contract for the V2 Runtime IR raster path. */
export type RenderResult = {
  projectId: string;
  framesDir: string;
  frameCount: number;
  fps: number;
  width: number;
  height: number;
  durationSec: number;
};
