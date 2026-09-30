import { describe, expect, it, vi } from "vitest";
import { buildMcpProjectApi, type McpApiDeps } from "./mcp-api";

const USER_ID = "user-1";
const WORKSPACE_ID = "ws-1";
const now = new Date("2026-01-01T00:00:00.000Z");

function project(id: string, sourceFormat: "html" | "protocol-v2") {
  return { id, publicRef: `prj_${id}`, workspaceId: WORKSPACE_ID, title: `Project ${id}`, sourceFormat, currentRevisionNo: sourceFormat === "html" ? 0 : 3 };
}

function createDeps() {
  const htmlProject = project("html-1", "html");
  const jsonProject = project("json-1", "protocol-v2");
  const byId = new Map([htmlProject, jsonProject].map((item) => [item.id, item]));

  const workspaces = {
    listForUser: vi.fn(() => Promise.resolve([{ id: WORKSPACE_ID, name: "Main", role: "owner", createdAt: now }])),
    getForMember: vi.fn(() => Promise.resolve({ id: WORKSPACE_ID, name: "Main", createdAt: now })),
  };
  const projects = {
    list: vi.fn(() => Promise.resolve([htmlProject, jsonProject])),
    getForMember: vi.fn((_user: string, id: string) => Promise.resolve(byId.get(id)!)),
    update: vi.fn((_user: string, id: string, title: string) => Promise.resolve({ ...byId.get(id)!, title })),
    softDelete: vi.fn(() => Promise.resolve(undefined)),
    createHtmlProject: vi.fn((_user: string, input: { html: string }) =>
      Promise.resolve({ project: htmlProject, alreadyCreated: input.html === "dup" })),
    getHtmlDocument: vi.fn(() => Promise.resolve({ project: htmlProject, html: "<html>doc</html>", updatedAt: now })),
    updateHtmlDocument: vi.fn(() => Promise.resolve({ project: htmlProject, html: "<html>new</html>", updatedAt: now })),
    attachAsset: vi.fn(() => Promise.resolve(undefined)),
  };
  const renderJobs = {
    getDownloadUrl: vi.fn(() => Promise.resolve({ url: "https://media.example.com/out.mp4", expiresAt: now, ttlSeconds: 60 })),
    create: vi.fn(),
  };
  // resolveProjectId only touches the database for public_ref lookups, which these tests avoid.
  const db = { query: { projects: { findFirst: vi.fn(() => Promise.resolve(undefined)) }, renderJobs: { findFirst: vi.fn(() => Promise.resolve({ id: "job-uuid" })) } } };

  const deps = {
    db,
    workspaces,
    projects,
    assets: {},
    renderJobs,
    webAppUrl: "https://www.neonix.video",
  } as unknown as McpApiDeps;
  return { deps, workspaces, projects, renderJobs, api: buildMcpProjectApi(deps, USER_ID) };
}

describe("MCP project adapter: HTML projects only", () => {
  it("lists only HTML projects and never exposes revision numbers", async () => {
    const { api } = createDeps();
    const result = (await api.listProjects({ workspaceId: WORKSPACE_ID })) as { projects: Array<Record<string, unknown>> };

    expect(result.projects.map((item) => item.id)).toEqual(["html-1"]);
    expect(result.projects[0]).not.toHaveProperty("current_revision_no");
  });

  it("uses the first accessible workspace when none is given", async () => {
    const { api, projects } = createDeps();
    await api.listProjects({});
    expect(projects.list).toHaveBeenCalledWith(USER_ID, WORKSPACE_ID);
  });

  it("rejects JSON V2 projects on every project-scoped tool", async () => {
    const { api } = createDeps();
    const json = { projectId: "json-1" };
    const calls: Array<[string, () => Promise<unknown>]> = [
      ["get_project", () => api.getProject(json)],
      ["update_project", () => api.updateProject({ ...json, title: "x" })],
      ["delete_project", () => api.deleteProject(json)],
      ["open_preview", () => api.openPreview(json)],
      ["get_project_html", () => api.getProjectHtml(json)],
      ["update_project_html", () => api.updateProjectHtml({ ...json, html: "<html></html>" })],
      ["attach_asset_to_project", () => api.attachAssetToProject({ ...json, assetId: "asset-1" })],
      ["create_export", () => api.createExport(json)],
    ];

    for (const [name, call] of calls) {
      await expect(call(), name).rejects.toMatchObject({ code: "not_html_track", message: "Project is not an HTML project" });
    }
  });

  it("returns the HTML preview URL for an HTML project", async () => {
    const { api } = createDeps();
    await expect(api.openPreview({ projectId: "html-1" })).resolves.toMatchObject({
      project_id: "html-1",
      preview_url: "https://www.neonix.video/preview/html-1",
    });
  });
});

describe("MCP project adapter: HTML authoring", () => {
  it("creates an HTML project in the first workspace and reports idempotent replays", async () => {
    const { api, projects } = createDeps();

    const first = await api.createProjectHtml({ title: "Demo", html: "<html></html>", idempotencyKey: "k" });
    expect(projects.createHtmlProject).toHaveBeenCalledWith(USER_ID, {
      workspaceId: WORKSPACE_ID,
      title: "Demo",
      html: "<html></html>",
      idempotencyKey: "k",
    });
    expect(first).toMatchObject({ project: { id: "html-1" }, workspace: { id: WORKSPACE_ID }, alreadyCreated: false });

    const replay = await api.createProjectHtml({ html: "dup" });
    expect(replay).toMatchObject({ alreadyCreated: true });
  });

  it("reads and overwrites the single HTML document", async () => {
    const { api, projects } = createDeps();

    await expect(api.getProjectHtml({ projectId: "html-1" })).resolves.toMatchObject({ html: "<html>doc</html>" });
    await expect(api.updateProjectHtml({ projectId: "html-1", html: "<html>new</html>" })).resolves.toMatchObject({
      project: { id: "html-1" },
    });
    expect(projects.updateHtmlDocument).toHaveBeenCalledWith(USER_ID, "html-1", "<html>new</html>");
  });

  it("attaches an asset to an HTML project", async () => {
    const { api, projects } = createDeps();
    await expect(api.attachAssetToProject({ projectId: "html-1", assetId: "asset-1" })).resolves.toEqual({
      projectId: "html-1",
      assetId: "asset-1",
      attached: true,
    });
    expect(projects.attachAsset).toHaveBeenCalledWith(USER_ID, "html-1", "asset-1");
  });
});

describe("MCP project adapter: exports", () => {
  it("returns a short-lived signed download URL", async () => {
    const { api, renderJobs } = createDeps();
    await expect(api.getExportDownloadUrl({ jobId: "rnd_1" })).resolves.toEqual({
      jobId: "rnd_1",
      url: "https://media.example.com/out.mp4",
      expiresAt: now.toISOString(),
    });
    expect(renderJobs.getDownloadUrl).toHaveBeenCalledWith(USER_ID, "job-uuid");
  });

  it("reports create_export as not implemented until the HTML render pipeline exists", async () => {
    const { api, renderJobs } = createDeps();
    await expect(api.createExport({ projectId: "html-1" })).rejects.toMatchObject({ code: "NOT_IMPLEMENTED" });
    expect(renderJobs.create).not.toHaveBeenCalled();
  });

  it("reports import_asset as not implemented", async () => {
    const { api } = createDeps();
    await expect(api.importAsset({ sourceUrl: "https://example.com/a.png" })).rejects.toMatchObject({ code: "NOT_IMPLEMENTED" });
  });
});
