import { z } from "zod";

const jsonObject = z.record(z.string(), z.unknown());

const workspace = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  role: z.string().optional(),
  created_at: z.string().optional(),
}).passthrough();

const project = z.object({
  id: z.string().optional(),
  public_ref: z.string().optional(),
  publicRef: z.string().optional(),
  workspace_id: z.string().optional(),
  workspaceId: z.string().optional(),
  title: z.string().optional(),
}).passthrough();

const diagnostic = z.object({
  path: z.string().optional(),
  message: z.string(),
  severity: z.string(),
}).passthrough();

const htmlOverwriteWarning = z.object({
  code: z.string(),
  message: z.string(),
}).passthrough();

const asset = z.object({
  assetId: z.string(),
  referenceId: z.string().optional(),
  filename: z.unknown().optional(),
  mimeType: z.unknown().optional(),
  kind: z.unknown().optional(),
  byteSize: z.unknown().optional(),
  status: z.unknown().optional(),
  createdAt: z.unknown().optional(),
}).passthrough();

const exportJob = z.object({
  jobId: z.string(),
  projectId: z.string(),
  status: z.string(),
  progress: z.unknown().optional(),
  stage: z.unknown().optional(),
  error: z.unknown().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
}).passthrough();

/** Output schemas are raw shapes because McpServer accepts Zod raw shapes. */
export const REMOTE_TOOL_OUTPUT_SCHEMAS = {
  list_workspaces: {
    workspaces: z.array(workspace),
  },
  get_project_html: {
    project: jsonObject,
    html: z.string(),
  },
  update_project_html: {
    project: jsonObject,
    diagnostics: z.array(diagnostic).optional(),
    alreadyCreated: z.boolean().optional(),
    warning: htmlOverwriteWarning.nullable().optional(),
  },
  list_assets: {
    workspaceId: z.string(),
    assets: z.array(asset),
  },
  request_asset_upload: {
    asset,
    uploadUrl: z.string().url(),
    method: z.string(),
    headers: jsonObject,
    expiresAt: z.string(),
  },
  complete_asset_upload: {
    asset,
    alreadyCompleted: z.boolean(),
  },
  import_asset: {
    asset,
  },
  attach_asset_to_project: {
    projectId: z.string(),
    assetId: z.string(),
    attached: z.boolean(),
  },
  delete_asset: {
    assetId: z.string(),
    deleted: z.boolean(),
    deletion: z.unknown(),
  },
  create_export: {
    export: exportJob,
    created: z.boolean(),
  },
  get_export: {
    export: exportJob,
  },
  get_export_download_url: {
    jobId: z.string(),
    url: z.string().url(),
    expiresAt: z.string(),
  },
  cancel_export: {
    export: exportJob,
  },
  create_project_html: {
    project: jsonObject,
    workspace: jsonObject,
    diagnostics: z.array(diagnostic).optional(),
    alreadyCreated: z.boolean().optional(),
  },
  list_projects: {
    workspace: workspace,
    projects: z.array(project),
  },
  get_project: project,
  update_project: {
    project: project,
  },
  delete_project: {
    projectId: z.string(),
    deleted: z.boolean(),
  },
  open_preview: {
    project_id: z.string(),
    public_ref: z.string(),
    preview_url: z.string().url(),
  },
} as const;
