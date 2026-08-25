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
    `/api/projects/${encodeURIComponent(input.projectRef)}`,
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
