import "server-only";

import { HTML_COMPILER_FONT_ASSETS } from "@/lib/server/html-compiler-font-assets";
import { compileHtmlDocument } from "@/lib/server/html-project-repository";
import { HTML_TAG_PROFILE, SUPPORTED_ANIMATION_TIMING_FUNCTIONS, SUPPORTED_PROPERTIES } from "@motionvideo/html-compiler";
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
import { type McpPrincipal } from "./auth";
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

  return createRemoteMcpServer({
    principal: remotePrincipal,
    api: {
      listWorkspaces: () => listWorkspaces(principal),
      createProject: (input) => createProtocolProject(principal, input),
      createProjectHtml: (input) => createProjectHtml(principal, input),
      listProjects: (input) => listProjects(principal, input),
      getProject: (input) => getProtocolProject(principal, input),
      updateProject: (input) => updateProtocolProject(principal, input),
      deleteProject: (input) => deleteProtocolProject(principal, input),
      openEditor: (input) => openEditor(principal, input),
      openPreview: (input) => openPreview(principal, input),
      documentApi: {
        getCapabilities: () => Promise.resolve({
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
             values: {
               animationTimingFunction: SUPPORTED_ANIMATION_TIMING_FUNCTIONS,
             },
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
           }),
        validateDocument: ({ html }) => {
          const result = compileHtmlDocument(html);
          return Promise.resolve({
            valid: result.status === "success" && !result.diagnostics.some((item) => item.severity === "error"),
            composition: result.source.composition,
            diagnostics: result.diagnostics,
            stats: { layerCount: result.protocol?.layers.length ?? 0 },
          });
        },
        compileDocument: ({ html }) => {
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
        },
      },
      getProjectJson: (input) => getProtocolProjectJson(principal, input),
      applyJsonPatch: (input) => applyProjectJsonPatch(principal, input),
      getProjectHtml: (input) => getProjectHtmlSource(principal, input),
      updateProjectHtml: (input) => updateProjectHtmlSource(principal, input),
      listHtmlRevisions: (input) => listProjectHtmlRevisions(principal, input),
      getHtmlRevision: (input) => getProjectHtmlRevision(principal, input),
      listAssets: (input) => listAssets(principal, input),
      requestAssetUpload: (input) => requestAssetUpload(principal, input),
      completeAssetUpload: (input) => completeAssetUpload(principal, input),
      importAsset: (input) => importAsset(principal, input),
      attachAssetToProject: (input) => attachAssetToProject(principal, input),
      deleteAsset: (input) => deleteAsset(principal, input),
      createExport: (input) => createExport(principal, input),
      getExport: (input) => getExport(principal, input),
      getExportDownloadUrl: (input) => getExportDownloadUrl(principal, input),
      cancelExport: (input) => cancelExport(principal, input),
    },
  });
}
