/**
 * Trạng thái + helpers dùng chung cho property command dispatcher:
 * các hàm reject, collectNonFinite, và finish (qua finalizeDocumentMutation).
 */
import type { MotionProject } from "@motionvideo/motion-protocol";
import { finalizeDocumentMutation } from "../document/finalize-document-mutation";
import type { TimelineDocument } from "../document/document";
import type {
  PropertyCommandResult,
  PropertyDomainEvent,
} from "./property-commands";

/** Kết quả trung gian của một command family handler (trước khi finish). */
export interface PropertyApplyResult {
  project: MotionProject;
  missing: boolean;
  /** Target không hỗ trợ patch (style/text/media). */
  incompatible?: boolean;
  /** Vi phạm business rule (keyframe collision, vượt limit, ...). */
  invalid?: string;
}

/** Reject NaN / ±Infinity trước Math.min/max (vốn giữ nguyên NaN). */
export function collectNonFinite(
  values: Array<number | undefined | null>,
): boolean {
  for (const v of values) {
    if (v === undefined || v === null) continue;
    if (typeof v !== "number" || !Number.isFinite(v)) return true;
  }
  return false;
}

export function rejectedInvalid(message: string): PropertyCommandResult {
  return { status: "rejected", reason: "invalid_value", message };
}

export function rejectedEmptyTargets(
  message = "No node targets for property command.",
): PropertyCommandResult {
  return { status: "rejected", reason: "empty_targets", message };
}

/**
 * Cổng ra duy nhất cho mọi applied property command:
 * finalizeDocumentMutation → PropertyCommandResult.
 */
export function finalizePropertyMutation(
  project: MotionProject,
  base: TimelineDocument,
  events: PropertyDomainEvent[],
): PropertyCommandResult {
  const finalized = finalizeDocumentMutation(project, base);
  if (!finalized.ok) {
    return {
      status: "rejected",
      reason: finalized.reason,
      message: finalized.message,
    };
  }
  return {
    status: "applied",
    document: finalized.document,
    events,
  };
}
