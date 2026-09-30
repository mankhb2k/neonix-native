import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";
import { apiFetch } from "./client";

export type SaveEditorProjectResult =
  | { ok: true; revisionNo: number }
  | { ok: false; status: number };

export class CreateHtmlProjectError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
    this.name = "CreateHtmlProjectError";
  }
}

export async function createHtmlProject(input: { title?: string; html: string; idempotencyKey?: string }): Promise<{ projectId: string }> {
  const response = await apiFetch("/v1/projects/html", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await response.json().catch(() => null) as {
    project?: { id?: unknown };
    error?: { message?: unknown; code?: unknown };
  } | null;
  if (!response.ok) {
    throw new CreateHtmlProjectError(
      typeof payload?.error?.message === "string" ? payload.error.message : "Unable to import HTML",
      typeof payload?.error?.code === "string" ? payload.error.code : undefined,
    );
  }
  const projectId = payload?.project?.id;
  if (typeof projectId !== "string" || !projectId) throw new Error("The project was created without an id");
  return { projectId };
}

/**
 * Kiến trúc B entry point: stores HTML/CSS as-is, no compile step. See
 * ARCHITECHTURE.md "Hai kiến trúc render độc lập".
 */
export async function createHtmlProjectRaw(input: { title?: string; html: string }): Promise<{ projectId: string }> {
  const response = await apiFetch("/v1/projects/html-raw", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await response.json().catch(() => null) as {
    project?: { id?: unknown };
    error?: { message?: unknown; code?: unknown };
  } | null;
  if (!response.ok) {
    throw new CreateHtmlProjectError(
      typeof payload?.error?.message === "string" ? payload.error.message : "Unable to import HTML",
      typeof payload?.error?.code === "string" ? payload.error.code : undefined,
    );
  }
  const projectId = payload?.project?.id;
  if (typeof projectId !== "string" || !projectId) throw new Error("The project was created without an id");
  return { projectId };
}

export type NewProjectComposition = {
  width: number;
  height: number;
  fps: number;
  background: string;
};

function blankMotionProtocolDocument(composition: NewProjectComposition): MotionProtocolV2 {
  return {
    format: "motion-protocol",
    formatVersion: 2,
    id: crypto.randomUUID(),
    composition: {
      width: composition.width,
      height: composition.height,
      fps: composition.fps,
      background: composition.background,
      colorSpace: "srgb",
      view: {
        projection: { kind: "orthographic", zoom: 1, near: 0.1, far: 1000 },
        transform: {
          translate: { x: 0, y: 0, z: 0 },
          rotate: { x: 0, y: 0, z: 0 },
        },
      },
    },
    assets: [],
    layers: [],
    audio: { sampleRate: 48000, tracks: [] },
  };
}

/** Kiến trúc A entry point: creates a blank, editable Neonix JSON V2 project. */
export async function createBlankProject(input: { title?: string; composition: NewProjectComposition }): Promise<{ projectId: string }> {
  const response = await apiFetch("/v1/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      title: input.title,
      document: blankMotionProtocolDocument(input.composition),
    }),
  });
  const payload = await response.json().catch(() => null) as {
    project?: { id?: unknown };
    error?: { message?: unknown };
  } | null;
  if (!response.ok) {
    throw new Error(typeof payload?.error?.message === "string" ? payload.error.message : "Unable to create project");
  }
  const projectId = payload?.project?.id;
  if (typeof projectId !== "string" || !projectId) throw new Error("The project was created without an id");
  return { projectId };
}

/** The "Convert JSON V2" action — compiles a raw HTML project's HTML once. */
export async function convertHtmlProjectToJson(projectId: string): Promise<{ revisionNo: number }> {
  const response = await apiFetch(`/v1/projects/${encodeURIComponent(projectId)}/convert-json`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  const payload = await response.json().catch(() => null) as {
    project?: { currentRevisionNo?: unknown };
    error?: { message?: unknown };
  } | null;
  if (!response.ok) {
    throw new Error(typeof payload?.error?.message === "string" ? payload.error.message : "Unable to convert project");
  }
  const revisionNo = payload?.project?.currentRevisionNo;
  if (typeof revisionNo !== "number") throw new Error("The project was converted without a revision number");
  return { revisionNo };
}

/** Browser BFF client for the authenticated V2 project repository. */
export async function saveEditorProject(input: {
  projectRef: string;
  document: MotionProtocolV2;
  expectedRevisionNo: number;
}): Promise<SaveEditorProjectResult> {
  const response = await apiFetch(
    `/v1/editor/projects/${encodeURIComponent(input.projectRef)}`,
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
  const response = await apiFetch(
    `/v1/projects/${encodeURIComponent(input.projectRef)}/assets`,
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
  const response = await apiFetch(`/v1/projects/${encodeURIComponent(projectId)}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });
  if (response.ok) return;

  const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  throw new Error(body?.error?.message ?? `Unable to remove project (${response.status})`);
}
