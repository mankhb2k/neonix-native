import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { createRemoteMcpServer, type RemoteMcpProjectApi } from "../src/remote";

const empty = () => Promise.resolve({});

const api: RemoteMcpProjectApi = {
  listWorkspaces: empty,
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

    await client.close();
    await server.close();
  });
});
