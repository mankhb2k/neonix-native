import "server-only";

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
    },
  });
}
