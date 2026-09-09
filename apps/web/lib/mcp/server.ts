import "server-only";

import { compileHtmlDocument } from "@/lib/server/html-project-repository";
import { HTML_TAG_PROFILE, SUPPORTED_PROPERTIES } from "@motionvideo/html-compiler";
import {
  createRemoteMcpServer,
  type RemoteMcpPrincipal,
} from "@motionvideo/motion-mcp/remote";
import {
  createProject,
  getProject,
  listProjects,
  listWorkspaces,
  openEditor,
  updateProject,
} from "./projects";
import type { McpPrincipal } from "./auth";

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
      createProject: (input) => createProject(principal, input),
      listProjects: (input) => listProjects(principal, input),
      getProject: (input) => getProject(principal, input),
      updateProject: (input) => updateProject(principal, input),
      openEditor: (input) => openEditor(principal, input),
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
    },
  });
}
