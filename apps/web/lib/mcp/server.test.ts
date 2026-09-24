import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@motionvideo/motion-mcp/remote", () => ({
  createRemoteMcpServer: vi.fn((config: unknown) => config),
}));

vi.mock("./projects", () => ({
  listWorkspaces: vi.fn(() => ({ workspaces: [] })),
  listProjects: vi.fn(() => ({ projects: [] })),
  getProtocolProject: vi.fn(() => ({ project: {} })),
  updateProtocolProject: vi.fn(() => ({ project: {} })),
  deleteProtocolProject: vi.fn(() => ({ deleted: true })),
  openEditor: vi.fn(() => ({ url: "https://example.com/editor" })),
  openPreview: vi.fn(() => ({ url: "https://example.com/preview" })),
  createProtocolProject: vi.fn(() => ({ project: {} })),
  createProjectHtml: vi.fn(() => ({ project: {} })),
  getProtocolProjectJson: vi.fn(() => ({ json: {} })),
  applyProjectJsonPatch: vi.fn(() => ({ project: {} })),
  getProjectHtmlSource: vi.fn(() => ({ html: "" })),
  updateProjectHtmlSource: vi.fn(() => ({ html: "" })),
  listProjectHtmlRevisions: vi.fn(() => ({ revisions: [] })),
  getProjectHtmlRevision: vi.fn(() => ({ revision: {} })),
}));

vi.mock("./assets", () => ({
  listAssets: vi.fn(() => ({ assets: [] })),
  requestAssetUpload: vi.fn(() => ({ uploadUrl: "" })),
  completeAssetUpload: vi.fn(() => ({ asset: {} })),
  importAsset: vi.fn(() => ({ asset: {} })),
  attachAssetToProject: vi.fn(() => ({ ok: true })),
  deleteAsset: vi.fn(() => ({ deleted: true })),
}));

vi.mock("./exports", () => ({
  createExport: vi.fn(() => ({ export: {} })),
  getExport: vi.fn(() => ({ export: {} })),
  getExportDownloadUrl: vi.fn(() => ({ url: "" })),
  cancelExport: vi.fn(() => ({ cancelled: true })),
}));

vi.mock("@/lib/server/html-project-repository", () => ({
  compileHtmlDocument: vi.fn(() => ({
    status: "success",
    source: { composition: {} },
    protocol: { layers: [] },
    diagnostics: [],
  })),
}));

import type { RemoteMcpProjectApi } from "@motionvideo/motion-mcp/remote";
import { createRemoteMcpServer } from "@motionvideo/motion-mcp/remote";
import type { McpPrincipal } from "./auth";
import * as assets from "./assets";
import * as exportsApi from "./exports";
import * as projects from "./projects";
import { createMcpServer } from "./server";

describe("createMcpServer", () => {
  // The exact production bug: an authenticated caller whose token carries no
  // projects:*/assets:*/exports:* scope, because Supabase Auth (the OAuth
  // authorization server) never issues those. Every guarded call used to
  // throw FORBIDDEN in this situation with no way for a legitimate caller to
  // fix it. Tool calls must succeed regardless of `scopes`.
  const principal: McpPrincipal = {
    userId: "user-1",
    clientId: "claude-desktop",
    scopes: [],
    token: "token",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function buildApi(): RemoteMcpProjectApi {
    const server = createMcpServer(principal) as unknown as { api: RemoteMcpProjectApi };
    return server.api;
  }

  it("passes the principal straight through to createRemoteMcpServer", () => {
    buildApi();
    expect(createRemoteMcpServer).toHaveBeenCalledWith(
      expect.objectContaining({ principal }),
    );
  });

  it("calls project operations directly without requiring any operation scope", async () => {
    const api = buildApi();

    await api.listWorkspaces();
    expect(projects.listWorkspaces).toHaveBeenCalledWith(principal);

    await api.createProject({ title: "t" });
    expect(projects.createProtocolProject).toHaveBeenCalledWith(principal, { title: "t" });

    await api.getProject({ projectId: "p1" });
    expect(projects.getProtocolProject).toHaveBeenCalledWith(principal, { projectId: "p1" });

    await api.deleteProject({ projectId: "p1" });
    expect(projects.deleteProtocolProject).toHaveBeenCalledWith(principal, { projectId: "p1" });
  });

  it("calls asset operations directly without requiring any operation scope", async () => {
    const api = buildApi();

    await api.listAssets({ workspaceId: "w1" });
    expect(assets.listAssets).toHaveBeenCalledWith(principal, { workspaceId: "w1" });

    await api.deleteAsset({ assetId: "a1" });
    expect(assets.deleteAsset).toHaveBeenCalledWith(principal, { assetId: "a1" });
  });

  it("calls export operations directly without requiring any operation scope", async () => {
    const api = buildApi();

    await api.createExport({ projectId: "p1" });
    expect(exportsApi.createExport).toHaveBeenCalledWith(principal, { projectId: "p1" });

    await api.cancelExport({ jobId: "e1" });
    expect(exportsApi.cancelExport).toHaveBeenCalledWith(principal, { jobId: "e1" });
  });

  it("serves document capabilities without gating on scopes", async () => {
    const api = buildApi();
    const capabilities = await api.documentApi!.getCapabilities();
    expect(capabilities).toMatchObject({ protocolVersion: 2 });
  });
});
