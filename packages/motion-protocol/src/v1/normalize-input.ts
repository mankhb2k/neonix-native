/**
 * V1 input normalizer — walks authoring trees and normalizes
 * text payloads before schema parse.
 *
 * Used at the parse boundary to convert `{ text }` payloads to
 * `{ content: { kind: "plain" } }` before Zod validation runs.
 */
import { normalizeTextPayloadInput } from "./layers/text-content";

/** Walk authoring trees and normalize text payloads before schema parse. */
export function normalizeMotionProjectInput(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const root = { ...(input as Record<string, unknown>) };

  const normalizeLayers = (layers: unknown): unknown => {
    if (!Array.isArray(layers)) return layers;
    return layers.map((node) => {
      if (!node || typeof node !== "object" || Array.isArray(node)) return node;
      const next = { ...(node as Record<string, unknown>) };
      if (next.type === "text" && next.payload != null) {
        next.payload = normalizeTextPayloadInput(next.payload);
      }
      return next;
    });
  };

  if (Array.isArray(root.scenes)) {
    root.scenes = root.scenes.map((scene) => {
      if (!scene || typeof scene !== "object" || Array.isArray(scene))
        return scene;
      const nextScene = { ...(scene as Record<string, unknown>) };
      nextScene.layers = normalizeLayers(nextScene.layers);
      return nextScene;
    });
  }

  if (Array.isArray(root.layers)) {
    root.layers = normalizeLayers(root.layers);
  }

  return root;
}
