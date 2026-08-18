import {
  declareUsedCapabilities,
  type MotionLayer,
  type MotionProject,
} from "@motionvideo/motion-protocol";
import { unwrapLibrarySceneWrappers } from "./group";

const DEFAULT_SHAPE_FILL = "#4A90D9";

function dropEmptyTokenRecord(
  record: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!record) return record;
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value.length > 0) next[key] = value;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

/**
 * Protocol cấm chuỗi tùy chọn có mặt nhưng rỗng (`name: ""`, `fill: ""`).
 * Editor bỏ qua hoặc thay thế chúng để compile/preview không bao giờ thấy JSON không hợp lệ.
 */
function sanitizeLayer(layer: MotionLayer): MotionLayer {
  let next: MotionLayer = layer;
  if (next.name === "") {
    const { name: _empty, ...rest } = next;
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

/**
 * Giữ MotionProjectV1 hợp lệ sau mỗi lần editor ghi:
 * khai báo capability đã dùng, bỏ chuỗi tùy chọn rỗng, giữ metadata.name.
 */
export function syncProjectProtocolContract(
  project: MotionProject,
): MotionProject {
  const layers = unwrapLibrarySceneWrappers(project.layers).map(sanitizeLayer);
  const tokens = project.tokens
    ? {
        ...project.tokens,
        colors: dropEmptyTokenRecord(project.tokens.colors),
        fonts: dropEmptyTokenRecord(project.tokens.fonts),
      }
    : project.tokens;
  const name = project.metadata.name.trim() || "Untitled";
  return declareUsedCapabilities({
    ...project,
    metadata: { ...project.metadata, name },
    layers,
    tokens,
  });
}
