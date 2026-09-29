import type { RemoteMcpProjectApi } from "@motionvideo/motion-mcp/remote";
import { eq } from "drizzle-orm";
import { AssetsService } from "../assets/assets.service";
import { ApiError } from "../common/api-error";
import type { Database } from "../db/client";
import { projectRevisions, projects } from "../db/schema/projects";
import { renderJobs } from "../db/schema/render";
import { ProjectsService } from "../projects/projects.service";
import { RenderJobsService } from "../render-jobs/render-jobs.service";
import { WorkspacesService } from "../workspaces/workspaces.service";

export interface McpApiDeps {
  db: Database;
  workspaces: WorkspacesService;
  projects: ProjectsService;
  assets: AssetsService;
  renderJobs: RenderJobsService;
  webAppUrl: string;
}

function notImplemented(tool: string): never {
  const error = new Error(`${tool} is not ported to apps/api yet`) as Error & { code: string };
  error.code = "NOT_IMPLEMENTED";
  throw error;
}

// Resolves the id/publicRef ambiguity every project-scoped tool input allows
// (an MCP caller may know either). Existing NestJS services only accept the
// internal uuid, so this is the one lookup shared across every method below
// rather than duplicated per-tool.
async function resolveProjectId(db: Database, input: { projectId?: string; publicRef?: string }): Promise<string> {
  if (input.projectId) return input.projectId;
  if (input.publicRef) {
    const row = await db.query.projects.findFirst({ where: eq(projects.publicRef, input.publicRef) });
    if (!row) throw new ApiError(404, "Project not found");
    return row.id;
  }
  throw new ApiError(400, "projectId or publicRef is required");
}

async function resolveRenderJobId(db: Database, jobId: string): Promise<string> {
  const row = await db.query.renderJobs.findFirst({ where: eq(renderJobs.publicRef, jobId) });
  if (!row) throw new ApiError(404, "Render job not found");
  return row.id;
}

/**
 * First slice of the RemoteMcpProjectApi port (see project memory: MCP
 * porting is staged, same as the REST API was). Implements every tool that
 * maps directly onto an existing apps/api NestJS service with no new
 * business logic. Tools needing net-new logic (HTML track, JSON patch
 * engine, asset-project linking, asset import-by-url, export download URLs,
 * document API) throw a clear NOT_IMPLEMENTED tool error instead of
 * crashing or silently no-op'ing - motion-mcp's `toolError()` turns that
 * into a proper MCP tool error response, not a transport-level failure.
 */
export function buildMcpProjectApi(deps: McpApiDeps, userId: string): RemoteMcpProjectApi {
  const { db, workspaces, projects: projectsService, assets: assetsService, renderJobs: renderJobsService, webAppUrl } = deps;

  return {
    async listWorkspaces() {
      const rows = await workspaces.listForUser(userId);
      return rows.map((w) => ({ id: w.id, name: w.name, role: w.role, created_at: w.createdAt.toISOString() }));
    },

    async listProjects(input) {
      if (!input.workspaceId) throw new ApiError(400, "workspaceId is required");
      const workspace = await workspaces.getForMember(userId, input.workspaceId);
      const rows = await projectsService.list(userId, input.workspaceId);
      const limited = input.limit ? rows.slice(0, input.limit) : rows;
      return {
        workspace: { id: workspace.id, name: workspace.name, created_at: workspace.createdAt.toISOString() },
        projects: limited.map(projectToJson),
      };
    },

    async getProject(input) {
      const projectId = await resolveProjectId(db, input);
      const project = await projectsService.getForMember(userId, projectId);
      return projectToJson(project);
    },

    async updateProject(input) {
      const projectId = await resolveProjectId(db, input);
      let project = input.title !== undefined ? await projectsService.update(userId, projectId, input.title) : await projectsService.getForMember(userId, projectId);
      let revision: Awaited<ReturnType<ProjectsService["createRevision"]>> | null = null;
      if (input.document) {
        revision = await projectsService.createRevision(userId, projectId, input.document, "mcp:update_project");
        project = await projectsService.getForMember(userId, projectId);
      }
      return { project: projectToJson(project), revision: revision ? revisionToJson(revision) : null };
    },

    async deleteProject(input) {
      const projectId = await resolveProjectId(db, input);
      await projectsService.softDelete(userId, projectId);
      return { projectId, deleted: true };
    },

    async getProjectJson(input) {
      const projectId = await resolveProjectId(db, input);
      const project = await projectsService.getForMember(userId, projectId);
      const revision = project.currentRevisionNo > 0
        ? await projectsService.getRevision(userId, projectId, project.currentRevisionNo)
        : null;
      return { projectId, publicRef: project.publicRef, revision: revision ? revisionToJson(revision) : null };
    },

    async listAssets(input) {
      if (!input.workspaceId) throw new ApiError(400, "workspaceId is required");
      const rows = await assetsService.list(userId, input.workspaceId);
      return { workspaceId: input.workspaceId, assets: rows.map(assetToJson) };
    },

    async requestAssetUpload(input) {
      if (!input.workspaceId) throw new ApiError(400, "workspaceId is required");
      const kind = input.mimeType.startsWith("image/") ? "image" : input.mimeType.startsWith("font/") ? "font" : "asset";
      const { asset, uploadUrl, headers, expiresAt } = await assetsService.createUploadRequest(userId, {
        workspaceId: input.workspaceId,
        mimeType: input.mimeType,
        byteSize: input.byteSize,
        kind,
        originalFilename: input.filename,
      });
      return { asset: assetToJson(asset), uploadUrl, method: "PUT", headers, expiresAt: expiresAt.toISOString() };
    },

    async completeAssetUpload(input) {
      const asset = await assetsService.completeUpload(userId, input.assetId);
      return { asset: assetToJson(asset), alreadyCompleted: false };
    },

    async deleteAsset(input) {
      const asset = await assetsService.softDelete(userId, input.assetId);
      return { assetId: asset.id, deleted: true, deletion: assetToJson(asset) };
    },

    async createExport(input) {
      const projectId = await resolveProjectId(db, input);
      const revision = input.protocolRevisionNo
        ? await projectsService.getRevision(userId, projectId, input.protocolRevisionNo)
        : undefined;
      const { renderJob, idempotent } = await renderJobsService.create(userId, {
        projectId,
        revisionId: revision?.id,
        idempotencyKey: input.idempotencyKey,
      });
      return { export: await renderJobToExportJson(db, renderJob!), created: !idempotent };
    },

    async getExport(input) {
      const id = await resolveRenderJobId(db, input.jobId);
      const job = await renderJobsService.getForMember(userId, id);
      return { export: await renderJobToExportJson(db, job) };
    },

    async getExportDownloadUrl() {
      notImplemented("get_export_download_url");
    },

    async cancelExport(input) {
      const id = await resolveRenderJobId(db, input.jobId);
      const job = await renderJobsService.cancel(userId, id);
      return { export: await renderJobToExportJson(db, job) };
    },

    async openEditor(input) {
      const projectId = await resolveProjectId(db, input);
      const project = await projectsService.getForMember(userId, projectId);
      return { project_id: project.id, public_ref: project.publicRef, editor_url: `${webAppUrl}/dashboard/editor/${projectId}` };
    },

    async openPreview(input) {
      const projectId = await resolveProjectId(db, input);
      const project = await projectsService.getForMember(userId, projectId);
      return { project_id: project.id, public_ref: project.publicRef, preview_url: `${webAppUrl}/dashboard/editor/${projectId}?panel=preview` };
    },

    async createProjectHtml() {
      notImplemented("create_project_html");
    },
    async getProjectHtml() {
      notImplemented("get_project_html");
    },
    async updateProjectHtml() {
      notImplemented("update_project_html");
    },
    async listHtmlRevisions() {
      notImplemented("list_html_revisions");
    },
    async getHtmlRevision() {
      notImplemented("get_html_revision");
    },
    async applyJsonPatch() {
      notImplemented("apply_json_patch");
    },
    async importAsset() {
      notImplemented("import_asset");
    },
    async attachAssetToProject() {
      notImplemented("attach_asset_to_project");
    },
  };
}

function projectToJson(project: { id: string; publicRef: string; workspaceId: string; title: string; currentRevisionNo: number }) {
  return {
    id: project.id,
    public_ref: project.publicRef,
    workspace_id: project.workspaceId,
    title: project.title,
    current_revision_no: project.currentRevisionNo,
  };
}

function revisionToJson(revision: { id: string; revisionNo: number; documentJson: unknown; contentHash: string; createdAt: Date }) {
  return {
    id: revision.id,
    revision_no: revision.revisionNo,
    document: revision.documentJson as Record<string, unknown>,
    content_hash: revision.contentHash,
    created_at: revision.createdAt.toISOString(),
  };
}

function assetToJson(asset: { id: string; originalFilename: string | null; mimeType: string; kind: string; byteSize: number; status: string; createdAt: Date }) {
  return {
    assetId: asset.id,
    filename: asset.originalFilename,
    mimeType: asset.mimeType,
    kind: asset.kind,
    byteSize: asset.byteSize,
    status: asset.status,
    createdAt: asset.createdAt.toISOString(),
  };
}

async function renderJobToExportJson(
  db: Database,
  job: { publicRef: string; projectId: string; revisionId: string; status: string; progress: number; createdAt: Date; updatedAt: Date },
) {
  const revision = await db.query.projectRevisions.findFirst({ where: eq(projectRevisions.id, job.revisionId) });
  return {
    jobId: job.publicRef,
    projectId: job.projectId,
    protocolRevisionNo: revision?.revisionNo ?? 0,
    status: job.status,
    progress: job.progress,
    createdAt: job.createdAt.getTime(),
    updatedAt: job.updatedAt.getTime(),
  };
}
