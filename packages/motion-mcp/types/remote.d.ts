// Hand-maintained declaration for the "./remote" subpath's CJS build (see
// scripts/build-remote-cjs.mjs for why this isn't tsc-generated). Copied
// verbatim into dist/remote.d.ts by that script - edit this file, not the
// copy. Must stay in sync with the real exported surface of src/remote.ts;
// keep it narrow (only what apps/api actually consumes) rather than trying
// to mirror every internal type.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export type RemoteMcpPrincipal = {
  userId: string;
  clientId: string;
  scopes: string[];
  token: string;
  expiresAt?: number;
};

export type RemoteMcpProjectApi = {
  listWorkspaces: () => Promise<unknown>;
  createProjectHtml: (input: {
    workspaceId?: string;
    title?: string;
    html?: string;
    idempotencyKey?: string;
    ensureBrowserPreviewStyle?: boolean;
  }) => Promise<unknown>;
  listProjects: (input: { workspaceId?: string; limit?: number }) => Promise<unknown>;
  getProject: (input: { projectId?: string; publicRef?: string }) => Promise<unknown>;
  updateProject: (input: {
    projectId?: string;
    publicRef?: string;
    title?: string;
    document?: Record<string, unknown>;
    expectedRevisionNo?: number;
  }) => Promise<unknown>;
  deleteProject: (input: { projectId?: string; publicRef?: string }) => Promise<unknown>;
  getProjectJson: (input: { projectId?: string; publicRef?: string }) => Promise<unknown>;
  applyJsonPatch: (input: {
    projectId?: string;
    publicRef?: string;
    expectedProtocolRevisionNo: number;
    patch: Record<string, unknown>;
  }) => Promise<unknown>;
  getProjectHtml: (input: { projectId?: string; publicRef?: string }) => Promise<unknown>;
  updateProjectHtml: (input: {
    projectId?: string;
    publicRef?: string;
    html: string;
    expectedHtmlRevisionNo?: number;
    expectedProtocolRevisionNo?: number;
    ensureBrowserPreviewStyle?: boolean;
  }) => Promise<unknown>;
  listHtmlRevisions: (input: { projectId?: string; publicRef?: string }) => Promise<unknown>;
  getHtmlRevision: (input: { projectId?: string; publicRef?: string; revisionNo: number }) => Promise<unknown>;
  listAssets: (input: { workspaceId?: string; projectId?: string; publicRef?: string }) => Promise<unknown>;
  requestAssetUpload: (input: {
    workspaceId?: string;
    filename: string;
    mimeType: string;
    byteSize: number;
  }) => Promise<unknown>;
  completeAssetUpload: (input: { assetId: string }) => Promise<unknown>;
  importAsset: (input: { workspaceId?: string; sourceUrl: string; filename?: string }) => Promise<unknown>;
  attachAssetToProject: (input: { projectId?: string; publicRef?: string; assetId: string }) => Promise<unknown>;
  deleteAsset: (input: { workspaceId?: string; assetId: string; replaceReferences?: boolean }) => Promise<unknown>;
  createExport: (input: {
    projectId?: string;
    publicRef?: string;
    protocolRevisionNo?: number;
    preset?: string;
    idempotencyKey?: string;
  }) => Promise<unknown>;
  getExport: (input: { jobId: string }) => Promise<unknown>;
  getExportDownloadUrl: (input: { jobId: string }) => Promise<unknown>;
  cancelExport: (input: { jobId: string }) => Promise<unknown>;
  openEditor: (input: { projectId?: string; publicRef?: string }) => Promise<unknown>;
  openPreview: (input: { projectId?: string; publicRef?: string }) => Promise<unknown>;
  documentApi?: {
    getCapabilities: () => Promise<unknown>;
    validateDocument: (input: { html: string }) => Promise<unknown>;
    compileDocument: (input: { html: string }) => Promise<unknown>;
  };
};

export function createRemoteMcpServer(options: {
  api: RemoteMcpProjectApi;
  principal?: RemoteMcpPrincipal;
}): McpServer;
