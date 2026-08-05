import type { MotionProject } from "@motionvideo/motion-schema";
import { COMPILED_PRESET_IDS, isCompiledPreset } from "@motionvideo/motion-compiler";
import { motionBlocks, motionLibrary } from "./library";
import type {
  BlockFamily,
  MotionBlock,
  MotionBlockIntent,
  MotionLibrarySection,
  MotionLibraryShelfId,
} from "./types";

function buildPresetRegistry(): {
  known: Set<string>;
  byPreset: Map<string, MotionBlock>;
} {
  const known = new Set<string>(COMPILED_PRESET_IDS);
  const byPreset = new Map<string, MotionBlock>();
  for (const block of motionBlocks) {
    if (block.family !== "animation" || !block.preset) continue;
    if (!isCompiledPreset(block.preset)) continue;
    if (!byPreset.has(block.preset)) byPreset.set(block.preset, block);
  }
  return { known, byPreset };
}

const { known: KNOWN_PRESET_IDS, byPreset: PRESET_TO_BLOCK } =
  buildPresetRegistry();

export { motionBlocks, motionLibrary, KNOWN_PRESET_IDS };

export function isKnownPreset(preset: string): boolean {
  return KNOWN_PRESET_IDS.has(preset);
}

export function getBlockByPreset(preset: string): MotionBlock | undefined {
  return PRESET_TO_BLOCK.get(preset);
}

export type UnknownPresetRef = {
  sceneId: string;
  nodeId: string;
  preset: string;
};

export type PresetValidationResult =
  | { ok: true; unknown: [] }
  | { ok: false; unknown: UnknownPresetRef[] };

/** Semantic check: every authoring preset must exist in the block registry. */
export function validateMotionProjectPresets(
  project: MotionProject,
): PresetValidationResult {
  const unknown: UnknownPresetRef[] = [];
  for (const scene of project.scenes) {
    for (const clip of scene.clips) {
      if (clip.source.kind === "preset") {
        if (!isKnownPreset(clip.source.presetId)) {
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

export function getMotionBlock(id: string): MotionBlock | undefined {
  return motionBlocks.find((block) => block.id === id);
}

export function listMotionBlocksByKind(
  kind: MotionBlock["kind"],
): MotionBlock[] {
  return motionBlocks.filter((b) => b.kind === kind);
}

export function listMotionBlocksByIntent(
  intent: MotionBlockIntent,
): MotionBlock[] {
  return motionBlocks.filter((b) => b.intent === intent);
}

export function listMotionBlocksByShelf(
  shelf: MotionLibraryShelfId,
): MotionBlock[] {
  return motionBlocks.filter((b) => b.shelf === shelf);
}

export function listMotionBlocksByFamily(family: BlockFamily): MotionBlock[] {
  return motionBlocks.filter((b) => b.family === family);
}

export function getMotionLibrarySection(
  id: MotionLibraryShelfId,
): MotionLibrarySection | undefined {
  return motionLibrary.find((s) => s.id === id);
}
