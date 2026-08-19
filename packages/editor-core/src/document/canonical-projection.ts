/**
 * Phép chiếu chính tắc: MotionProject → TimelineDocument.
 * Đây là nguồn DUY NHẤT để dẫn xuất lanes/clips từ project tác giả.
 * Mọi command phải đi qua đường này.
 *
 * Quy tắc: project (chính tắc) → projectToTimelineDocument → TimelineDocument (dẫn xuất).
 */

import type { MotionLayer, MotionProject } from "@motionvideo/motion-protocol";
import { computeProjectHashShort } from "@motionvideo/render-contracts";
import {
  groupPathToTimelineClips,
  packRootLayersToTimeline,
} from "../timeline/selectors/scene-order-clips";
import { collectLayerIds } from "./document";
import { normalizeLaneOrders } from "../timeline/timeline-clips";
import type { TimelineDocument } from "./document";

// ── Revision ──────────────────────────────────────────────────────────

/**
 * Revision khởi tạo cho một document vừa được chiếu.
 * Tăng đơn điệu sau mỗi lần thay đổi project.
 */
export const INITIAL_REVISION = 1;

// ── Fingerprint ───────────────────────────────────────────────────────

/**
 * Tính fingerprint ổn định của MotionProject để phát hiện sai lệch.
 * Ủy quyền cho hash chính tắc của @motionvideo/motion-protocol.
 */
export function computeProjectFingerprint(project: MotionProject): string {
  return computeProjectHashShort(project as Record<string, unknown>);
}

/**
 * Tạo fingerprint từ project của document hiện có để so sánh.
 */
export function documentFingerprint(doc: TimelineDocument): string {
  return computeProjectFingerprint(doc.project);
}

// ── Canonical projection ──────────────────────────────────────────────

/**
 * Dẫn xuất TimelineDocument hoàn chỉnh từ MotionProject.
 * Đây là phép chiếu một chiều chính tắc:
 *   project.layers → lanes + clips
 *
 * Audio clips được dẫn xuất từ các layer type "audio" trong project.layers.
 *
 * @param project Project tác giả (nguồn dữ liệu chính tắc)
 * @param previousRevision Nếu có, revision = previousRevision + 1; ngược lại dùng INITIAL_REVISION
 * @param groupPath Khi không rỗng, chiếu bề mặt group kiểu 1-con-1-hàng
 */
export function projectToTimelineDocument(
  project: MotionProject,
  previousRevision?: number,
  groupPath?: readonly string[],
): TimelineDocument {
  const { lanes, clips } =
    groupPath && groupPath.length > 0
      ? groupPathToTimelineClips(project, groupPath)
      : packRootLayersToTimeline(project);
  const normalizedLanes = normalizeLaneOrders(lanes);

  const revision = (previousRevision ?? INITIAL_REVISION - 1) + 1;
  const fingerprint = computeProjectFingerprint(project);

  return {
    project,
    lanes: normalizedLanes,
    clips,
    revision,
    fingerprint,
  };
}

/**
 * Dẫn xuất lại lanes/clips từ chính project của document, tăng revision.
 * Dùng khi sửa project inline và muốn có một document mới.
 */
export function rederiveDocument(doc: TimelineDocument): TimelineDocument {
  return projectToTimelineDocument(doc.project, doc.revision);
}

// ── Renderer guard ────────────────────────────────────────────────────

/**
 * Kiểm tra lanes/clips của TimelineDocument có còn mới so với project bên trong hay không.
 * Renderer PHẢI gọi hàm này trước khi tiêu thụ document.
 *
 * Trả về false nếu:
 *  - fingerprint không khớp project
 *  - revision bị thiếu hoặc bằng 0
 *  - document không có fingerprint (legacy)
 */
export function isDocumentFresh(doc: TimelineDocument): boolean {
  if (doc.revision == null || doc.revision <= 0) return false;
  if (!doc.fingerprint) return false;
  return doc.fingerprint === computeProjectFingerprint(doc.project);
}

/**
 * Khẳng định document còn mới; ném lỗi nếu đã cũ.
 * Gọi tại ranh giới renderer (Pixi, Remotion, export).
 */
export function assertDocumentFresh(doc: TimelineDocument): void {
  if (!isDocumentFresh(doc)) {
    const current = computeProjectFingerprint(doc.project);
    throw new Error(
      `[renderer-guard] Stale TimelineDocument: revision=${doc.revision}, ` +
        `stored=${doc.fingerprint}, computed=${current}. ` +
        `Re-derive via projectToTimelineDocument() before passing to renderer.`,
    );
  }
}

// ── Stable ID validation ──────────────────────────────────────────────

export type StableIdViolation = {
  kind: "dangling_scene" | "dangling_audio_track" | "dangling_asset";
  message: string;
  refId: string;
  source: string;
};

/**
 * Kiểm tra mọi tham chiếu của TimelineClip và TimelineLane đều trỏ tới thực thể
 * có trong project. Khác validateTimelineDocument (kiểm tra bất biến cấu trúc),
 * hàm này tập trung vào tính toàn vẹn tham chiếu cho các ID ổn định qua các lần lưu.
 */
export function validateStableIds(doc: TimelineDocument): StableIdViolation[] {
  const violations: StableIdViolation[] = [];
  const rootLayers = doc.project.layers.filter(
    (layer) => layer.parentLayerId === null,
  );
  const layerIds = collectLayerIds(doc.project.layers);
  const audioTrackIds = new Set(
    rootLayers
      .filter((layer) => layer.type === "audio")
      .map((layer) => layer.id),
  );
  const assetIds = new Set((doc.project.assets ?? []).map((a) => a.id));

  for (const clip of doc.clips) {
    if (clip.kind === "scene" && !layerIds.has(clip.sceneId)) {
      violations.push({
        kind: "dangling_scene",
        message: `Timeline clip "${clip.id}" tham chiếu sceneId không tồn tại "${clip.sceneId}"`,
        refId: clip.sceneId,
        source: clip.id,
      });
    }
    if (clip.kind === "audio") {
      if (clip.audioTrackId && !audioTrackIds.has(clip.audioTrackId)) {
        violations.push({
          kind: "dangling_audio_track",
          message: `Timeline clip "${clip.id}" tham chiếu audioTrackId không tồn tại "${clip.audioTrackId}"`,
          refId: clip.audioTrackId,
          source: clip.id,
        });
      }
      if (clip.assetId && !assetIds.has(clip.assetId)) {
        violations.push({
          kind: "dangling_asset",
          message: `Timeline clip "${clip.id}" tham chiếu asset không tồn tại "${clip.assetId}"`,
          refId: clip.assetId,
          source: clip.id,
        });
      }
    }
  }

  // Kiểm tra tham chiếu asset của MỌI media layer (image/video/audio) trong cây,
  // kể cả media nằm sâu trong nested group (recurse qua children của group).
  const walkAssetBindings = (
    layers: readonly MotionLayer[],
    groupId?: string,
  ) => {
    for (const layer of layers) {
      if (layer.type === "group") {
        walkAssetBindings(layer.children, layer.id);
        continue;
      }
      const assetId =
        layer.type === "image" ||
        layer.type === "video" ||
        layer.type === "audio"
          ? layer.payload.assetId
          : undefined;
      if (assetId && !assetIds.has(assetId)) {
        const where = groupId ? ` trong group "${groupId}"` : "";
        violations.push({
          kind: "dangling_asset",
          message: `Layer "${layer.id}"${where} tham chiếu asset không tồn tại "${assetId}"`,
          refId: assetId,
          source: layer.id,
        });
      }
    }
  };
  walkAssetBindings(doc.project.layers);

  return violations;
}
