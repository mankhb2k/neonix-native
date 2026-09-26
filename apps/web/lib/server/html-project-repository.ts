import "server-only";

import { createHash } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type HtmlCompilerDiagnostic, type HtmlCompilerOptions, type HtmlCompilerResult } from "@motionvideo/html-compiler";
import { MotionProtocolV2Schema } from "@motionvideo/motion-protocol/v2";
import { logCompileDiagnostics } from "./compile-diagnostics-log";
import { HTML_COMPILER_FONT_ASSETS } from "./html-compiler-font-assets";
import { compileHtmlWithLayoutSnapshot } from "./layout-snapshot";

type JsonObject = Record<string, unknown>;

type ProjectRow = {
  id: string;
  public_ref: string;
  workspace_id: string;
  title: string;
  current_revision_no: number;
  source_format: "protocol-v2" | "html";
  created_at: string;
  updated_at: string;
};

type HtmlRevisionRow = {
  id: string;
  revision_no: number;
  protocol_revision_id: string | null;
  document_html: string;
  content_hash: string;
  document_schema_version: number;
  composition_json: JsonObject;
  diagnostics_json: HtmlCompilerDiagnostic[];
  byte_size: number;
  created_at: string;
};

export type HtmlProjectErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_DOCUMENT"
  | "REVISION_CONFLICT"
  | "DATABASE_ERROR";

export class HtmlProjectError extends Error {
  constructor(message: string, readonly code: HtmlProjectErrorCode) {
    super(message);
    this.name = "HtmlProjectError";
  }
}

function hashHtml(html: string): string {
  return createHash("sha256").update(html, "utf8").digest("hex");
}

function byteSize(html: string): number {
  return Buffer.byteLength(html, "utf8");
}

function diagnostics(result: HtmlCompilerResult): HtmlCompilerDiagnostic[] {
  return result.diagnostics;
}

function parseError(result: HtmlCompilerResult): string {
  const first = result.diagnostics.find((item) => item.severity === "error");
  return first?.message ?? "HTML document is invalid";
}

async function authenticatedClient() {
  let client;
  try {
    client = await createSupabaseServerClient();
  } catch {
    throw new HtmlProjectError("Authentication is not configured", "UNAUTHENTICATED");
  }
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw new HtmlProjectError("Authentication required", "UNAUTHENTICATED");
  }
  return { client, user: data.user };
}

async function firstWorkspace(
  client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  createIfMissing = true,
) {
  const { data, error } = await client
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new HtmlProjectError("Unable to resolve workspace", "DATABASE_ERROR");
  if (data?.workspace_id) {
    return { id: data.workspace_id as string, role: data.role as string };
  }
  if (!createIfMissing) return null;

  const created = await client
    .from("workspaces")
    .insert({ name: "Personal workspace", created_by: userId })
    .select("id")
    .single();
  if (created.error || !created.data) {
    throw new HtmlProjectError("Unable to create a personal workspace", "DATABASE_ERROR");
  }
  return { id: created.data.id as string, role: "owner" };
}

function isEditor(role: string): boolean {
  return role === "owner" || role === "editor";
}

async function compileHtml(html: string, options: HtmlCompilerOptions = {}): Promise<HtmlCompilerResult> {
  const result = await compileHtmlWithLayoutSnapshot({ html }, HTML_COMPILER_FONT_ASSETS, options);
  logCompileDiagnostics(result.diagnostics);
  return result;
}

function projectResponse(project: ProjectRow, revision: HtmlRevisionRow | null) {
  return {
    id: project.id,
    publicRef: project.public_ref,
    title: project.title,
    sourceFormat: project.source_format,
    currentRevisionNo: project.current_revision_no,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    revision: revision
      ? {
          id: revision.id,
          revisionNo: revision.revision_no,
          protocolRevisionId: revision.protocol_revision_id,
          contentHash: revision.content_hash,
          composition: revision.composition_json,
          diagnostics: revision.diagnostics_json,
          byteSize: revision.byte_size,
          createdAt: revision.created_at,
        }
      : null,
  };
}

async function findProject(
  client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  projectRef: string,
): Promise<ProjectRow> {
  const byId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectRef);
  const query = client
    .from("projects")
    .select("id, public_ref, workspace_id, title, current_revision_no, source_format, created_at, updated_at")
    .is("deleted_at", null);
  const result = byId
    ? await query.eq("id", projectRef).maybeSingle()
    : await query.eq("public_ref", projectRef).maybeSingle();
  if (result.error) throw new HtmlProjectError("Unable to read project", "DATABASE_ERROR");
  if (!result.data) throw new HtmlProjectError("Project not found or access denied", "NOT_FOUND");
  return result.data;
}

async function latestRevision(
  client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  projectId: string,
): Promise<HtmlRevisionRow | null> {
  const result = await client
    .from("project_html_revisions")
    .select("id, revision_no, protocol_revision_id, document_html, content_hash, document_schema_version, composition_json, diagnostics_json, byte_size, created_at")
    .eq("project_id", projectId)
    .order("revision_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (result.error) throw new HtmlProjectError("Unable to read HTML revision", "DATABASE_ERROR");
  return result.data;
}

async function saveRevision(
  client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  project: ProjectRow,
  html: string,
  reason: "manual" | "mcp" = "manual",
) {
  const result = await compileHtml(html);
  if (result.status !== "success" || !result.protocol) {
    throw new HtmlProjectError(parseError(result), "INVALID_DOCUMENT");
  }
  const revisionNo = project.current_revision_no + 1;
  const composition: JsonObject = result.source.composition;
  const documentJson = result.protocol as unknown as JsonObject;
  const canonical = await client
    .from("project_revisions")
    .insert({
      project_id: project.id,
      revision_no: revisionNo,
      document_json: documentJson,
      content_hash: hashHtml(JSON.stringify(documentJson)),
      source_schema_version: result.protocol.formatVersion,
      reason: "import",
      byte_size: byteSize(JSON.stringify(documentJson)),
      created_by: userId,
    })
    .select("id, revision_no")
    .single();
  if (canonical.error || !canonical.data) {
    throw new HtmlProjectError("Unable to create canonical Neonix JSON V2 revision", "DATABASE_ERROR");
  }
  const inserted = await client
    .from("project_html_revisions")
    .insert({
      project_id: project.id,
      revision_no: revisionNo,
      protocol_revision_id: canonical.data.id,
      document_html: html,
      content_hash: hashHtml(html),
      document_schema_version: 2,
      composition_json: composition,
      diagnostics_json: diagnostics(result),
      byte_size: byteSize(html),
      created_by: userId,
    })
    .select("id, revision_no, protocol_revision_id, document_html, content_hash, document_schema_version, composition_json, diagnostics_json, byte_size, created_at")
    .single();
  if (inserted.error || !inserted.data) {
    throw new HtmlProjectError("Unable to create HTML revision", "DATABASE_ERROR");
  }
  const updated = await client
    .from("projects")
    .update({ current_revision_no: revisionNo, source_format: "html", last_activity_at: new Date().toISOString() })
    .eq("id", project.id);
  if (updated.error) throw new HtmlProjectError("Unable to activate HTML revision", "DATABASE_ERROR");
  return { result, revision: inserted.data, protocolRevision: canonical.data, reason };
}

export async function createHtmlProject(input: { title: string; html: string }) {
  const { client, user } = await authenticatedClient();
  const workspace = await firstWorkspace(client, user.id);
  if (!workspace) throw new HtmlProjectError("Unable to resolve workspace", "DATABASE_ERROR");
  if (!isEditor(workspace.role)) throw new HtmlProjectError("Editor access is required", "FORBIDDEN");
  const title = input.title.trim() || "Untitled project";
  const created = await client
    .from("projects")
    .insert({ workspace_id: workspace.id, title, created_by: user.id, source_format: "html", current_revision_no: 0 })
    .select("id, public_ref, workspace_id, title, current_revision_no, source_format, created_at, updated_at")
    .single();
  if (created.error || !created.data) throw new HtmlProjectError("Unable to create project", "DATABASE_ERROR");
  const project = created.data;
  try {
    const saved = await saveRevision(client, user.id, project, input.html);
    return { project: projectResponse({ ...project, current_revision_no: 1, source_format: "html" }, saved.revision) };
  } catch (error) {
    await client.from("projects").delete().eq("id", project.id);
    throw error;
  }
}

export async function listHtmlProjects(limit = 20) {
  const { client, user } = await authenticatedClient();
  const workspace = await firstWorkspace(client, user.id, false);
  if (!workspace) return { workspace: null, projects: [] };
  const result = await client
    .from("projects")
    .select("id, public_ref, workspace_id, title, current_revision_no, source_format, created_at, updated_at")
    .eq("workspace_id", workspace.id)
    .eq("source_format", "html")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));
  if (result.error) throw new HtmlProjectError("Unable to list projects", "DATABASE_ERROR");
  const projects = await Promise.all(
    (result.data ?? []).map(async (project) => {
      const projectId = String(project.id as unknown);
      return projectResponse(project, await latestRevision(client, projectId));
    }),
  );
  return { workspace: { id: workspace.id }, projects };
}

export async function getHtmlProject(projectRef: string) {
  const { client } = await authenticatedClient();
  const project = await findProject(client, projectRef);
  const revision = await latestRevision(client, project.id);
  if (project.source_format !== "html" && !revision) {
    throw new HtmlProjectError("Project does not contain an HTML source", "NOT_FOUND");
  }
  return {
    project: projectResponse(project, revision),
    html: revision?.document_html ?? null,
  };
}

export async function saveHtmlProject(input: { projectRef: string; html: string; expectedRevisionNo: number }) {
  const { client, user } = await authenticatedClient();
  const project = await findProject(client, input.projectRef);
  const { data: membership, error: membershipError } = await client
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", project.workspace_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipError) throw new HtmlProjectError("Unable to verify project access", "DATABASE_ERROR");
  if (!membership || !isEditor(String(membership.role))) throw new HtmlProjectError("Editor access is required", "FORBIDDEN");
  if (input.expectedRevisionNo !== project.current_revision_no) {
    throw new HtmlProjectError(
      `Revision conflict: expected ${input.expectedRevisionNo}, current is ${project.current_revision_no}`,
      "REVISION_CONFLICT",
    );
  }
  const saved = await saveRevision(client, user.id, project, input.html);
  return { project: projectResponse({ ...project, current_revision_no: project.current_revision_no + 1, source_format: "html" }, saved.revision) };
}

export async function deleteHtmlProject(projectRef: string) {
  const { client } = await authenticatedClient();
  const project = await findProject(client, projectRef);
  const { error } = await client.rpc("request_project_deletion", {
    requested_project_id: project.id,
  });
  if (error) throw new HtmlProjectError("Unable to delete project", "DATABASE_ERROR");
  return { projectId: project.id, deleted: true };
}

export async function compileHtmlDocument(html: string, options: HtmlCompilerOptions = {}): Promise<HtmlCompilerResult> {
  return compileHtml(html, options);
}

export async function listHtmlRevisions(projectRef: string) {
  const { client } = await authenticatedClient();
  const project = await findProject(client, projectRef);
  const result = await client
    .from("project_html_revisions")
    .select("id, revision_no, protocol_revision_id, content_hash, document_schema_version, composition_json, diagnostics_json, byte_size, created_at")
    .eq("project_id", project.id)
    .order("revision_no", { ascending: false });
  if (result.error) throw new HtmlProjectError("Unable to list HTML revisions", "DATABASE_ERROR");
  return { projectId: project.id, revisions: result.data ?? [] };
}

export async function getHtmlRevision(projectRef: string, revisionNo: number) {
  const { client } = await authenticatedClient();
  const project = await findProject(client, projectRef);
  const result = await client
    .from("project_html_revisions")
    .select("id, revision_no, protocol_revision_id, document_html, content_hash, document_schema_version, composition_json, diagnostics_json, byte_size, created_at")
    .eq("project_id", project.id)
    .eq("revision_no", revisionNo)
    .maybeSingle();
  if (result.error) throw new HtmlProjectError("Unable to read HTML revision", "DATABASE_ERROR");
  if (!result.data) throw new HtmlProjectError("HTML revision not found", "NOT_FOUND");
  return { projectId: project.id, revision: result.data };
}

export async function getProtocolRevision(projectRef: string, revisionNo: number) {
  const { client } = await authenticatedClient();
  const project = await findProject(client, projectRef);
  const result = await client
    .from("project_revisions")
    .select("id, revision_no, document_json, content_hash, source_schema_version, reason, byte_size, created_at")
    .eq("project_id", project.id)
    .eq("revision_no", revisionNo)
    .maybeSingle();
  if (result.error) throw new HtmlProjectError("Unable to read Neonix JSON V2 revision", "DATABASE_ERROR");
  if (!result.data) throw new HtmlProjectError("Neonix JSON V2 revision not found", "NOT_FOUND");
  const parsed = MotionProtocolV2Schema.safeParse(result.data.document_json);
  if (!parsed.success) throw new HtmlProjectError("Neonix JSON V2 revision is invalid", "INVALID_DOCUMENT");
  return {
    projectId: project.id,
    revision: {
      ...result.data,
      document: parsed.data,
    },
  };
}
