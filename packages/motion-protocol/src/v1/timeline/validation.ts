/**
 * Toàn vẹn timeline. Lane gốc unique nhờ zIndex trên layer `parentLayerId: null`.
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
