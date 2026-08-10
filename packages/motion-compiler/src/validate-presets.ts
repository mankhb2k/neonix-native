import type { MotionProject } from "@motionvideo/motion-protocol";
import { isCompiledPreset } from "./presets";

export type UnknownPresetRef = {
  sceneId: string;
  nodeId: string;
  preset: string;
};

export type PresetValidationResult =
  | { ok: true; unknown: [] }
  | { ok: false; unknown: UnknownPresetRef[] };

/**
 * Semantic check: every Clip.source.presetId must be in the compiler allowlist.
 */
export function validateMotionProjectPresets(
  project: MotionProject,
): PresetValidationResult {
  const unknown: UnknownPresetRef[] = [];
  for (const scene of project.scenes) {
    for (const clip of scene.clips) {
      if (clip.source.kind === "preset") {
        if (!isCompiledPreset(clip.source.presetId)) {
          unknown.push({
            sceneId: scene.id,
            nodeId: clip.targetId ?? clip.id,
            preset: clip.source.presetId,
          });
        }
      }
    }
  }
  if (unknown.length === 0) return { ok: true, unknown: [] };
  return { ok: false, unknown };
}
