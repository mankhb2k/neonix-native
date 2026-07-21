import { motionBlocks, motionLibrary } from "./library";
import type {
  BlockFamily,
  MotionBlock,
  MotionBlockIntent,
  MotionLibrarySection,
  MotionLibraryShelfId,
} from "./types";

/** Legacy ids → current ids */
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

export { motionBlocks, motionLibrary };

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
