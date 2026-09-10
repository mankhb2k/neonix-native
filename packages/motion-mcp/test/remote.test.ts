import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { createRemoteMcpServer, type RemoteMcpProjectApi } from "../src/remote";

const empty = () => Promise.resolve({});

const api: RemoteMcpProjectApi = {
  listWorkspaces: () => Promise.resolve([]),
  createProject: empty,
  listProjects: empty,
  getProject: empty,
  updateProject: empty,
  deleteProject: empty,
  getProjectJson: empty,
  applyJsonPatch: empty,
  getProjectHtml: empty,
  updateProjectHtml: empty,
  listHtmlRevisions: empty,
  getHtmlRevision: empty,
  listAssets: empty,
  requestAssetUpload: empty,
  completeAssetUpload: empty,
  importAsset: empty,
  attachAssetToProject: empty,
  deleteAsset: empty,
  createExport: empty,
  getExport: empty,
  getExportDownloadUrl: empty,
  cancelExport: empty,
  openEditor: empty,
  documentApi: {
    getCapabilities: empty,
    validateDocument: empty,
    compileDocument: empty,
  },
};

describe("hosted remote MCP contract", () => {
  it("registers authoring, asset and export tools", async () => {
    const server = createRemoteMcpServer({ api });
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const response = await client.listTools();
    const names = new Set(response.tools.map((tool) => tool.name));

    expect([...names]).toEqual(expect.arrayContaining([
      "create_project",
      "get_project_html",
      "update_project_html",
      "apply_json_patch",
      "request_asset_upload",
      "complete_asset_upload",
      "import_asset",
      "attach_asset_to_project",
      "create_export",
      "get_export_download_url",
      "cancel_export",
      "validate_html",
      "compile_html",
    ]));

    for (const tool of response.tools) {
      expect(tool.outputSchema, `${tool.name} must publish outputSchema`).toBeDefined();
      expect(tool.annotations).toEqual(expect.objectContaining({
        readOnlyHint: expect.any(Boolean),
        openWorldHint: expect.any(Boolean),
        destructiveHint: expect.any(Boolean),
      }));
    }

    expect(response.tools.find((tool) => tool.name === "import_asset")?.annotations).toMatchObject({
      readOnlyHint: false,
      openWorldHint: true,
      destructiveHint: false,
    });

    expect(response.tools.find((tool) => tool.name === "delete_project")?.annotations).toMatchObject({
      readOnlyHint: false,
      openWorldHint: false,
      destructiveHint: true,
    });

    expect(response.tools.find((tool) => tool.name === "get_project")?.annotations).toMatchObject({
      readOnlyHint: true,
      openWorldHint: false,
      destructiveHint: false,
    });

    const workspaceResult = await client.callTool({ name: "list_workspaces", arguments: {} });
    expect(workspaceResult.isError).not.toBe(true);
    expect(workspaceResult.structuredContent).toEqual({ workspaces: [] });

    await client.close();
    await server.close();
  });
});
