/**
 * Ánh xạ preview transform stage → property patches / DocumentPropertyCommand.
 */

import type {
  DocumentPropertyCommand,
  NodeTargetRef,
  TransformPatch,
} from "../../properties/property-commands";
import type { StageTransformValues } from "./transform-box";

export type StagePropertyPatch = {
  target: NodeTargetRef;
  values: StageTransformValues;
  /** Tập con cho set-node-transform của editor-core hiện tại. */
  transformPatch: TransformPatch;
  /** width/height cho tới khi TransformPatch mở rộng — host có thể ghi riêng. */
  sizePatch?: { width: number; height: number };
};

export type StageCommitResult = {
  interactionId: string;
  mode: "move" | "resize" | "rotate";
  patches: StagePropertyPatch[];
  command: DocumentPropertyCommand | null;
};

export function toStagePropertyPatches(
  base: StageTransformValues,
  preview: StageTransformValues,
): StagePropertyPatch[] {
  const transformPatch: TransformPatch = {};
  if (preview.x !== base.x) transformPatch.x = preview.x;
  if (preview.y !== base.y) transformPatch.y = preview.y;
  if (preview.rotation !== base.rotation) {
    transformPatch.rotation = preview.rotation;
  }

  const sizeChanged =
    preview.width !== base.width || preview.height !== base.height;

  return [
    {
      target: { rootLayerId: preview.rootLayerId, layerId: preview.layerId },
      values: preview,
      transformPatch,
      sizePatch: sizeChanged
        ? { width: preview.width, height: preview.height }
        : undefined,
    },
  ];
}

/**
 * Tạo command `set-node-transform` cho MỘT patch duy nhất.
 *
 * `toStagePropertyPatches()` luôn trả về đúng một patch (stage tương tác là
 * single-selection). Hàm này nhận đúng một patch để ranh giới rõ ràng:
 * - Không có thay đổi transform (ví dụ chỉ resize size) → trả về `null`.
 *   Size change vẫn nằm ở `patch.sizePatch` để host tự xử lý.
 * - Có thay đổi transform → trả về `{ type: "set-node-transform", ... }`.
 */
export function toSingleSetNodeTransformCommand(
  patch: StagePropertyPatch,
): DocumentPropertyCommand | null {
  if (Object.keys(patch.transformPatch).length === 0) return null;
  return {
    type: "set-node-transform",
    targets: [patch.target],
    patch: patch.transformPatch,
  };
}
