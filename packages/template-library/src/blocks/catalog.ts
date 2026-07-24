import type { MotionProject } from "@motionvideo/motion-schema";
import { motionBlocks, motionLibrary } from "./library";
import type {
  BlockFamily,
  MotionBlock,
  MotionBlockIntent,
  MotionLibrarySection,
  MotionLibraryShelfId,
} from "./types";

/** Legacy block ids → current ids */
const BLOCK_ID_ALIASES: Record<string, string> = {
  "text.typing": "text.typewriter",
  "text.fade": "enter.fade-in",
  "text.fade-in": "enter.fade-in",
  "text.fade-up": "enter.fade-up",
  "text.fade-down": "enter.fade-down",
  "text.fade-left": "enter.fade-left",
  "text.fade-right": "enter.fade-right",
  "text.scale-in": "enter.scale-in",
  "text.zoom-in": "enter.zoom-in",
  "text.slide-up": "enter.slide-up",
  "text.slide-left": "enter.slide-left",
  "text.slide-right": "enter.slide-right",
  "text.pop": "enter.pop",
  "text.bounce-in": "enter.bounce-in",
  "text.flip": "enter.flip",
  "text.rotate-in": "enter.rotate-in",
};

/**
 * Legacy animation.preset strings → canonical preset on a MotionBlock.
 * Schema accepts any string; product code resolves via this map.
 */
const PRESET_ALIASES: Record<string, string> = {
  fade: "fade-in",
  scale: "scale-in",
  typing: "typewriter",
  "price-pop": "pop",
  "cta-slide": "slide-up",
  "logo-reveal": "fade-in",
};

function buildPresetRegistry(): {
  known: Set<string>;
  byPreset: Map<string, MotionBlock>;
} {
  const known = new Set<string>();
  const byPreset = new Map<string, MotionBlock>();
  for (const block of motionBlocks) {
    if (block.family !== "animation" || !block.preset) continue;
    known.add(block.preset);
    if (!byPreset.has(block.preset)) byPreset.set(block.preset, block);
  }
  for (const [alias, canonical] of Object.entries(PRESET_ALIASES)) {
    if (known.has(canonical)) known.add(alias);
  }
  return { known, byPreset };
}

const { known: KNOWN_PRESET_IDS, byPreset: PRESET_TO_BLOCK } =
  buildPresetRegistry();

export { motionBlocks, motionLibrary, KNOWN_PRESET_IDS };

export function resolvePresetId(preset: string): string {
  return PRESET_ALIASES[preset] ?? preset;
}

export function isKnownPreset(preset: string): boolean {
  return KNOWN_PRESET_IDS.has(preset) || KNOWN_PRESET_IDS.has(resolvePresetId(preset));
}

export function getBlockByPreset(preset: string): MotionBlock | undefined {
  const canonical = resolvePresetId(preset);
  return PRESET_TO_BLOCK.get(canonical) ?? PRESET_TO_BLOCK.get(preset);
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
  const resolved = BLOCK_ID_ALIASES[id] ?? id;
  return motionBlocks.find((b) => b.id === resolved);
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
