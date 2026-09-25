/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, no-console */
import "server-only";

import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { previewUrl } from "@/lib/hosts";
import {
  applyJsonPatch as applySharedJsonPatch,
  createProject as createSharedProject,
  createProjectHtml as createSharedProjectHtml,
  deleteProject as deleteSharedProject,
  getProject as getSharedProject,
  getProjectHtml as getSharedProjectHtml,
  getProjectJson as getSharedProjectJson,
  listHtmlRevisions as listSharedHtmlRevisions,
  getHtmlRevision as getSharedHtmlRevision,
  updateProject as updateSharedProject,
  updateProjectHtml as updateSharedProjectHtml,
  type ProjectRepositoryError,
} from "@/lib/server/projects/repository";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { parseMotionProtocol } from "@motionvideo/motion-protocol";
import type { McpPrincipal } from "./auth";

type JsonObject = Record<string, unknown>;
type WorkspaceRole = "owner" | "editor" | "viewer";

type Workspace = {
  id: string;
  name: string;
  role: WorkspaceRole;
  created_at: string;
};

type Project = {
  id: string;
  public_ref: string;
  workspace_id: string;
  title: string;
  current_revision_no: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
  deleted_at: string | null;
  purge_after: string | null;
};

export type ProjectWithRevision = Project & {
  workspace_name: string;
  latest_revision: {
    id: string;
    revision_no: number;
    document_json: JsonObject;
    content_hash: string;
    source_schema_version: number;
    reason: string;
    byte_size: number | null;
    created_by: string;
    created_at: string;
  } | null;
};

export class McpProjectError extends Error {
  constructor(
    message: string,
    readonly code = "PROJECT_ERROR",
  ) {
    super(message);
    this.name = "McpProjectError";
  }
}

function rethrowRepositoryError(error: unknown): never {
  if (error && typeof error === "object" && "code" in error && "message" in error) {
    const repositoryError = error as ProjectRepositoryError;
    throw new McpProjectError(String(repositoryError.message), String(repositoryError.code));
  }
  throw error;
}

export function getMcpSupabaseClient(principal: McpPrincipal): SupabaseClient {
  const env = getSupabaseEnv();
  if (!env) throw new McpProjectError("Supabase is not configured", "MISCONFIGURED");

  return createClient(env.url, env.publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${principal.token}` } },
  });
}

export const getClient = getMcpSupabaseClient;

function throwSupabaseError(error: { message?: string } | null, fallback: string): never {
  if (error) console.error("[mcp] database operation failed", error.message);
  throw new McpProjectError(fallback);
}

function isEditor(role: WorkspaceRole): boolean {
  return role === "owner" || role === "editor";
}

async function getWorkspaceRole(
  client: SupabaseClient,
  userId: string,
  workspaceId: string,
): Promise<WorkspaceRole | null> {
  const { data, error } = await client
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throwSupabaseError(error, "Unable to read workspace membership");
  const role = data?.role;
  return role === "owner" || role === "editor" || role === "viewer" ? role : null;
}

async function resolveWorkspace(
  client: SupabaseClient,
  principal: McpPrincipal,
  requestedWorkspaceId?: string,
  requireEditor = false,
): Promise<{ id: string; name: string; role: WorkspaceRole }> {
  let workspaceId = requestedWorkspaceId;

  if (!workspaceId) {
    const { data, error } = await client
      .from("workspace_members")
      .select("workspace_id, role")
      .eq("user_id", principal.userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throwSupabaseError(error, "Unable to list workspaces");
    workspaceId = data?.workspace_id;
  }

  if (!workspaceId) {
    const { data, error } = await client
      .from("workspaces")
      .insert({ name: "Personal workspace", created_by: principal.userId, kind: "personal" })
      .select("id, name, created_at")
      .single();
    if (error) throwSupabaseError(error, "Unable to create a personal workspace");
    workspaceId = data.id;
  }

  if (!workspaceId) {
    throw new McpProjectError("Unable to resolve a workspace", "INTERNAL");
  }

  const resolvedWorkspaceId = workspaceId;

  const role = await getWorkspaceRole(client, principal.userId, resolvedWorkspaceId);
  if (!role) throw new McpProjectError("Workspace not found or access denied", "FORBIDDEN");
  if (requireEditor && !isEditor(role)) {
    throw new McpProjectError("Editor access is required for this operation", "FORBIDDEN");
  }

  const { data: workspace, error } = await client
    .from("workspaces")
    .select("id, name")
    .eq("id", resolvedWorkspaceId)
    .single();
  if (error) throwSupabaseError(error, "Unable to read workspace");

  return { id: workspace.id, name: workspace.name, role };
}

export async function resolveMcpWorkspace(
  principal: McpPrincipal,
  workspaceId?: string,
  requireEditor = false,
) {
  return resolveWorkspace(getClient(principal), principal, workspaceId, requireEditor);
}

async function audit(
  client: SupabaseClient,
  principal: McpPrincipal,
  input: {
    workspaceId?: string;
    action: string;
    targetType?: string;
    targetId?: string;
    metadata?: JsonObject;
  },
) {
  const { error } = await client.from("audit_events").insert({
    workspace_id: input.workspaceId ?? null,
    actor_user_id: principal.userId,
    actor_client_id: principal.clientId,
    action: input.action,
    target_type: input.targetType ?? null,
    target_id: input.targetId ?? null,
    metadata_json: input.metadata ?? {},
  });
  // Auditing must never turn a successful user operation into a failure.
  if (error) console.error("[mcp] audit event failed", error.message);
}

function hashDocument(document: JsonObject): string {
  return createHash("sha256").update(JSON.stringify(document)).digest("hex");
}

function documentByteSize(document: JsonObject): number {
  return Buffer.byteLength(JSON.stringify(document), "utf8");
}

function parseProjectDocument(document: JsonObject): JsonObject {
  try {
    return parseMotionProtocol(document);
  } catch {
    throw new McpProjectError(
      "document must be a valid Neonix JSON V2 document",
      "INVALID_INPUT",
    );
  }
}

function repositoryActor(principal: McpPrincipal) {
  return { userId: principal.userId, clientId: principal.clientId };
}

export async function createProtocolProject(
  principal: McpPrincipal,
  input: { workspaceId?: string; title?: string; document?: JsonObject },
) {
  if (!input.document) throw new McpProjectError("document is required and must be a valid Neonix JSON V2 document", "INVALID_INPUT");
  try {
    return await createSharedProject(getClient(principal), repositoryActor(principal), {
      workspaceId: input.workspaceId,
      title: input.title,
      document: input.document,
    });
  } catch (error) {
    return rethrowRepositoryError(error);
  }
}

export async function getProtocolProject(
  principal: McpPrincipal,
  input: { projectId?: string; publicRef?: string },
) {
  try {
    return await getSharedProject(getClient(principal), repositoryActor(principal), input);
  } catch (error) {
    return rethrowRepositoryError(error);
  }
}

export async function getProtocolProjectJson(
  principal: McpPrincipal,
  input: { projectId?: string; publicRef?: string },
) {
  try {
    return await getSharedProjectJson(getClient(principal), repositoryActor(principal), input);
  } catch (error) {
    return rethrowRepositoryError(error);
  }
}

export async function updateProtocolProject(
  principal: McpPrincipal,
  input: {
    projectId?: string;
    publicRef?: string;
    title?: string;
    document?: JsonObject;
    expectedRevisionNo?: number;
  },
) {
  try {
    return await updateSharedProject(getClient(principal), repositoryActor(principal), input);
  } catch (error) {
    return rethrowRepositoryError(error);
  }
}

export async function deleteProtocolProject(
  principal: McpPrincipal,
  input: { projectId?: string; publicRef?: string },
) {
  try {
    return await deleteSharedProject(getClient(principal), repositoryActor(principal), input);
  } catch (error) {
    return rethrowRepositoryError(error);
  }
}

export async function getProjectHtmlSource(
  principal: McpPrincipal,
  input: { projectId?: string; publicRef?: string },
) {
  try {
    return await getSharedProjectHtml(getClient(principal), repositoryActor(principal), input);
  } catch (error) {
    return rethrowRepositoryError(error);
  }
}

export async function updateProjectHtmlSource(
  principal: McpPrincipal,
  input: {
    projectId?: string;
    publicRef?: string;
    html: string;
    expectedHtmlRevisionNo?: number;
    expectedProtocolRevisionNo?: number;
    ensureBrowserPreviewStyle?: boolean;
  },
) {
  try {
    return await updateSharedProjectHtml(getClient(principal), repositoryActor(principal), input);
  } catch (error) {
    return rethrowRepositoryError(error);
  }
}

export async function listProjectHtmlRevisions(
  principal: McpPrincipal,
  input: { projectId?: string; publicRef?: string },
) {
  try {
    return await listSharedHtmlRevisions(getClient(principal), repositoryActor(principal), input);
  } catch (error) {
    return rethrowRepositoryError(error);
  }
}

export async function getProjectHtmlRevision(
  principal: McpPrincipal,
  input: { projectId?: string; publicRef?: string; revisionNo: number },
) {
  try {
    return await getSharedHtmlRevision(getClient(principal), repositoryActor(principal), input);
  } catch (error) {
    return rethrowRepositoryError(error);
  }
}

export async function applyProjectJsonPatch(
  principal: McpPrincipal,
  input: {
    projectId?: string;
    publicRef?: string;
    patch: Record<string, unknown>;
    expectedProtocolRevisionNo: number;
  },
) {
  try {
    return await applySharedJsonPatch(getClient(principal), repositoryActor(principal), input);
  } catch (error) {
    return rethrowRepositoryError(error);
  }
}

export async function listWorkspaces(principal: McpPrincipal) {
  const client = getClient(principal);
  const { data, error } = await client
    .from("workspace_members")
    .select("workspace_id, role, created_at")
    .eq("user_id", principal.userId)
    .order("created_at", { ascending: true });
  if (error) throwSupabaseError(error, "Unable to list workspaces");
  if (!data?.length) return [] as Workspace[];

  const ids = data.map((item) => item.workspace_id);
  const { data: workspaces, error: workspaceError } = await client
    .from("workspaces")
    .select("id, name, created_at")
    .in("id", ids);
  if (workspaceError) throwSupabaseError(workspaceError, "Unable to read workspaces");

  const byId = new Map((workspaces ?? []).map((workspace) => [workspace.id, workspace]));
  return data.flatMap((membership) => {
    const workspace = byId.get(membership.workspace_id);
    const role = membership.role as WorkspaceRole;
    return workspace && (role === "owner" || role === "editor" || role === "viewer")
      ? [{ id: workspace.id, name: workspace.name, role, created_at: workspace.created_at }]
      : [];
  });
}

export async function listProjects(
  principal: McpPrincipal,
  input: { workspaceId?: string; limit?: number },
) {
  const client = getClient(principal);
  const workspace = await resolveWorkspace(client, principal, input.workspaceId);
  const query = client
    .from("projects")
    .select("id, public_ref, workspace_id, title, current_revision_no, created_by, created_at, updated_at, last_activity_at, deleted_at, purge_after")
    .eq("workspace_id", workspace.id)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(input.limit ?? 20);
  const { data, error } = await query;
  if (error) throwSupabaseError(error, "Unable to list projects");
  await audit(client, principal, { workspaceId: workspace.id, action: "mcp.projects.list" });
  return { workspace, projects: data ?? [] };
}

async function findProject(
  client: SupabaseClient,
  principal: McpPrincipal,
  input: { projectId?: string; publicRef?: string },
) {
  if (!input.projectId && !input.publicRef) {
    throw new McpProjectError("Provide project_id or public_ref", "INVALID_INPUT");
  }
  const query = input.projectId
    ? client
        .from("projects")
        .select("id, public_ref, workspace_id, title, current_revision_no, created_by, created_at, updated_at, last_activity_at, deleted_at, purge_after")
        .eq("id", input.projectId)
        .is("deleted_at", null)
    : client
        .from("projects")
        .select("id, public_ref, workspace_id, title, current_revision_no, created_by, created_at, updated_at, last_activity_at, deleted_at, purge_after")
        .eq("public_ref", input.publicRef)
        .is("deleted_at", null);
  const { data, error } = await query.single();
  if (error) throw new McpProjectError("Project not found or access denied", "NOT_FOUND");
  const role = await getWorkspaceRole(client, principal.userId, data.workspace_id);
  if (!role) throw new McpProjectError("Project not found or access denied", "NOT_FOUND");
  return { project: data, role };
}

export async function getProject(
  principal: McpPrincipal,
  input: { projectId?: string; publicRef?: string },
) {
  const client = getClient(principal);
  const { project } = await findProject(client, principal, input);
  const [{ data: workspace, error: workspaceError }, { data: revision, error: revisionError }] = await Promise.all([
    client.from("workspaces").select("name").eq("id", project.workspace_id).single(),
    client
      .from("project_revisions")
      .select("id, revision_no, document_json, content_hash, source_schema_version, reason, byte_size, created_by, created_at")
      .eq("project_id", project.id)
      .order("revision_no", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (workspaceError) throwSupabaseError(workspaceError, "Unable to read project workspace");
  if (revisionError) throwSupabaseError(revisionError, "Unable to read project revision");
  await audit(client, principal, {
    workspaceId: project.workspace_id,
    action: "mcp.projects.get",
    targetType: "project",
    targetId: project.id,
  });
  return {
    ...project,
    workspace_name: workspace.name,
    latest_revision: revision ?? null,
  } as ProjectWithRevision;
}

export async function createProject(
  principal: McpPrincipal,
  input: { workspaceId?: string; title?: string; document?: JsonObject },
) {
  const client = getClient(principal);
  const workspace = await resolveWorkspace(client, principal, input.workspaceId, true);
  const title = input.title?.trim() || "Untitled project";
  if (!input.document) {
    throw new McpProjectError(
      "document is required and must be a valid Neonix JSON V2 document",
      "INVALID_INPUT",
    );
  }
  const document = parseProjectDocument(input.document);
  const { data: project, error } = await client
    .from("projects")
    .insert({ workspace_id: workspace.id, title, created_by: principal.userId, current_revision_no: 0 })
    .select("id, public_ref, workspace_id, title, current_revision_no, created_by, created_at, updated_at, last_activity_at, deleted_at, purge_after")
    .single();
  if (error) throwSupabaseError(error, "Unable to create project");

  const { data: revision, error: revisionError } = await client
    .from("project_revisions")
    .insert({
      project_id: project.id,
      revision_no: 1,
      document_json: document,
      content_hash: hashDocument(document),
      source_schema_version: 2,
      reason: "mcp",
      byte_size: documentByteSize(document),
      created_by: principal.userId,
    })
    .select("id, revision_no, document_json, content_hash, source_schema_version, reason, byte_size, created_at")
    .single();
  if (revisionError) throwSupabaseError(revisionError, "Unable to create initial project revision");

  const { error: updateError } = await client
    .from("projects")
    .update({ current_revision_no: 1 })
    .eq("id", project.id);
  if (updateError) throwSupabaseError(updateError, "Unable to activate initial project revision");
  await audit(client, principal, {
    workspaceId: workspace.id,
    action: "mcp.projects.create",
    targetType: "project",
    targetId: project.id,
    metadata: { revision_no: 1 },
  });
  return { project: { ...project, current_revision_no: 1 }, revision, workspace };
}

export async function createProjectHtml(
  principal: McpPrincipal,
  input: { workspaceId?: string; title?: string; html?: string; idempotencyKey?: string; ensureBrowserPreviewStyle?: boolean },
) {
  try {
    return await createSharedProjectHtml(
      getClient(principal),
      { userId: principal.userId, clientId: principal.clientId },
      input,
    );
  } catch (error) {
    return rethrowRepositoryError(error);
  }
}

export async function updateProject(
  principal: McpPrincipal,
  input: {
    projectId?: string;
    publicRef?: string;
    title?: string;
    document?: JsonObject;
    expectedRevisionNo?: number;
  },
) {
  const client = getClient(principal);
  const { project, role } = await findProject(client, principal, input);
  if (!isEditor(role)) throw new McpProjectError("Editor access is required for this operation", "FORBIDDEN");
  if (input.title === undefined && input.document === undefined) {
    throw new McpProjectError("Provide title or document to update", "INVALID_INPUT");
  }
  if (input.expectedRevisionNo !== undefined && input.expectedRevisionNo !== project.current_revision_no) {
    throw new McpProjectError(
      `Revision conflict: expected ${input.expectedRevisionNo}, current is ${project.current_revision_no}`,
      "REVISION_CONFLICT",
    );
  }

  const updates: Record<string, unknown> = {};
  if (input.title !== undefined) updates.title = input.title.trim();
  let revision = null;
  if (input.document !== undefined) {
    const document = parseProjectDocument(input.document);
    const revisionNo = project.current_revision_no + 1;
    const { data, error } = await client
      .from("project_revisions")
      .insert({
        project_id: project.id,
        revision_no: revisionNo,
        document_json: document,
        content_hash: hashDocument(document),
        source_schema_version: 2,
        reason: "mcp",
        byte_size: documentByteSize(document),
        created_by: principal.userId,
      })
      .select("id, revision_no, document_json, content_hash, source_schema_version, reason, byte_size, created_at")
      .single();
    if (error) throwSupabaseError(error, "Unable to create project revision");
    revision = data;
    updates.current_revision_no = revisionNo;
  }
  const { data: updated, error } = await client
    .from("projects")
    .update(updates)
    .eq("id", project.id)
    .select("id, public_ref, workspace_id, title, current_revision_no, created_by, created_at, updated_at, last_activity_at, deleted_at, purge_after")
    .single();
  if (error) throwSupabaseError(error, "Unable to update project");
  await audit(client, principal, {
    workspaceId: project.workspace_id,
    action: "mcp.projects.update",
    targetType: "project",
    targetId: project.id,
    metadata: { revision_no: updated.current_revision_no },
  });
  return { project: updated, revision };
}

export async function openEditor(
  principal: McpPrincipal,
  input: { projectId?: string; publicRef?: string },
) {
  const project = await getProject(principal, input);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://app.neonix.video";
  // app.neonix.video exposes clean editor URLs; middleware maps them to /app/editor.
  const editorUrl = new URL(`/editor/${project.id}`, appUrl).toString();
  return { project_id: project.id, public_ref: project.public_ref, editor_url: editorUrl };
}

export async function openPreview(
  principal: McpPrincipal,
  input: { projectId?: string; publicRef?: string },
) {
  const project = await getProject(principal, input);
  const projectPreviewUrl = new URL(`/preview/${project.id}`, previewUrl()).toString();
  return { project_id: project.id, public_ref: project.public_ref, preview_url: projectPreviewUrl };
}
