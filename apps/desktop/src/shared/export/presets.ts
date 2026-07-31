/**
 * Named export quality presets (Wave F).
 */

export type ExportPresetId = "preview" | "fhd" | "fhd24";

export type ExportPreset = {
  id: ExportPresetId;
  label: string;
  /** Absolute fps, or null → use project fps. */
  fps: number | null;
  /** Scale vs full HD canvas (1 = FHD for 16:9). */
  scale: number;
};

export const EXPORT_PRESETS: readonly ExportPreset[] = [
  { id: "preview", label: "Preview (½ res · 24fps)", fps: 24, scale: 0.5 },
  { id: "fhd", label: "Full HD (project fps)", fps: null, scale: 1 },
  { id: "fhd24", label: "Full HD · 24fps", fps: 24, scale: 1 },
] as const;

export const DEFAULT_EXPORT_PRESET_ID: ExportPresetId = "fhd";

export function resolveExportPreset(
  presetId: string | undefined,
): ExportPreset {
  const found = EXPORT_PRESETS.find((p) => p.id === presetId);
  return found ?? EXPORT_PRESETS.find((p) => p.id === DEFAULT_EXPORT_PRESET_ID)!;
}
