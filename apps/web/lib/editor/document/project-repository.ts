import "server-only";

import { createHash } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MotionProtocolV2Schema, type MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

type JsonObject = Record<string, unknown>;

type ProjectRow = {
  id: string;
  public_ref: string;
  workspace_id: string;
  title: string;
  current_revision_no: number;
  updated_at: string;
};

type RevisionRow = {
  id: string;
  revision_no: number;
  document_json: unknown;
};

const PROJECT_COLUMNS =
  "id, public_ref, workspace_id, title, current_revision_no, created_at, updated_at, last_activity_at, deleted_at, purge_after";
const REVISION_COLUMNS =
  "id, revision_no, document_json, content_hash, source_schema_version, reason, byte_size, created_at";

export type EditorProjectSnapshot = {
  projectId: string;
  publicRef: string;
  workspaceId: string;
  title: string;
  revisionNo: number;
  revisionId: string;
  document: MotionProtocolV2;
  source: "supabase";
};

export type EditorProjectListItem = Pick<
  EditorProjectSnapshot,
  "projectId" | "publicRef" | "workspaceId" | "title" | "revisionNo"
> & {
  updatedAt: string;
};

export type ProjectRepositoryErrorCode =
  | "UNAUTHENTICATED"
  | "NOT_FOUND"
  | "INVALID_DOCUMENT"
  | "REVISION_CONFLICT"
  | "DATABASE_ERROR";

export class ProjectRepositoryError extends Error {
  constructor(
    message: string,
    readonly code: ProjectRepositoryErrorCode,
  ) {
    super(message);
    this.name = "ProjectRepositoryError";
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function hashDocument(document: JsonObject): string {
  return createHash("sha256").update(JSON.stringify(document)).digest("hex");
}

function documentByteSize(document: JsonObject): number {
  return Buffer.byteLength(JSON.stringify(document), "utf8");
}

async function authenticatedClient() {
  const client = await createSupabaseServerClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw new ProjectRepositoryError(
      "Sign in to access this project",
      "UNAUTHENTICATED",
    );
  }
  return { client, user: data.user };
}

async function findProject(client: Awaited<ReturnType<typeof createSupabaseServerClient>>, projectRef: string) {
  const query = client
    .from("projects")
    .select(PROJECT_COLUMNS)
    .is("deleted_at", null);
  const { data, error } = isUuid(projectRef)
    ? await query.eq("id", projectRef).maybeSingle()
    : await query.eq("public_ref", projectRef).maybeSingle();

  if (error) {
    throw new ProjectRepositoryError(
      "Unable to read project",
      "DATABASE_ERROR",
    );
  }
  if (!data) {
    throw new ProjectRepositoryError(
      "Project not found or access denied",
      "NOT_FOUND",
    );
  }
  return data as unknown as ProjectRow;
}

async function latestRevision(
  client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  projectId: string,
) {
  const { data, error } = await client
    .from("project_revisions")
    .select(REVISION_COLUMNS)
    .eq("project_id", projectId)
    .order("revision_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new ProjectRepositoryError(
      "Unable to read project revision",
      "DATABASE_ERROR",
    );
  }
  if (!data) {
    throw new ProjectRepositoryError(
      "Project has no source revision",
      "NOT_FOUND",
    );
  }
  return data as unknown as RevisionRow;
}

function parseDocument(value: unknown): MotionProtocolV2 {
  const parsed = MotionProtocolV2Schema.safeParse(value);
  if (!parsed.success) {
    throw new ProjectRepositoryError(
      "Project source is not a valid Motion Protocol V2 document",
      "INVALID_DOCUMENT",
    );
  }
  return parsed.data;
}

export async function loadProject(
  projectRef: string,
): Promise<EditorProjectSnapshot> {
  const { client } = await authenticatedClient();
  const project = await findProject(client, projectRef);
  const revision = await latestRevision(client, project.id);

  return {
    projectId: project.id,
    publicRef: project.public_ref,
    workspaceId: project.workspace_id,
    title: project.title,
    revisionNo: revision.revision_no,
    revisionId: revision.id,
    document: parseDocument(revision.document_json),
    source: "supabase",
  };
}

export async function listProjects(
  limit = 50,
): Promise<EditorProjectListItem[]> {
  const { client } = await authenticatedClient();
  const { data, error } = await client
    .from("projects")
    .select(PROJECT_COLUMNS)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(Math.max(1, Math.min(100, limit)));

  if (error) {
    throw new ProjectRepositoryError(
      "Unable to list projects",
      "DATABASE_ERROR",
    );
  }
  const rows = (data ?? []) as unknown as ProjectRow[];
  return rows.map((project) => ({
    projectId: project.id,
    publicRef: project.public_ref,
    workspaceId: project.workspace_id,
    title: project.title,
    revisionNo: project.current_revision_no,
    updatedAt: project.updated_at,
  }));
}

export async function saveProject(
  projectRef: string,
  document: MotionProtocolV2,
  expectedRevisionNo: number,
): Promise<EditorProjectSnapshot> {
  const { client, user } = await authenticatedClient();
  const project = await findProject(client, projectRef);
  const currentRevision = await latestRevision(client, project.id);

  if (currentRevision.revision_no !== expectedRevisionNo) {
    throw new ProjectRepositoryError(
      `Revision conflict: expected ${expectedRevisionNo}, current is ${currentRevision.revision_no}`,
      "REVISION_CONFLICT",
    );
  }

  const validDocument = parseDocument(document);
  const nextRevisionNo = currentRevision.revision_no + 1;
  const documentJson = validDocument as unknown as JsonObject;
  const { data: revision, error } = await client
    .from("project_revisions")
    .insert({
      project_id: project.id,
      revision_no: nextRevisionNo,
      document_json: documentJson,
      content_hash: hashDocument(documentJson),
      source_schema_version: validDocument.formatVersion,
      reason: "autosave",
      byte_size: documentByteSize(documentJson),
      created_by: user.id,
    })
    .select(REVISION_COLUMNS)
    .single();

  if (error) {
    throw new ProjectRepositoryError(
      "Unable to save project revision",
      error.code === "23505" ? "REVISION_CONFLICT" : "DATABASE_ERROR",
    );
  }

  const savedRevision = revision as unknown as RevisionRow;

  return {
    projectId: project.id,
    publicRef: project.public_ref,
    workspaceId: project.workspace_id,
    title: project.title,
    revisionNo: savedRevision.revision_no,
    revisionId: savedRevision.id,
    document: validDocument,
    source: "supabase",
  };
}
