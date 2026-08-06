/**
 * @deprecated Local CLI export registry — production uses POST /api/renders.
 * Kept only for transitional tooling; do not call from product UI.
 */

import type { RenderJobProgress } from "@motionvideo/render-contracts";
import type { MotionProject } from "@motionvideo/motion-schema";

export type ExportJobRecord = RenderJobProgress & {
  projectId: string;
};

export function getExportJob(_jobId: string): ExportJobRecord | undefined {
  return undefined;
}

export function listExportJobs(): ExportJobRecord[] {
  return [];
}

export function cancelExportJob(_jobId: string): boolean {
  return false;
}

export async function startExportJob(
  _project: MotionProject,
): Promise<ExportJobRecord> {
  throw new Error(
    "Local render-worker export is retired. Use POST /api/renders (Remotion Lambda).",
  );
}
