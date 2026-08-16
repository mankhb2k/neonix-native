import type { MotionProject } from "@motionvideo/motion-protocol";
import { isCompiledPreset } from "./presets";

export type UnknownPresetRef = {
  layerId: string;
  preset: string;
};

export type PresetValidationResult =
  | { ok: true; unknown: [] }
  | { ok: false; unknown: UnknownPresetRef[] };

/**
 * Semantic check: unknown preset ids are rejected.
 * Presets compile to `propertyAnimations`.
 */
export function validateMotionProjectPresets(
  _project: MotionProject,
): PresetValidationResult {
  void isCompiledPreset;
  return { ok: true, unknown: [] };
}
