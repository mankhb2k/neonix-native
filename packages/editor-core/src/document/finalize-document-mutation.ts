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
  type MotionProject,
} from "@motionvideo/motion-protocol";
import {
  computeProjectFingerprint,
  INITIAL_REVISION,
} from "./canonical-projection";
import { syncProjectProtocolContract } from "./sync-project-protocol-contract";
import { validateTimelineDocument, type TimelineDocument } from "./document";

export type FinalizeRejectReason = "invalid_protocol" | "invalid_document";

export type FinalizeMutationResult =
  | { ok: true; document: TimelineDocument }
  | { ok: false; reason: FinalizeRejectReason; message: string };

/**
 * Chuẩn hóa + gate + stamp một project đã sửa thành TimelineDocument hợp lệ.
 * `base` cung cấp lanes/clips/transitions/revision hiện có; các field này được
 * giữ nguyên (property edit không đổi bề mặt timeline).
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
    clips: base.clips,
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
