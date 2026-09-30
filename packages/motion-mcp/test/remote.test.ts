import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it, vi } from "vitest";
import { createRemoteMcpServer, type RemoteMcpProjectApi } from "../src/remote";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const WORKSPACE_ID = "22222222-2222-4222-8222-222222222222";
const ASSET_ID = "33333333-3333-4333-8333-333333333333";

/** Every tool the hosted server is expected to expose: HTML projects (Kiến trúc A), assets and exports. */
const EXPECTED_TOOLS = [
  "attach_asset_to_project",
  "cancel_export",
  "complete_asset_upload",
  "create_export",
  "create_project_html",
  "delete_asset",
  "delete_project",
  "get_export",
  "get_export_download_url",
  "get_project",
  "get_project_html",
  "import_asset",
  "list_assets",
  "list_projects",
  "list_workspaces",
  "open_preview",
  "request_asset_upload",
  "update_project",
  "update_project_html",
].sort();

/** Tools that belonged to the JSON V2 track or to the retired HTML-revision model. */
const REMOVED_TOOLS = [
  "apply_json_patch",
  "compile_html",
  "get_capabilities",
  "get_html_revision",
  "get_project_json",
  "list_html_revisions",
  "open_editor",
  "validate_html",
];

function createApi(overrides: Partial<RemoteMcpProjectApi> = {}) {
  const empty = () => Promise.resolve({});
  const api: RemoteMcpProjectApi = {
    listWorkspaces: vi.fn(() => Promise.resolve([])),
    createProjectHtml: vi.fn(empty),
    listProjects: vi.fn(empty),
    getProject: vi.fn(empty),
    updateProject: vi.fn(empty),
    deleteProject: vi.fn(empty),
    getProjectHtml: vi.fn(empty),
    updateProjectHtml: vi.fn(empty),
    listAssets: vi.fn(empty),
    requestAssetUpload: vi.fn(empty),
    completeAssetUpload: vi.fn(empty),
    importAsset: vi.fn(empty),
    attachAssetToProject: vi.fn(empty),
    deleteAsset: vi.fn(empty),
    createExport: vi.fn(empty),
    getExport: vi.fn(empty),
    getExportDownloadUrl: vi.fn(empty),
    cancelExport: vi.fn(empty),
    openPreview: vi.fn(empty),
    ...overrides,
  };
  return api;
}

async function connect(api: RemoteMcpProjectApi) {
  const server = createRemoteMcpServer({ api });
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return {
    client,
    async close() {
      await client.close();
      await server.close();
    },
  };
}

function textOf(result: Awaited<ReturnType<Client["callTool"]>>): string {
  return (result.content as Array<{ text?: string }>)[0]?.text ?? "";
}

describe("hosted remote MCP: tool surface", () => {
  it("exposes exactly the HTML-project, asset and export tools", async () => {
    const { client, close } = await connect(createApi());
    const { tools } = await client.listTools();
    const names = tools.map((tool) => tool.name);

    expect([...names].sort()).toEqual(EXPECTED_TOOLS);
    for (const removed of REMOVED_TOOLS) {
      expect(names, `${removed} must not be exposed`).not.toContain(removed);
    }
    await close();
  });

  it("publishes an outputSchema and complete annotations for every tool", async () => {
    const { client, close } = await connect(createApi());
    const { tools } = await client.listTools();

    for (const tool of tools) {
      expect(tool.outputSchema, `${tool.name} must publish outputSchema`).toBeDefined();
      expect(tool.annotations, `${tool.name} annotations`).toEqual(expect.objectContaining({
        readOnlyHint: expect.any(Boolean),
        openWorldHint: expect.any(Boolean),
        destructiveHint: expect.any(Boolean),
      }));
    }
    await close();
  });

  it("marks read-only, open-world and destructive tools correctly", async () => {
    const { client, close } = await connect(createApi());
    const { tools } = await client.listTools();
    const annotations = (name: string) => tools.find((tool) => tool.name === name)?.annotations;

    for (const name of ["list_workspaces", "list_projects", "get_project", "get_project_html", "open_preview", "get_export", "get_export_download_url", "list_assets"]) {
      expect(annotations(name), name).toMatchObject({ readOnlyHint: true, destructiveHint: false });
    }
    expect(annotations("import_asset")).toMatchObject({ readOnlyHint: false, openWorldHint: true, destructiveHint: false });
    for (const name of ["delete_project", "delete_asset", "cancel_export"]) {
      expect(annotations(name), name).toMatchObject({ destructiveHint: true });
    }
    await close();
  });

  it("does not accept JSON V2 inputs on the remaining tools", async () => {
    const { client, close } = await connect(createApi());
    const { tools } = await client.listTools();
    const properties = (name: string) =>
      Object.keys((tools.find((tool) => tool.name === name)?.inputSchema.properties ?? {}) as Record<string, unknown>);

    expect(properties("update_project")).toEqual(expect.arrayContaining(["title"]));
    expect(properties("update_project")).not.toContain("document");
    expect(properties("update_project")).not.toContain("expected_revision_no");
    expect(properties("create_export")).not.toContain("protocol_revision_no");
    expect(properties("update_project_html")).not.toContain("expected_html_revision_no");
    await close();
  });

  it("registers the workflow resources and HTML prompts", async () => {
    const { client, close } = await connect(createApi());
    const resources = await client.listResources();
    expect(resources.resources.map((resource) => resource.uri)).toEqual(expect.arrayContaining([
      "neonix://docs/workflows",
      "neonix://docs/html-authoring",
    ]));
    const prompts = await client.listPrompts();
    expect(prompts.prompts.map((prompt) => prompt.name)).toEqual(expect.arrayContaining([
      "create_html_project",
      "edit_html_project",
    ]));

    const workflows = await client.readResource({ uri: "neonix://docs/workflows" });
    const text = (workflows.contents[0] as { text?: string }).text ?? "";
    for (const removed of REMOVED_TOOLS) {
      expect(text, `workflow guide still mentions ${removed}`).not.toContain(removed);
    }
    await close();
  });
});

describe("hosted remote MCP: tool routing", () => {
  it("returns list_workspaces results and rejects a missing project locator", async () => {
    const { client, close } = await connect(createApi());

    const workspaces = await client.callTool({ name: "list_workspaces", arguments: {} });
    expect(workspaces.isError).not.toBe(true);
    expect(workspaces.structuredContent).toEqual({ workspaces: [] });

    const invalid = await client.callTool({ name: "get_project", arguments: {} });
    expect(invalid.isError).toBe(true);
    expect(textOf(invalid)).toContain("INVALID_INPUT");
    expect(textOf(invalid)).toContain("Provide exactly one of project_id or public_ref");

    const both = await client.callTool({ name: "get_project", arguments: { project_id: PROJECT_ID, public_ref: "prj_1" } });
    expect(both.isError).toBe(true);
    await close();
  });

  it("maps snake_case tool inputs onto the api adapter", async () => {
    const api = createApi({
      getProject: vi.fn(() => Promise.resolve({ id: PROJECT_ID, title: "Demo" })),
      listProjects: vi.fn(() => Promise.resolve({ workspace: { id: WORKSPACE_ID }, projects: [] })),
      updateProject: vi.fn(() => Promise.resolve({ project: { id: PROJECT_ID, title: "Renamed" } })),
      getProjectHtml: vi.fn(() => Promise.resolve({ project: { id: PROJECT_ID }, html: "<html></html>" })),
      updateProjectHtml: vi.fn(() => Promise.resolve({ project: { id: PROJECT_ID } })),
      attachAssetToProject: vi.fn(() => Promise.resolve({ projectId: PROJECT_ID, assetId: ASSET_ID, attached: true })),
      getExport: vi.fn(() => Promise.resolve({
        export: { jobId: "rnd_1", projectId: PROJECT_ID, status: "queued", createdAt: 1, updatedAt: 2 },
      })),
      getExportDownloadUrl: vi.fn(() => Promise.resolve({
        jobId: "rnd_1",
        url: "https://media.example.com/out.mp4",
        expiresAt: "2026-01-01T00:00:00.000Z",
      })),
      openPreview: vi.fn(() => Promise.resolve({
        project_id: PROJECT_ID,
        public_ref: "prj_1",
        preview_url: "https://www.neonix.video/preview/x",
      })),
    });
    const { client, close } = await connect(api);

    await client.callTool({ name: "get_project", arguments: { public_ref: "prj_1" } });
    expect(api.getProject).toHaveBeenCalledWith({ projectId: undefined, publicRef: "prj_1" });

    await client.callTool({ name: "list_projects", arguments: { workspace_id: WORKSPACE_ID, limit: 5 } });
    expect(api.listProjects).toHaveBeenCalledWith({ workspaceId: WORKSPACE_ID, limit: 5 });

    await client.callTool({ name: "update_project", arguments: { project_id: PROJECT_ID, title: "Renamed" } });
    expect(api.updateProject).toHaveBeenCalledWith({ projectId: PROJECT_ID, publicRef: undefined, title: "Renamed" });

    await client.callTool({ name: "get_project_html", arguments: { project_id: PROJECT_ID } });
    expect(api.getProjectHtml).toHaveBeenCalledWith({ projectId: PROJECT_ID, publicRef: undefined });

    await client.callTool({ name: "update_project_html", arguments: { project_id: PROJECT_ID, html: "<html>x</html>" } });
    expect(api.updateProjectHtml).toHaveBeenCalledWith({ projectId: PROJECT_ID, publicRef: undefined, html: "<html>x</html>" });

    await client.callTool({ name: "attach_asset_to_project", arguments: { project_id: PROJECT_ID, asset_id: ASSET_ID } });
    expect(api.attachAssetToProject).toHaveBeenCalledWith(expect.objectContaining({ projectId: PROJECT_ID, assetId: ASSET_ID }));

    await client.callTool({ name: "get_export", arguments: { job_id: "rnd_1" } });
    expect(api.getExport).toHaveBeenCalledWith({ jobId: "rnd_1" });

    const download = await client.callTool({ name: "get_export_download_url", arguments: { job_id: "rnd_1" } });
    expect(api.getExportDownloadUrl).toHaveBeenCalledWith({ jobId: "rnd_1" });
    expect(download.structuredContent).toMatchObject({ url: "https://media.example.com/out.mp4" });

    const preview = await client.callTool({ name: "open_preview", arguments: { project_id: PROJECT_ID } });
    expect(preview.structuredContent).toMatchObject({ preview_url: expect.stringContaining("/preview/") });
    await close();
  });

  it("passes export requests without any JSON revision", async () => {
    const api = createApi({
      createExport: vi.fn(() => Promise.resolve({
        export: { jobId: "rnd_1", projectId: PROJECT_ID, status: "queued", createdAt: 1, updatedAt: 1 },
        created: true,
      })),
    });
    const { client, close } = await connect(api);

    const response = await client.callTool({
      name: "create_export",
      arguments: { project_id: PROJECT_ID, preset: "web", idempotency_key: "key-1" },
    });

    expect(response.isError).not.toBe(true);
    expect(api.createExport).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
      publicRef: undefined,
      preset: "web",
      idempotencyKey: "key-1",
    });
    await close();
  });

  it("surfaces adapter errors as structured tool errors", async () => {
    const notImplemented = Object.assign(new Error("import_asset is not ported to apps/api yet"), { code: "NOT_IMPLEMENTED" });
    const { client, close } = await connect(createApi({ importAsset: () => Promise.reject(notImplemented) }));

    const response = await client.callTool({
      name: "import_asset",
      arguments: { source_url: "https://example.com/logo.png" },
    });

    expect(response.isError).toBe(true);
    expect(JSON.parse(textOf(response))).toMatchObject({ error: { code: "NOT_IMPLEMENTED", retryable: false } });
    await close();
  });
});

describe("create_project_html", () => {
  const created = {
    project: { id: PROJECT_ID, sourceFormat: "html" },
    workspace: { id: WORKSPACE_ID },
    diagnostics: [],
    alreadyCreated: false,
  };

  it("scaffolds the blank neonix-document template when html is omitted or empty", async () => {
    const api = createApi({ createProjectHtml: vi.fn(() => Promise.resolve(created)) });
    const { client, close } = await connect(api);

    await client.callTool({ name: "create_project_html", arguments: {} });
    await client.callTool({ name: "create_project_html", arguments: { html: "   " } });

    const calls = vi.mocked(api.createProjectHtml).mock.calls;
    expect(calls).toHaveLength(2);
    for (const [input] of calls) {
      expect(input.html).toContain('name="neonix-document"');
      expect(input.html).not.toContain("<script");
    }
    await close();
  });

  it("forwards caller HTML, title, workspace and idempotency key untouched", async () => {
    const api = createApi({ createProjectHtml: vi.fn(() => Promise.resolve(created)) });
    const { client, close } = await connect(api);

    const response = await client.callTool({
      name: "create_project_html",
      arguments: { html: "<html>mine</html>", title: "My video", workspace_id: WORKSPACE_ID, idempotency_key: "abc" },
    });

    expect(response.isError).not.toBe(true);
    expect(response.structuredContent).toMatchObject({ alreadyCreated: false });
    expect(api.createProjectHtml).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      title: "My video",
      html: "<html>mine</html>",
      idempotencyKey: "abc",
    });
    await close();
  });
});
