/**
 * Session sanitize — cleanup after editor mutations (does not strip sugar).
 */
import type { MotionLayer, MotionProject } from "@motionvideo/motion-protocol";
import { unwrapLibrarySceneWrappers } from "./group";

const DEFAULT_SHAPE_FILL = "#4A90D9";

function sanitizeLayer(layer: MotionLayer): MotionLayer {
  let next: MotionLayer = layer;
  if ("name" in next) {
    const { name: _name, ...rest } = next as MotionLayer & { name?: string };
    void _name;
    next = rest as MotionLayer;
  }
  if ("style" in next && next.style) {
    const style = { ...next.style } as Record<string, unknown>;
    let changed = false;
    if (style.fill === "") {
      if (next.type === "shape") {
        style.fill = DEFAULT_SHAPE_FILL;
      } else {
        delete style.fill;
      }
      changed = true;
    }
    if (style.stroke === "") {
      delete style.stroke;
      changed = true;
    }
    if (changed) next = { ...next, style } as MotionLayer;
  }
  if (next.type === "group") {
    return { ...next, children: next.children.map(sanitizeLayer) };
  }
  return next;
}

export function sanitizeEditorProject(project: MotionProject): MotionProject {
  const layers = unwrapLibrarySceneWrappers(project.layers).map(sanitizeLayer);
  const name = project.metadata.name.trim() || "Untitled";
  return {
    ...project,
    metadata: { ...project.metadata, name },
    layers,
  };
}

/** @deprecated Use sanitizeEditorProject for mutations; expandAuthoringToCore at save. */
export function syncProjectProtocolContract(
  project: MotionProject,
): MotionProject {
  return sanitizeEditorProject(project);
}
