import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { compileDocument, type HtmlCompilerDiagnostic } from "@motionvideo/html-compiler";
import { MotionProtocolV2Schema, type MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";
import { applyMotionProtocolV2Patch } from "@motionvideo/motion-mcp";
import { HTML_COMPILER_FONT_ASSETS } from "../html-compiler-font-assets";

export type ProjectClient = SupabaseClient;

export type ProjectActor = {
  userId: string;
  clientId?: string;
};

export type WorkspaceRole = "owner" | "editor" | "viewer";

export type ProjectReference = {
  projectId?: string;
  publicRef?: string;
};

export type ProjectRepositoryErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_DOCUMENT"
  | "REVISION_CONFLICT"
  | "PROJECT_LIMIT_REACHED"
  | "DATABASE_ERROR";

const PROJECT_LIMIT_MESSAGE =
  "You've reached the free plan's limit of active projects. Delete an existing project, then try again.";

export class ProjectRepositoryError extends Error {
  constructor(
    message: string,
    readonly code: ProjectRepositoryErrorCode,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ProjectRepositoryError";
  }
}

type JsonObject = Record<string, unknown>;

type ProjectRow = {
  id: string;
  public_ref: string;
  workspace_id: string;
  title: string;
  current_revision_no: number;
  source_format: "protocol-v2" | "html";
  created_by: string;
  created_at: string;
  updated_at: string;
  last_activity_at?: string | null;
  deleted_at?: string | null;
  purge_after?: string | null;
};

type ProtocolRevisionRow = {
  id: string;
  project_id?: string;
  revision_no: number;
  document_json: JsonObject;
  content_hash: string;
  source_schema_version: number;
  reason: string;
  byte_size: number | null;
  created_by: string;
  created_at: string;
};

type HtmlRevisionRow = {
  id: string;
  project_id?: string;
  revision_no: number;
  protocol_revision_id: string | null;
  document_html: string;
  content_hash: string;
  document_schema_version: number;
  composition_json: JsonObject;
  diagnostics_json: HtmlCompilerDiagnostic[];
  byte_size: number;
  created_by?: string;
  created_at: string;
};

const PROJECT_COLUMNS =
  "id, public_ref, workspace_id, title, current_revision_no, source_format, created_by, created_at, updated_at, last_activity_at, deleted_at, purge_after";
const REVISION_COLUMNS =
  "id, project_id, revision_no, document_json, content_hash, source_schema_version, reason, byte_size, created_by, created_at";
const HTML_REVISION_COLUMNS =
  "id, project_id, revision_no, protocol_revision_id, document_html, content_hash, document_schema_version, composition_json, diagnostics_json, byte_size, created_by, created_at";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function jsonSize(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function isEditor(role: WorkspaceRole | null): boolean {
  return role === "owner" || role === "editor";
}

function throwDatabase(message: string, error?: { message?: string; code?: string } | null): never {
  if (error?.code === "P0003") throw new ProjectRepositoryError(PROJECT_LIMIT_MESSAGE, "PROJECT_LIMIT_REACHED");
  if (error) console.error("[projects] database operation failed", error.message);
  throw new ProjectRepositoryError(message, "DATABASE_ERROR");
}

function parseProtocol(value: unknown): MotionProtocolV2 {
  const parsed = MotionProtocolV2Schema.safeParse(value);
  if (!parsed.success) {
    throw new ProjectRepositoryError(
      "document must be a valid Neonix JSON V2 document",
      "INVALID_DOCUMENT",
      parsed.error.issues,
    );
  }
  return parsed.data;
}

function documentAssetIds(document: MotionProtocolV2): string[] {
  return [...new Set(
    document.assets
      .map((asset) => asset.id.startsWith("asset-") ? asset.id.slice("asset-".length) : asset.id)
      .filter(isUuid),
  )];
}

async function attachDocumentAssets(client: ProjectClient, actor: ProjectActor, project: ProjectRow, document: MotionProtocolV2) {
  const assetIds = documentAssetIds(document);
  if (assetIds.length === 0) return;

  const assets = await client
    .from("assets")
    .select("id")
    .eq("workspace_id", project.workspace_id)
    .in("id", assetIds)
    .is("deleted_at", null);
  if (assets.error) throwDatabase("Unable to resolve project assets", assets.error);
  const resolved = new Set((assets.data ?? []).map((asset) => String(asset.id)));
  if (assetIds.some((id) => !resolved.has(id))) {
    throw new ProjectRepositoryError("One or more project assets are not available", "NOT_FOUND");
  }
  const links = await client.from("project_assets").upsert(
    assetIds.map((assetId) => ({ project_id: project.id, asset_id: assetId, attached_by: actor.userId })),
    { onConflict: "project_id,asset_id", ignoreDuplicates: true },
  );
  if (links.error) throwDatabase("Unable to attach project assets", links.error);
}

async function audit(
  client: ProjectClient,
  actor: ProjectActor,
  input: { workspaceId: string; action: string; targetId?: string; metadata?: JsonObject },
) {
  const result = await client.from("audit_events").insert({
    workspace_id: input.workspaceId,
    actor_user_id: actor.userId,
    actor_client_id: actor.clientId ?? null,
    action: input.action,
    target_type: input.targetId ? "project" : null,
    target_id: input.targetId ?? null,
    metadata_json: input.metadata ?? {},
  });
  if (result.error) console.error("[projects] audit event failed", result.error.message);
}

function projectRef(input: ProjectReference): string {
  const value = input.projectId?.trim() || input.publicRef?.trim();
  if (!value) throw new ProjectRepositoryError("project_id or public_ref is required", "NOT_FOUND");
  return value;
}

async function findProject(client: ProjectClient, input: ProjectReference): Promise<ProjectRow> {
  const ref = projectRef(input);
  const query = client.from("projects").select(PROJECT_COLUMNS).is("deleted_at", null);
  const result = isUuid(ref)
    ? await query.eq("id", ref).maybeSingle()
    : await query.eq("public_ref", ref).maybeSingle();
  if (result.error) throwDatabase("Unable to read project", result.error);
  if (!result.data) throw new ProjectRepositoryError("Project not found or access denied", "NOT_FOUND");
  return result.data as unknown as ProjectRow;
}

async function roleForProject(client: ProjectClient, actor: ProjectActor, project: ProjectRow): Promise<WorkspaceRole | null> {
  const result = await client
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", project.workspace_id)
    .eq("user_id", actor.userId)
    .maybeSingle();
  if (result.error) throwDatabase("Unable to verify project access", result.error);
  const role = result.data?.role;
  return role === "owner" || role === "editor" || role === "viewer" ? role : null;
}

async function requireProject(
  client: ProjectClient,
  actor: ProjectActor,
  input: ProjectReference,
  requireEditor = false,
): Promise<{ project: ProjectRow; role: WorkspaceRole }> {
  const project = await findProject(client, input);
  const role = await roleForProject(client, actor, project);
  if (!role) throw new ProjectRepositoryError("Project not found or access denied", "NOT_FOUND");
  if (requireEditor && !isEditor(role)) {
    throw new ProjectRepositoryError("Editor access is required for this operation", "FORBIDDEN");
  }
  return { project, role };
}

/**
 * Shared authorization boundary for services that operate on project-owned
 * resources such as assets and exports. Keep the database row private while
 * exposing only the fields those services need.
 */
export async function getProjectAccess(
  client: ProjectClient,
  actor: ProjectActor,
  input: ProjectReference,
  requireEditor = false,
) {
  const { project, role } = await requireProject(client, actor, input, requireEditor);
  return {
    project: {
      id: project.id,
      publicRef: project.public_ref,
      workspaceId: project.workspace_id,
      title: project.title,
      currentRevisionNo: project.current_revision_no,
      sourceFormat: project.source_format,
    },
    role,
  };
}

async function latestProtocolRevision(client: ProjectClient, projectId: string): Promise<ProtocolRevisionRow | null> {
  const result = await client
    .from("project_revisions")
    .select(REVISION_COLUMNS)
    .eq("project_id", projectId)
    .order("revision_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (result.error) throwDatabase("Unable to read project revision", result.error);
  return result.data as unknown as ProtocolRevisionRow | null;
}

async function latestHtmlRevision(client: ProjectClient, projectId: string): Promise<HtmlRevisionRow | null> {
  const result = await client
    .from("project_html_revisions")
    .select(HTML_REVISION_COLUMNS)
    .eq("project_id", projectId)
    .order("revision_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (result.error) throwDatabase("Unable to read HTML revision", result.error);
  return result.data as unknown as HtmlRevisionRow | null;
}

function projectOutput(project: ProjectRow, revision: ProtocolRevisionRow | null) {
  return {
    id: project.id,
    publicRef: project.public_ref,
    workspaceId: project.workspace_id,
    title: project.title,
    currentRevisionNo: project.current_revision_no,
    sourceFormat: project.source_format,
    createdBy: project.created_by,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    revision: revision
      ? {
          id: revision.id,
          revisionNo: revision.revision_no,
          document: revision.document_json,
          contentHash: revision.content_hash,
          sourceSchemaVersion: revision.source_schema_version,
          reason: revision.reason,
          byteSize: revision.byte_size,
          createdBy: revision.created_by,
          createdAt: revision.created_at,
        }
      : null,
  };
}

export async function listProjects(
  client: ProjectClient,
  actor: ProjectActor,
  input: { workspaceId?: string; limit?: number } = {},
) {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
  let workspaceId = input.workspaceId;
  if (!workspaceId) {
    const membership = await client
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", actor.userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (membership.error) throwDatabase("Unable to list workspaces", membership.error);
    workspaceId = membership.data?.workspace_id;
  }
  if (!workspaceId) return { workspace: null, projects: [] };

  const result = await client
    .from("projects")
    .select(PROJECT_COLUMNS)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (result.error) throwDatabase("Unable to list projects", result.error);
  const projects = await Promise.all(
    ((result.data ?? []) as unknown as ProjectRow[]).map(async (project) =>
      projectOutput(project, await latestProtocolRevision(client, project.id))),
  );
  return { workspace: { id: workspaceId }, projects };
}

export async function getProject(client: ProjectClient, actor: ProjectActor, input: ProjectReference) {
  const { project } = await requireProject(client, actor, input);
  const revision = await latestProtocolRevision(client, project.id);
  return projectOutput(project, revision);
}

export async function getProjectJson(client: ProjectClient, actor: ProjectActor, input: ProjectReference) {
  const project = await getProject(client, actor, input);
  return {
    projectId: project.id,
    publicRef: project.publicRef,
    revision: project.revision,
  };
}

async function resolveWorkspace(client: ProjectClient, actor: ProjectActor, workspaceId?: string) {
  let id = workspaceId;
  if (!id) {
    const result = await client
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", actor.userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (result.error) throwDatabase("Unable to resolve workspace", result.error);
    id = result.data?.workspace_id;
  }
  if (!id) {
    const created = await client
      .from("workspaces")
      .insert({ name: "Personal workspace", created_by: actor.userId })
      .select("id")
      .single();
    if (created.error || !created.data) throwDatabase("Unable to create a personal workspace", created.error);
    id = created.data.id;
  }
  const membership = await client
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", id)
    .eq("user_id", actor.userId)
    .maybeSingle();
  if (membership.error) throwDatabase("Unable to verify workspace access", membership.error);
  const role = membership.data?.role;
  if (role !== "owner" && role !== "editor") {
    throw new ProjectRepositoryError("Editor access is required for this operation", "FORBIDDEN");
  }
  return { id, role: role as WorkspaceRole };
}

export async function createProject(
  client: ProjectClient,
  actor: ProjectActor,
  input: { workspaceId?: string; title?: string; document: unknown },
) {
  const document = parseProtocol(input.document);
  const workspace = await resolveWorkspace(client, actor, input.workspaceId);
  const title = input.title?.trim() || "Untitled project";
  const created = await client
    .from("projects")
    .insert({
      workspace_id: workspace.id,
      title,
      created_by: actor.userId,
      current_revision_no: 0,
      source_format: "protocol-v2",
    })
    .select(PROJECT_COLUMNS)
    .single();
  if (created.error || !created.data) throwDatabase("Unable to create project", created.error);
  const project = created.data as unknown as ProjectRow;
  await attachDocumentAssets(client, actor, project, document);
  const revision = await client
    .from("project_revisions")
    .insert({
      project_id: project.id,
      revision_no: 1,
      document_json: document,
      content_hash: hash(JSON.stringify(document)),
      source_schema_version: document.formatVersion,
      reason: "mcp",
      byte_size: jsonSize(document),
      created_by: actor.userId,
    })
    .select(REVISION_COLUMNS)
    .single();
  if (revision.error || !revision.data) {
    await client.from("projects").delete().eq("id", project.id);
    throwDatabase("Unable to create initial project revision", revision.error);
  }
  const activated = await client
    .from("projects")
    .update({ current_revision_no: 1, last_activity_at: new Date().toISOString() })
    .eq("id", project.id);
  if (activated.error) throwDatabase("Unable to activate initial project revision", activated.error);
  await audit(client, actor, {
    workspaceId: project.workspace_id,
    action: "project.create",
    targetId: project.id,
    metadata: { revisionNo: 1, source: "protocol-v2" },
  });
  return {
    project: projectOutput({ ...project, current_revision_no: 1 }, revision.data as unknown as ProtocolRevisionRow),
    workspace,
  };
}

export async function createProjectHtml(
  client: ProjectClient,
  actor: ProjectActor,
  input: { workspaceId?: string; title?: string; html: string; idempotencyKey?: string },
) {
  if (!input.html.trim()) throw new ProjectRepositoryError("html is required", "INVALID_DOCUMENT");

  const compiled = compileDocument({ html: input.html, fontAssets: HTML_COMPILER_FONT_ASSETS });
  const errors = compiled.diagnostics.filter((item) => item.severity === "error");
  if (compiled.status !== "success" || !compiled.protocol || errors.length > 0) {
    throw new ProjectRepositoryError(
      errors[0]?.message ?? "HTML document could not be compiled",
      "INVALID_DOCUMENT",
      compiled.diagnostics,
    );
  }

  const workspace = await resolveWorkspace(client, actor, input.workspaceId);
  const title = input.title?.trim() || "Untitled project";
  const document = compiled.protocol as unknown as JsonObject;
  const committed = await client.rpc("create_html_project", {
    p_workspace_id: workspace.id,
    p_title: title,
    p_document_html: input.html,
    p_document_json: document,
    p_composition_json: compiled.source.composition,
    p_diagnostics_json: compiled.diagnostics,
    p_html_content_hash: hash(input.html),
    p_html_byte_size: Buffer.byteLength(input.html, "utf8"),
    p_json_content_hash: hash(JSON.stringify(document)),
    p_json_byte_size: jsonSize(document),
    p_document_schema_version: compiled.protocol.formatVersion,
    p_asset_ids: documentAssetIds(compiled.protocol),
    p_idempotency_key: input.idempotencyKey?.trim() || null,
    p_idempotency_hash: hash(JSON.stringify({ title, html: input.html })),
  });
  if (committed.error || !committed.data) {
    if (committed.error?.code === "P0002") throw new ProjectRepositoryError("Project revision conflict", "REVISION_CONFLICT");
    throwDatabase("Unable to create HTML project", committed.error);
  }

  const commit = committed.data as unknown as {
    projectId: string;
    protocolRevisionId: string;
    htmlRevisionId: string;
    alreadyCreated?: boolean;
  };
  const [createdProject, protocolRevision, htmlRevision] = await Promise.all([
    client.from("projects").select(PROJECT_COLUMNS).eq("id", commit.projectId).single(),
    client.from("project_revisions").select(REVISION_COLUMNS).eq("id", commit.protocolRevisionId).single(),
    client.from("project_html_revisions").select(HTML_REVISION_COLUMNS).eq("id", commit.htmlRevisionId).single(),
  ]);
  if (createdProject.error || !createdProject.data) throwDatabase("Unable to read created HTML project", createdProject.error);
  if (protocolRevision.error || !protocolRevision.data) throwDatabase("Unable to read created Neonix JSON V2 revision", protocolRevision.error);
  if (htmlRevision.error || !htmlRevision.data) throwDatabase("Unable to read created HTML revision", htmlRevision.error);

  const project = createdProject.data as unknown as ProjectRow;
  const revision = protocolRevision.data as unknown as ProtocolRevisionRow;
  if (!commit.alreadyCreated) {
    await audit(client, actor, {
      workspaceId: project.workspace_id,
      action: "project.create",
      targetId: project.id,
      metadata: { revisionNo: revision.revision_no, source: "html" },
    });
  }

  return {
    project: projectOutput(project, revision),
    workspace,
    htmlRevision: htmlRevision.data,
    protocolRevision: protocolRevision.data,
    diagnostics: compiled.diagnostics,
    alreadyCreated: commit.alreadyCreated ?? false,
  };
}

export async function updateProject(
  client: ProjectClient,
  actor: ProjectActor,
  input: ProjectReference & { title?: string; document?: unknown; expectedRevisionNo?: number },
) {
  const { project } = await requireProject(client, actor, input, true);
  if (input.title === undefined && input.document === undefined) {
    throw new ProjectRepositoryError("Provide title or document to update", "INVALID_DOCUMENT");
  }
  if (input.expectedRevisionNo !== undefined && input.expectedRevisionNo !== project.current_revision_no) {
    throw new ProjectRepositoryError("Project revision conflict", "REVISION_CONFLICT");
  }

  let revision: ProtocolRevisionRow | null = null;
  const updates: Record<string, unknown> = { last_activity_at: new Date().toISOString() };
  if (input.title !== undefined) updates.title = input.title.trim();
  if (input.document !== undefined) {
    const document = parseProtocol(input.document);
    await attachDocumentAssets(client, actor, project, document);
    const nextRevisionNo = project.current_revision_no + 1;
    const inserted = await client
      .from("project_revisions")
      .insert({
        project_id: project.id,
        revision_no: nextRevisionNo,
        document_json: document,
        content_hash: hash(JSON.stringify(document)),
        source_schema_version: document.formatVersion,
        reason: "mcp",
        byte_size: jsonSize(document),
        created_by: actor.userId,
      })
      .select(REVISION_COLUMNS)
      .single();
    if (inserted.error || !inserted.data) {
      if (inserted.error?.code === "23505") throw new ProjectRepositoryError("Project revision conflict", "REVISION_CONFLICT");
      throwDatabase("Unable to create project revision", inserted.error);
    }
    revision = inserted.data as unknown as ProtocolRevisionRow;
    updates.current_revision_no = nextRevisionNo;
  }
  const updated = await client
    .from("projects")
    .update(updates)
    .eq("id", project.id)
    .select(PROJECT_COLUMNS)
    .single();
  if (updated.error || !updated.data) throwDatabase("Unable to update project", updated.error);
  await audit(client, actor, {
    workspaceId: project.workspace_id,
    action: "project.update",
    targetId: project.id,
    metadata: { revisionNo: updated.data.current_revision_no, source: "protocol-v2" },
  });
  return { project: updated.data, revision };
}

export async function getProjectHtml(client: ProjectClient, actor: ProjectActor, input: ProjectReference) {
  const { project } = await requireProject(client, actor, input);
  const [revision, latestProtocol] = await Promise.all([
    latestHtmlRevision(client, project.id),
    latestProtocolRevision(client, project.id),
  ]);
  if (!revision) throw new ProjectRepositoryError("Project does not contain an HTML source", "NOT_FOUND");
  // The HTML source and the canonical Protocol V2 revision are linked at
  // write time (protocol_revision_id). If a later apply_json_patch or editor
  // save advanced the protocol revision without going through this HTML
  // source, that link now points at a stale revision — saving this HTML
  // back would silently discard whatever changed the JSON since then.
  const htmlSyncStatus: "synced" | "stale" =
    revision.protocol_revision_id === (latestProtocol?.id ?? null) ? "synced" : "stale";
  return {
    project: projectOutput(project, latestProtocol),
    html: revision.document_html,
    htmlRevision: revision,
    htmlSyncStatus,
  };
}

export async function updateProjectHtml(
  client: ProjectClient,
  actor: ProjectActor,
  input: ProjectReference & {
    html: string;
    expectedHtmlRevisionNo?: number;
    expectedProtocolRevisionNo?: number;
  },
) {
  const { project } = await requireProject(client, actor, input, true);
  if (!input.html.trim()) throw new ProjectRepositoryError("html is required", "INVALID_DOCUMENT");
  if (input.expectedProtocolRevisionNo !== undefined && input.expectedProtocolRevisionNo !== project.current_revision_no) {
    throw new ProjectRepositoryError("Project revision conflict", "REVISION_CONFLICT");
  }
  const [previousHtml, latestProtocolBeforeCommit] = await Promise.all([
    latestHtmlRevision(client, project.id),
    latestProtocolRevision(client, project.id),
  ]);
  if (input.expectedHtmlRevisionNo !== undefined && (previousHtml?.revision_no ?? 0) !== input.expectedHtmlRevisionNo) {
    throw new ProjectRepositoryError("HTML revision conflict", "REVISION_CONFLICT");
  }
  // The project's JSON can be edited independently of HTML (native editor,
  // applyJsonPatch). This is a one-way flow: an HTML save always wins and
  // overwrites the current JSON, so callers must be told when that happened,
  // since those independent JSON edits are being discarded right now.
  const discardedIndependentJsonEdits =
    previousHtml !== null && previousHtml.protocol_revision_id !== (latestProtocolBeforeCommit?.id ?? null);

  const compiled = compileDocument({ html: input.html, fontAssets: HTML_COMPILER_FONT_ASSETS });
  const errors = compiled.diagnostics.filter((item) => item.severity === "error");
  if (compiled.status !== "success" || !compiled.protocol || errors.length > 0) {
    throw new ProjectRepositoryError(
      errors[0]?.message ?? "HTML document could not be compiled",
      "INVALID_DOCUMENT",
      compiled.diagnostics,
    );
  }

  await attachDocumentAssets(client, actor, project, compiled.protocol);
  const document = compiled.protocol as unknown as JsonObject;
  const committed = await client.rpc("commit_html_revision", {
    p_project_id: project.id,
    p_document_html: input.html,
    p_document_json: document,
    p_composition_json: compiled.source.composition,
    p_diagnostics_json: compiled.diagnostics,
    p_html_content_hash: hash(input.html),
    p_html_byte_size: Buffer.byteLength(input.html, "utf8"),
    p_json_content_hash: hash(JSON.stringify(document)),
    p_json_byte_size: jsonSize(document),
    p_document_schema_version: compiled.protocol.formatVersion,
    p_expected_protocol_revision_no: input.expectedProtocolRevisionNo ?? null,
    p_expected_html_revision_no: input.expectedHtmlRevisionNo ?? null,
  });
  if (committed.error || !committed.data) {
    if (committed.error?.code === "P0002") throw new ProjectRepositoryError("Project revision conflict", "REVISION_CONFLICT");
    throwDatabase("Unable to commit HTML and Neonix JSON V2 revisions", committed.error);
  }
  const commit = committed.data as unknown as {
    projectId: string;
    revisionNo: number;
    protocolRevisionId: string;
    htmlRevisionId: string;
  };
  const [canonical, htmlRevision, updated] = await Promise.all([
    client.from("project_revisions").select(REVISION_COLUMNS).eq("id", commit.protocolRevisionId).single(),
    client.from("project_html_revisions").select(HTML_REVISION_COLUMNS).eq("id", commit.htmlRevisionId).single(),
    client.from("projects").select(PROJECT_COLUMNS).eq("id", project.id).single(),
  ]);
  if (canonical.error || !canonical.data) throwDatabase("Unable to read committed Neonix JSON V2 revision", canonical.error);
  if (htmlRevision.error || !htmlRevision.data) throwDatabase("Unable to read committed HTML revision", htmlRevision.error);
  if (updated.error || !updated.data) throwDatabase("Unable to read updated project", updated.error);
  const revisionNo = commit.revisionNo;
  await audit(client, actor, {
    workspaceId: project.workspace_id,
    action: "project.html.update",
    targetId: project.id,
    metadata: { revisionNo, protocolRevisionId: commit.protocolRevisionId, discardedIndependentJsonEdits },
  });
  return {
    project: projectOutput(updated.data as unknown as ProjectRow, canonical.data as unknown as ProtocolRevisionRow),
    htmlRevision: htmlRevision.data,
    protocolRevision: canonical.data,
    diagnostics: compiled.diagnostics,
    warning: discardedIndependentJsonEdits
      ? {
          code: "DISCARDED_INDEPENDENT_JSON_EDITS",
          message:
            "This HTML save overwrote JSON changes made independently since the HTML was last saved (revision "
            + `${latestProtocolBeforeCommit?.revision_no ?? "unknown"} is no longer current).`,
          discardedProtocolRevisionNo: latestProtocolBeforeCommit?.revision_no ?? null,
        }
      : null,
  };
}

export async function listHtmlRevisions(client: ProjectClient, actor: ProjectActor, input: ProjectReference) {
  const { project } = await requireProject(client, actor, input);
  const result = await client
    .from("project_html_revisions")
    .select(HTML_REVISION_COLUMNS)
    .eq("project_id", project.id)
    .order("revision_no", { ascending: false });
  if (result.error) throwDatabase("Unable to list HTML revisions", result.error);
  return { projectId: project.id, revisions: result.data ?? [] };
}

export async function getHtmlRevision(client: ProjectClient, actor: ProjectActor, input: ProjectReference & { revisionNo: number }) {
  const { project } = await requireProject(client, actor, input);
  const result = await client
    .from("project_html_revisions")
    .select(HTML_REVISION_COLUMNS)
    .eq("project_id", project.id)
    .eq("revision_no", input.revisionNo)
    .maybeSingle();
  if (result.error) throwDatabase("Unable to read HTML revision", result.error);
  if (!result.data) throw new ProjectRepositoryError("HTML revision not found", "NOT_FOUND");
  return { projectId: project.id, revision: result.data };
}

export async function getProtocolRevision(client: ProjectClient, actor: ProjectActor, input: ProjectReference & { revisionNo: number }) {
  const { project } = await requireProject(client, actor, input);
  const result = await client
    .from("project_revisions")
    .select(REVISION_COLUMNS)
    .eq("project_id", project.id)
    .eq("revision_no", input.revisionNo)
    .maybeSingle();
    if (result.error) throwDatabase("Unable to read Neonix JSON V2 revision", result.error);
  if (!result.data) throw new ProjectRepositoryError("Neonix JSON V2 revision not found", "NOT_FOUND");
  const revision = result.data as unknown as ProtocolRevisionRow;
  return { projectId: project.id, revision: { ...revision, document: parseProtocol(revision.document_json) } };
}

export async function applyJsonPatch(
  client: ProjectClient,
  actor: ProjectActor,
  input: ProjectReference & { patch: unknown; expectedProtocolRevisionNo: number },
) {
  const { project } = await requireProject(client, actor, input, true);
  if (project.current_revision_no !== input.expectedProtocolRevisionNo) {
    throw new ProjectRepositoryError("Project revision conflict", "REVISION_CONFLICT");
  }
  const latest = await latestProtocolRevision(client, project.id);
  if (!latest) throw new ProjectRepositoryError("Project has no source revision", "NOT_FOUND");
  const result = applyMotionProtocolV2Patch(parseProtocol(latest.document_json), input.patch);
  if (!result.project || result.diagnostics.some((item) => item.severity === "error")) {
    throw new ProjectRepositoryError("JSON patch could not be applied", "INVALID_DOCUMENT", result.diagnostics);
  }
  const document = result.project;
  await attachDocumentAssets(client, actor, project, document);
  const nextRevisionNo = project.current_revision_no + 1;
  const inserted = await client
    .from("project_revisions")
    .insert({
      project_id: project.id,
      revision_no: nextRevisionNo,
      document_json: document,
      content_hash: hash(JSON.stringify(document)),
      source_schema_version: document.formatVersion,
      // Keep the reason within the database's canonical revision reason enum.
      // The operation type is already captured by the audit event below.
      reason: "mcp",
      byte_size: jsonSize(document),
      created_by: actor.userId,
    })
    .select(REVISION_COLUMNS)
    .single();
  if (inserted.error || !inserted.data) {
    if (inserted.error?.code === "23505") throw new ProjectRepositoryError("Project revision conflict", "REVISION_CONFLICT");
    throwDatabase("Unable to create patched project revision", inserted.error);
  }
  const updated = await client
    .from("projects")
    // The project_revisions_set_head trigger advances current_revision_no as
    // soon as the immutable revision is inserted. Match that post-insert
    // value instead of comparing against the pre-insert revision.
    .update({ source_format: "protocol-v2", last_activity_at: new Date().toISOString() })
    .eq("id", project.id)
    .eq("current_revision_no", nextRevisionNo)
    .select(PROJECT_COLUMNS)
    .single();
  if (updated.error || !updated.data) throwDatabase("Unable to activate patched project revision", updated.error);
  await audit(client, actor, {
    workspaceId: project.workspace_id,
    action: "project.json-patch",
    targetId: project.id,
    metadata: { revisionNo: nextRevisionNo },
  });
  return {
    project: projectOutput(updated.data as unknown as ProjectRow, inserted.data as unknown as ProtocolRevisionRow),
    diagnostics: result.diagnostics,
    htmlSyncStatus: "stale" as const,
  };
}

export async function deleteProject(client: ProjectClient, actor: ProjectActor, input: ProjectReference) {
  const { project } = await requireProject(client, actor, input, true);
  const result = await client.rpc("request_project_deletion", { requested_project_id: project.id });
  if (result.error) throwDatabase("Unable to delete project", result.error);
  await audit(client, actor, {
    workspaceId: project.workspace_id,
    action: "project.delete",
    targetId: project.id,
  });
  return { projectId: project.id, deleted: true };
}
