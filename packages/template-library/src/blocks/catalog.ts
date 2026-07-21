import { motionBlocks, motionLibrary } from "./library";
import type {
  MotionBlock,
  MotionBlockIntent,
  MotionLibrarySection,
  MotionLibraryShelfId,
} from "./types";

/** Legacy ids → current ids */
const BLOCK_ID_ALIASES: Record<string, string> = {
  "text.fade": "text.fade-in",
  "text.typing": "text.typewriter",
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

export function getMotionLibrarySection(
  id: MotionLibraryShelfId,
): MotionLibrarySection | undefined {
  return motionLibrary.find((s) => s.id === id);
}
