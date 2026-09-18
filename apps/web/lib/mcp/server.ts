import "server-only";

import { compileHtmlDocument } from "@/lib/server/html-project-repository";
import { HTML_COMPILER_FONT_ASSETS } from "@/lib/server/html-compiler-font-assets";
import { HTML_TAG_PROFILE, SUPPORTED_PROPERTIES } from "@motionvideo/html-compiler";
import {
  createRemoteMcpServer,
  type RemoteMcpPrincipal,
} from "@motionvideo/motion-mcp/remote";
import {
  attachAssetToProject,
  completeAssetUpload,
  deleteAsset,
  importAsset,
  listAssets,
  requestAssetUpload,
} from "./assets";
import {
  requireMcpScope,
  type McpOperationScope,
  type McpPrincipal,
} from "./auth";
import {
  cancelExport,
  createExport,
  getExport,
  getExportDownloadUrl,
} from "./exports";
import {
  listProjects,
  listWorkspaces,
  openEditor,
  openPreview,
  createProtocolProject,
  createProjectHtml,
  getProtocolProject,
  getProtocolProjectJson,
  updateProtocolProject,
  deleteProtocolProject,
  getProjectHtmlSource,
  updateProjectHtmlSource,
  listProjectHtmlRevisions,
  getProjectHtmlRevision,
  applyProjectJsonPatch,
} from "./projects";

/**
 * Next/Vercel adapter: persistence and RLS stay in the web app, while tool
 * registration and MCP input contracts live in @motionvideo/motion-mcp.
 */
export function createMcpServer(principal: McpPrincipal) {
  const remotePrincipal: RemoteMcpPrincipal = principal;
  const guarded = <T>(scope: McpOperationScope, operation: () => Promise<T>) => {
    requireMcpScope(principal, scope);
    return operation();
  };

  return createRemoteMcpServer({
    principal: remotePrincipal,
    api: {
      listWorkspaces: () => guarded("projects:read", () => listWorkspaces(principal)),
      createProject: (input) => guarded("projects:write", () => createProtocolProject(principal, input)),
      createProjectHtml: (input) => guarded("projects:write", () => createProjectHtml(principal, input)),
      listProjects: (input) => guarded("projects:read", () => listProjects(principal, input)),
      getProject: (input) => guarded("projects:read", () => getProtocolProject(principal, input)),
      updateProject: (input) => guarded("projects:write", () => updateProtocolProject(principal, input)),
      deleteProject: (input) => guarded("projects:delete", () => deleteProtocolProject(principal, input)),
      openEditor: (input) => guarded("projects:read", () => openEditor(principal, input)),
      openPreview: (input) => guarded("projects:read", () => openPreview(principal, input)),
      documentApi: {
        getCapabilities: () => guarded("projects:read", () => Promise.resolve({
            apiVersion: 1,
            protocolVersion: 2,
            document: {
              kind: "neonix-html-document",
              schemaVersion: 2,
              metadata: "meta[name=neonix-document]",
            },
            htmlTags: Object.fromEntries(
              Object.entries(HTML_TAG_PROFILE).map(([group, tags]) => [group, [...tags].sort()]),
            ),
             cssProperties: [...SUPPORTED_PROPERTIES].sort(),
             fonts: [...new Set(HTML_COMPILER_FONT_ASSETS.map((font) => font.family))].sort().map((family) => ({
               family,
               weights: HTML_COMPILER_FONT_ASSETS
                 .filter((font) => font.family === family)
                 .map((font) => font.weight)
                 .sort((a, b) => a - b),
               styles: [...new Set(HTML_COMPILER_FONT_ASSETS
                 .filter((font) => font.family === family)
                 .map((font) => font.style))]
                 .sort(),
             })),
           })),
        validateDocument: ({ html }) => {
          return guarded("projects:read", () => {
            const result = compileHtmlDocument(html);
            return Promise.resolve({
              valid: result.status === "success" && !result.diagnostics.some((item) => item.severity === "error"),
              composition: result.source.composition,
              diagnostics: result.diagnostics,
              stats: { layerCount: result.protocol?.layers.length ?? 0 },
            });
          });
        },
        compileDocument: ({ html }) => {
          return guarded("projects:read", () => {
            const result = compileHtmlDocument(html);
            if (result.status !== "success" || !result.protocol) {
              return Promise.reject(new Error(result.diagnostics.find((item) => item.severity === "error")?.message ?? "HTML compilation failed"));
            }
            return Promise.resolve({
              status: "succeeded",
              protocolVersion: 2,
              composition: result.source.composition,
              protocol: result.protocol,
              diagnostics: result.diagnostics,
            });
          });
        },
      },
      getProjectJson: (input) => guarded("projects:read", () => getProtocolProjectJson(principal, input)),
      applyJsonPatch: (input) => guarded("projects:write", () => applyProjectJsonPatch(principal, input)),
      getProjectHtml: (input) => guarded("projects:read", () => getProjectHtmlSource(principal, input)),
      updateProjectHtml: (input) => guarded("projects:write", () => updateProjectHtmlSource(principal, input)),
      listHtmlRevisions: (input) => guarded("projects:read", () => listProjectHtmlRevisions(principal, input)),
      getHtmlRevision: (input) => guarded("projects:read", () => getProjectHtmlRevision(principal, input)),
      listAssets: (input) => guarded("assets:read", () => listAssets(principal, input)),
      requestAssetUpload: (input) => guarded("assets:write", () => requestAssetUpload(principal, input)),
      completeAssetUpload: (input) => guarded("assets:write", () => completeAssetUpload(principal, input)),
      importAsset: (input) => guarded("assets:write", () => importAsset(principal, input)),
      attachAssetToProject: (input) => guarded("assets:write", () => attachAssetToProject(principal, input)),
      deleteAsset: (input) => guarded("assets:delete", () => deleteAsset(principal, input)),
      createExport: (input) => guarded("exports:write", () => createExport(principal, input)),
      getExport: (input) => guarded("exports:read", () => getExport(principal, input)),
      getExportDownloadUrl: (input) => guarded("exports:read", () => getExportDownloadUrl(principal, input)),
      cancelExport: (input) => guarded("exports:delete", () => cancelExport(principal, input)),
    },
  });
}
