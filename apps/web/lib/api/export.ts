/**
 * Request an MP4 export through the apps/api backend.
 */

import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";
import { apiFetch } from "./client";

export type ExportError = {
  error: string;
};

export async function exportMotionProject(
  project: MotionProtocolV2,
): Promise<{ jobId: string }> {
  const res = await apiFetch("/v1/render-jobs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectId: project.id,
      idempotencyKey: `web-${project.id}-${Date.now()}`,
      presetJson: { preset: "export-1080p", document: project },
    }),
  });

  if (!res.ok) {
    let message = `Export failed (${res.status})`;
    try {
      const data = (await res.json()) as ExportError;
      if (data.error) message = data.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const json = (await res.json()) as { renderJob?: { id?: string } };
  if (!json.renderJob?.id) throw new Error("Render job response is invalid");
  return { jobId: json.renderJob.id };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
