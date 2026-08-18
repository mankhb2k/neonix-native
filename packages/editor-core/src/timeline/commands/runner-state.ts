/**
 * Trạng thái làm việc dùng chung cho các command family handler.
 * Mỗi handler nhận một CommandRunnerState (mutable) và trả về CommandResult
 * (hoặc undefined để rơi xuống shared finish ở dispatcher).
 */
import {
  MotionProjectV1Schema,
  type MotionProject,
} from "@motionvideo/motion-protocol";
import {
  validateTimelineDocument,
  type TimelineDocument,
  type TimelineTransition,
} from "../../document/document";
import {
  computeProjectFingerprint,
  INITIAL_REVISION,
} from "../../document/canonical-projection";
import {
  ensureBaseLane,
  type TimelineClip,
  type TimelineLane,
} from "../timeline-clips";
import type { EditorSelection } from "../../selection/editor-selection";
import type { CommandContext } from "../../ports/command-context";
import type { CommandResult, TimelineDomainEvent } from "./command-types";

export interface CommandRunnerState {
  ctx: CommandContext;
  /** Project gốc (read-only snapshot từ doc). */
  project: MotionProject;
  lanes: TimelineLane[];
  clips: TimelineClip[];
  nextProject: MotionProject;
  transitions: TimelineTransition[] | undefined;
  events: TimelineDomainEvent[];
  baseLane: TimelineLane;
  uid: (prefix: string) => string;
  /** Đóng gói validate + stamp revision/fingerprint. */
  finish: (nextSelection?: EditorSelection) => CommandResult;
}

export function createRunnerState(
  doc: TimelineDocument,
  ctx: CommandContext,
): CommandRunnerState {
  const project = doc.project;
  let lanes = doc.lanes.length ? doc.lanes : [ensureBaseLane([])];
  const baseLane = ensureBaseLane(lanes);
  if (!lanes.some((l) => l.id === baseLane.id)) {
    lanes = [...lanes, baseLane];
  }
  const transitions = doc.transitions ? [...doc.transitions] : undefined;
  const events: TimelineDomainEvent[] = [];
  const uid = (prefix: string) => ctx.createId(prefix);

  const state: CommandRunnerState = {
    ctx,
    project,
    lanes,
    clips: [...doc.clips],
    nextProject: { ...project },
    transitions,
    events,
    baseLane,
    uid,
    finish: (nextSelection) =>
      finishSuccess(
        state.nextProject,
        state.lanes,
        state.clips,
        nextSelection,
        state.events,
        state.transitions,
        doc.revision,
      ),
  };
  return state;
}

export function finishSuccess(
  project: MotionProject,
  lanes: TimelineLane[],
  clips: TimelineClip[],
  selection?: EditorSelection,
  events: TimelineDomainEvent[] = [],
  transitions?: TimelineDocument["transitions"],
  previousRevision?: number,
): CommandResult {
  // Ranh giới protocol: mọi applied result phải parse được thành MotionProject V1.
  // Dùng schema-only (không kiểm tra reference) vì asset registration được trì
  // hoãn ở store boundary — image/video/audio có thể tham chiếu asset chưa khai báo.
  const parsed = MotionProjectV1Schema.safeParse(project);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    return {
      status: "rejected",
      reason: "invalid_protocol",
      message: `Project không hợp lệ theo protocol V1: ${details}`,
    };
  }

  const document: TimelineDocument = {
    project,
    lanes,
    clips,
    ...(transitions?.length ? { transitions } : {}),
    revision: (previousRevision ?? INITIAL_REVISION - 1) + 1,
    fingerprint: computeProjectFingerprint(project),
  };
  const validation = validateTimelineDocument(document);
  if (!validation.valid) {
    return {
      status: "rejected",
      reason: "invalid_document",
      message: `Document vi phạm invariants: ${validation.violations.map((v) => v.message).join("; ")}`,
    };
  }
  return {
    status: "applied",
    document,
    selection,
    events,
  };
}
