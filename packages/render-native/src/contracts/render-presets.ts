/** Closed render presets for create-job (architecture §6.1). */

export const RENDER_PRESETS = Object.freeze([
  "preview-720p",
  "export-1080p",
  "export-4k",
] as const);

export type RenderPresetId = (typeof RENDER_PRESETS)[number];

export function isRenderPresetId(value: string): value is RenderPresetId {
  return (RENDER_PRESETS as readonly string[]).includes(value);
}

export type RenderPresetSpec = {
  id: RenderPresetId;
  width: number;
  height: number;
  fps: number;
  codec: "h264" | "h265" | "vp9" | "prores";
  pixelFormat: string;
};

export const RENDER_PRESET_SPECS: Record<RenderPresetId, RenderPresetSpec> = {
  "preview-720p": {
    id: "preview-720p",
    width: 720,
    height: 1280,
    fps: 30,
    codec: "h264",
    pixelFormat: "yuv420p",
  },
  "export-1080p": {
    id: "export-1080p",
    width: 1080,
    height: 1920,
    fps: 30,
    codec: "h264",
    pixelFormat: "yuv420p",
  },
  "export-4k": {
    id: "export-4k",
    width: 2160,
    height: 3840,
    fps: 30,
    codec: "h264",
    pixelFormat: "yuv420p",
  },
};
