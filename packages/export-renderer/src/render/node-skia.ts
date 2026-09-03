import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { SkiaCanvasKit } from "@motionvideo/skia-renderer";

type CanvasKitFactory = (options: { locateFile: (file: string) => string }) => Promise<SkiaCanvasKit>;

const require = createRequire(import.meta.url);

/** Loads the same CanvasKit-WASM build used by the browser preview, in Node. */
export async function loadNodeCanvasKit(): Promise<SkiaCanvasKit> {
  let entry: string;
  try {
    entry = require.resolve("canvaskit-wasm/bin/canvaskit.js");
  } catch (error) {
    throw new Error(`export-renderer: canvaskit-wasm is not installed: ${String(error)}`);
  }
  const factory = require(entry) as CanvasKitFactory;
  const binRoot = dirname(entry);
  return factory({ locateFile: (file) => join(binRoot, file) });
}

export type NodeSkiaCanvas = {
  width: number;
  height: number;
};

export function createNodeSkiaCanvas(): NodeSkiaCanvas {
  return { width: 1, height: 1 };
}
