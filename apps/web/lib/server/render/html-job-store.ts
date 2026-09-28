import "server-only";

import { createSupabaseAdminClient } from "@/lib/server/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Kiến trúc B (HTML Frame Render) export job tracking — see ARCHITECHTURE.md
 * "Hai kiến trúc render độc lập". Deliberately its own table/store, not
 * render_jobs: render_jobs.revision_id hard-FKs to project_revisions, which
 * a raw HTML project never has.
 */
export type HtmlRenderJobStatus = "queued" | "rendering" | "done" | "failed" | "cancelled";

export type HtmlRenderJob = {
  id: string;
  publicRef: string;
  workspaceId: string;
  projectId: string;
  htmlRevisionNo: number;
  status: HtmlRenderJobStatus;
  outputKey: string | null;
  errorMessage: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
};

const COLUMNS =
  "id, public_ref, workspace_id, project_id, html_revision_no, status, output_key, error_message, created_by, created_at, updated_at, finished_at";

type Row = {
  id: string;
  public_ref: string;
  workspace_id: string;
  project_id: string;
  html_revision_no: number;
  status: HtmlRenderJobStatus;
  output_key: string | null;
  error_message: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
};

function fromRow(row: Row): HtmlRenderJob {
  return {
    id: row.id,
    publicRef: row.public_ref,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    htmlRevisionNo: row.html_revision_no,
    status: row.status,
    outputKey: row.output_key,
    errorMessage: row.error_message,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    finishedAt: row.finished_at,
  };
}

/** The `hrj_` prefix distinguishes this job's public_ref from render_jobs' `rnd_` — callers dispatch to the right table/store by prefix. */
export function isHtmlRenderJobRef(jobId: string): boolean {
  return jobId.startsWith("hrj_");
}

export async function createHtmlRenderJob(
  client: SupabaseClient,
  input: { workspaceId: string; projectId: string; htmlRevisionNo: number; createdBy: string },
): Promise<HtmlRenderJob> {
  const result = await client
    .from("html_render_jobs")
    .insert({
      workspace_id: input.workspaceId,
      project_id: input.projectId,
      html_revision_no: input.htmlRevisionNo,
      created_by: input.createdBy,
      status: "queued",
    })
    .select(COLUMNS)
    .single();
  if (result.error || !result.data) {
    throw new Error(`Unable to create HTML render job: ${result.error?.message ?? "unknown error"}`);
  }
  return fromRow(result.data);
}

/**
 * Reads with the given client, so an MCP-facing caller passes the calling
 * principal's own client and gets RLS's html_render_jobs_select_member
 * policy for free (only workspace members can see the job) — no separate
 * access check needed, unlike render_jobs' assertJobAccess.
 */
export async function getHtmlRenderJob(client: SupabaseClient, jobId: string): Promise<HtmlRenderJob | null> {
  const result = await client.from("html_render_jobs").select(COLUMNS).eq("public_ref", jobId).maybeSingle();
  if (result.error || !result.data) return null;
  return fromRow(result.data);
}

export async function updateHtmlRenderJob(
  jobId: string,
  patch: Partial<Pick<HtmlRenderJob, "status" | "outputKey" | "errorMessage">> & { finished?: boolean },
): Promise<void> {
  const client = createSupabaseAdminClient();
  const update: Record<string, unknown> = {};
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.outputKey !== undefined) update.output_key = patch.outputKey;
  if (patch.errorMessage !== undefined) update.error_message = patch.errorMessage;
  if (patch.finished) update.finished_at = new Date().toISOString();
  const result = await client.from("html_render_jobs").update(update).eq("public_ref", jobId);
  if (result.error) throw new Error(`Unable to update HTML render job: ${result.error.message}`);
}

/** Workspace-scoped output key, matching render_jobs' own R2 layout convention. */
export function buildHtmlRenderOutputKey(workspaceId: string, jobId: string): string {
  return `${workspaceId}/${jobId}.mp4`;
}
