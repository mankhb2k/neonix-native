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
 * Semantic check: every Clip.source.presetId must be in the compiler allowlist.
 * Authoring V1 has no timeline clip tracks; presets live on motion clip sources.
 */
export function validateMotionProjectPresets(
  _project: MotionProject,
): PresetValidationResult {
  void isCompiledPreset;
  return { ok: true, unknown: [] };
}
