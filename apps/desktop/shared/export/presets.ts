/**
 * Named export quality presets (Wave F + Logic-3).
 */

export type ExportPresetId = "preview" | "fhd" | "fhd24" | "uhd" | "4k";

export type ExportPreset = {
  id: ExportPresetId;
  label: string;
  /** Absolute fps, or null → use project fps. */
  fps: number | null;
  /** Scale vs full HD canvas (1 = FHD for 16:9, 2 = UHD/4K). */
  scale: number;
};

export const EXPORT_PRESETS: readonly ExportPreset[] = [
  { id: "preview", label: "Preview (½ res · 24fps)", fps: 24, scale: 0.5 },
  { id: "fhd", label: "Full HD (project fps)", fps: null, scale: 1 },
  { id: "fhd24", label: "Full HD · 24fps", fps: 24, scale: 1 },
  { id: "uhd", label: "UHD / 4K (project fps)", fps: null, scale: 2 },
  { id: "4k", label: "4K (project fps)", fps: null, scale: 2 },
] as const;

export const DEFAULT_EXPORT_PRESET_ID: ExportPresetId = "fhd";

export function resolveExportPreset(
  presetId: string | undefined,
): ExportPreset {
  const found = EXPORT_PRESETS.find((p) => p.id === presetId);
  return found ?? EXPORT_PRESETS.find((p) => p.id === DEFAULT_EXPORT_PRESET_ID)!;
}

/** FHD base sizes by aspect — matches render-worker sizeForAspect(scale=1). */
export function baseSizeForAspect(aspect: string): {
  width: number;
  height: number;
} {
  if (aspect === "1:1") return { width: 1080, height: 1080 };
  if (aspect === "9:16") return { width: 1080, height: 1920 };
  return { width: 1920, height: 1080 };
}

export function exportOutputSize(
  aspect: string,
  scale: number,
): { width: number; height: number } {
  const base = baseSizeForAspect(aspect);
  return {
    width: Math.round(base.width * scale),
    height: Math.round(base.height * scale),
  };
}

/** Assert UHD/4K presets produce 2160p on the long edge for 16:9. */
export function assertUhdOutputSize(size: {
  width: number;
  height: number;
}): void {
  if (size.width !== 3840 || size.height !== 2160) {
    throw new Error(
      `Expected UHD 3840×2160 for 16:9, got ${size.width}×${size.height}`,
    );
  }
}
