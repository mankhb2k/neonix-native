import type { AspectRatio } from "@motionvideo/shared";

export type EncodedFile = {
  path: string;
  aspectRatio: AspectRatio;
};

/** Placeholder for FFmpeg mux / multi-aspect export */
export async function encodeOutputs(
  _renderResult: { projectId: string },
  aspectRatio: AspectRatio,
): Promise<EncodedFile[]> {
  return [{ path: `tmp/${_renderResult.projectId}.mp4`, aspectRatio }];
}
