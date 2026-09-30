import { apiFetch } from "./client";
import { getDefaultWorkspaceId } from "./workspaces";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

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
  const workspaceId = await getDefaultWorkspaceId();
  const response = await apiFetch("/v1/projects/html-raw", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ ...input, workspaceId }),
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
 * Kiến trúc A entry point: stores HTML/CSS as-is, no compile step. See
 * ARCHITECHTURE.md "Hai kiến trúc render độc lập".
 */
export async function createHtmlProjectRaw(input: { title?: string; html: string }): Promise<{ projectId: string }> {
  const workspaceId = await getDefaultWorkspaceId();
  const response = await apiFetch("/v1/projects/html-raw", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ ...input, workspaceId }),
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

/** Kiến trúc B entry point: creates a blank, editable Neonix JSON V2 project. */
export async function createBlankProject(input: { title?: string; composition: NewProjectComposition }): Promise<{ projectId: string }> {
  const workspaceId = await getDefaultWorkspaceId();
  const response = await apiFetch("/v1/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ workspaceId, title: input.title }),
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
    `/v1/projects/${encodeURIComponent(input.projectRef)}/revisions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentJson: input.document,
        reason: "autosave",
      }),
    },
  );

  if (!response.ok) return { ok: false, status: response.status };

  const saved = (await response.json()) as { revision?: { revisionNo?: unknown } };
  const revisionNo = saved.revision?.revisionNo;
  if (typeof revisionNo !== "number") {
    return { ok: false, status: 502 };
  }
  return { ok: true, revisionNo };
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

export type HtmlProjectDocument = {
  project: { id: string; title: string; workspaceId: string };
  html: string;
  updatedAt: string;
};

/** Failure loading or saving an HTML project; `status` is the HTTP status (401 = signed out). */
export class HtmlProjectError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = "HtmlProjectError";
  }
}

async function readHtmlDocument(response: Response, fallback: string): Promise<HtmlProjectDocument> {
  const payload = await response.json().catch(() => null) as {
    project?: { id?: unknown; title?: unknown; workspaceId?: unknown };
    html?: unknown;
    updatedAt?: unknown;
    error?: { message?: unknown; code?: unknown };
  } | null;
  if (!response.ok) {
    throw new HtmlProjectError(
      typeof payload?.error?.message === "string" ? payload.error.message : fallback,
      response.status,
      typeof payload?.error?.code === "string" ? payload.error.code : undefined,
    );
  }
  if (typeof payload?.html !== "string" || typeof payload.project?.id !== "string") {
    throw new HtmlProjectError(fallback, response.status);
  }
  return {
    project: {
      id: payload.project.id,
      title: typeof payload.project.title === "string" ? payload.project.title : "Untitled project",
      workspaceId: typeof payload.project.workspaceId === "string" ? payload.project.workspaceId : "",
    },
    html: payload.html,
    updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : "",
  };
}

export async function getHtmlProject(projectId: string): Promise<HtmlProjectDocument> {
  const response = await apiFetch(`/v1/projects/${encodeURIComponent(projectId)}/html`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  return readHtmlDocument(response, "Unable to load this project");
}

export async function saveHtmlProject(projectId: string, html: string): Promise<HtmlProjectDocument> {
  const response = await apiFetch(`/v1/projects/${encodeURIComponent(projectId)}/html`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ html }),
  });
  return readHtmlDocument(response, "Unable to save this project");
}
