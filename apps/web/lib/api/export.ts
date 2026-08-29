/**
 * Request MP4 export via the native VPS worker BFF (POST /api/renders).
 */

import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

export type ExportError = {
  error: string;
};

export async function exportMotionProject(
  project: MotionProtocolV2,
): Promise<{ jobId: string }> {
  const res = await fetch("/api/renders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": "web-editor",
    },
    body: JSON.stringify({
      projectId: project.id,
      projectRevision: 0,
      preset: "export-1080p",
      document: project,
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

  const json = (await res.json()) as { jobId: string };
  return { jobId: json.jobId };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
