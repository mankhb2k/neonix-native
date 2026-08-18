/**
 * Ranh giới mutation chung cho document: draft project → protocol-valid document.
 * Dùng cho mọi command boundary cần trả TimelineDocument (timeline + properties).
 *
 * Pipeline:
 *   syncProjectProtocolContract(project)   — sanitize chuỗi rỗng, unwrap wrapper,
 *                                            khai báo capabilities đã dùng.
 *   MotionProjectV1Schema.safeParse        — gate protocol (schema-only, reference
 *                                            asset trì hoãn ở store boundary).
 *   stamp revision + fingerprint           — freshness trong core.
 *   validateTimelineDocument               — bất biến cấu trúc lanes/clips.
 */
import {
  MotionProjectV1Schema,
  type MotionLayer,
  type MotionProject,
} from "@motionvideo/motion-protocol";
import {
  computeProjectFingerprint,
  INITIAL_REVISION,
} from "./canonical-projection";
import { syncProjectProtocolContract } from "./sync-project-protocol-contract";
import { validateTimelineDocument, type TimelineDocument } from "./document";
import type { TimelineClip } from "../timeline/model/timeline-types";

export type FinalizeRejectReason = "invalid_protocol" | "invalid_document";

export type FinalizeMutationResult =
  | { ok: true; document: TimelineDocument }
  | { ok: false; reason: FinalizeRejectReason; message: string };

/** Tìm layer theo id trong cây (đệ quy vào group). */
function findLayerById(
  layers: readonly MotionLayer[],
  id: string,
): MotionLayer | null {
  for (const layer of layers) {
    if (layer.id === id) return layer;
    if (layer.type === "group") {
      const found = findLayerById(layer.children, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Đồng bộ startTime/duration của scene clip với timing layer được tham chiếu.
 * `set-node-timing` đổi timing của layer (root hoặc node trong group-surface) mà
 * không đổi lane membership; clip projection phải theo để không stale. startTime
 * giữ nguyên offset đặt chỗ (pack base = 0, group-surface = timeOffset, overlay =
 * offset tường minh) bằng cách cộng lại delta vào timing mới.
 */
function syncSceneClipTiming(
  previousProject: MotionProject,
  nextProject: MotionProject,
  clips: TimelineClip[],
): TimelineClip[] {
  return clips.map((clip) => {
    if (clip.kind !== "scene") return clip;
    const prevLayer = findLayerById(previousProject.layers, clip.sceneId);
    const nextLayer = findLayerById(nextProject.layers, clip.sceneId);
    if (!prevLayer || !nextLayer) return clip;
    const offset = clip.startTime - prevLayer.timing.start;
    const startTime = nextLayer.timing.start + offset;
    const duration = nextLayer.timing.duration;
    if (startTime === clip.startTime && duration === clip.duration) return clip;
    return { ...clip, startTime, duration };
  });
}

/**
 * Chuẩn hóa + gate + stamp một project đã sửa thành TimelineDocument hợp lệ.
 * `base` cung cấp lanes/transitions/revision hiện có; clips được đồng bộ lại
 * timing từ project để `set-node-timing` không để lại clip stale.
 */
export function finalizeDocumentMutation(
  project: MotionProject,
  base: TimelineDocument,
): FinalizeMutationResult {
  const synced = syncProjectProtocolContract(project);

  const parsed = MotionProjectV1Schema.safeParse(synced);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    return {
      ok: false,
      reason: "invalid_protocol",
      message: `Project không hợp lệ theo protocol V1: ${details}`,
    };
  }

  const document: TimelineDocument = {
    project: synced,
    lanes: base.lanes,
    clips: syncSceneClipTiming(base.project, synced, base.clips),
    ...(base.transitions?.length ? { transitions: base.transitions } : {}),
    revision: (base.revision ?? INITIAL_REVISION - 1) + 1,
    fingerprint: computeProjectFingerprint(synced),
  };

  const validation = validateTimelineDocument(document);
  if (!validation.valid) {
    return {
      ok: false,
      reason: "invalid_document",
      message: `Document vi phạm invariants: ${validation.violations.map((v) => v.message).join("; ")}`,
    };
  }

  return { ok: true, document };
}
