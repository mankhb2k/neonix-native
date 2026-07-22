import type { MotionProject } from "@motionvideo/motion-schema";

export type ExportError = {
  error: string;
};

/**
 * Request MP4 export from the Next API (spawns render-worker CLI server-side).
 * Lives in lib/api so UI never calls raw fetch.
 */
export async function exportMotionProject(
  project: MotionProject,
): Promise<Blob> {
  const res = await fetch("/api/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(project),
  });

  if (!res.ok) {
    let message = `Export failed (${res.status})`;
    try {
      const data = (await res.json()) as ExportError;
      if (data.error) message = data.error;
    } catch {
      // ignore non-JSON error bodies
    }
    throw new Error(message);
  }

  return res.blob();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
