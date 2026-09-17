import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

export type SaveEditorProjectResult =
  | { ok: true; revisionNo: number }
  | { ok: false; status: number };

/** Browser BFF client for the authenticated V2 project repository. */
export async function saveEditorProject(input: {
  projectRef: string;
  document: MotionProtocolV2;
  expectedRevisionNo: number;
}): Promise<SaveEditorProjectResult> {
  const response = await fetch(
    `/api/v1/editor/projects/${encodeURIComponent(input.projectRef)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        document: input.document,
        expectedRevisionNo: input.expectedRevisionNo,
      }),
    },
  );

  if (!response.ok) return { ok: false, status: response.status };

  const saved = (await response.json()) as { revisionNo?: unknown };
  if (typeof saved.revisionNo !== "number") {
    return { ok: false, status: 502 };
  }
  return { ok: true, revisionNo: saved.revisionNo };
}

export async function attachProjectAsset(input: {
  projectRef: string;
  assetId: string;
}): Promise<void> {
  const response = await fetch(
    `/api/v1/projects/${encodeURIComponent(input.projectRef)}/assets`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId: input.assetId }),
    },
  );

  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = (await response.json()) as { error?: unknown };
      if (typeof body.error === "string") message = body.error;
    } catch {
      // Keep the HTTP status text when the error response is not JSON.
    }
    throw new Error(message || "Unable to attach asset to project");
  }
}

export async function removeProject(projectId: string): Promise<void> {
  const response = await fetch(`/api/v1/projects/${encodeURIComponent(projectId)}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });
  if (response.ok) return;

  const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  throw new Error(body?.error?.message ?? `Unable to remove project (${response.status})`);
}
