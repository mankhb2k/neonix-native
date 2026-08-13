/**
 * Timeline integrity V1.
 *
 * Track overlap / clip-id checks are gone: authoring has no visual, audio,
 * or caption tracks. Root-lane uniqueness lives on the layer graph
 * (unique zIndex among `parentLayerId: null`).
 */
import type { ProjectTimelineV1 } from "./schema";

export interface TimelineIntegrityIssue {
  /** Path lỗi tương đối timeline (không có segment `timeline` đứng đầu). */
  path: (string | number)[];
  message: string;
}

export function collectTimelineIntegrityIssues(
  _timeline: ProjectTimelineV1,
): TimelineIntegrityIssue[] {
  void _timeline;
  return [];
}
