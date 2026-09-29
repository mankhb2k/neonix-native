import { createRemoteMcpServer } from "@motionvideo/motion-mcp/remote";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { INestApplication } from "@nestjs/common";
import { createServerAdapter } from "@whatwg-node/server";
import type { Express } from "express";
import { AssetsService } from "../assets/assets.service";
import type { Database } from "../db/client";
import { DATABASE } from "../db/database.module";
import { env } from "../env";
import { ProjectsService } from "../projects/projects.service";
import { RenderJobsService } from "../render-jobs/render-jobs.service";
import { WorkspacesService } from "../workspaces/workspaces.service";
import { buildMcpProjectApi } from "./mcp-api";
import { stubMcpPrincipal } from "./mcp-auth";

// Mounted directly on the raw Express instance, same reasoning as Better
// Auth's toNodeHandler mount in main.ts: the MCP SDK's Streamable HTTP
// transport speaks Web-standard Request/Response, not Nest's controller
// model, so there's nothing for a Nest controller to add here. Services are
// resolved once at boot via app.get() (they're stateless singletons) and
// closed over per-request rather than re-resolved on every call.
export function mountMcp(app: INestApplication, expressInstance: Express): void {
  const db = app.get<Database>(DATABASE);
  const workspaces = app.get(WorkspacesService);
  const projects = app.get(ProjectsService);
  const assets = app.get(AssetsService);
  const renderJobs = app.get(RenderJobsService);

  const handler = createServerAdapter(async (request: Request) => {
    const principal = stubMcpPrincipal();
    const api = buildMcpProjectApi(
      { db, workspaces, projects, assets, renderJobs, webAppUrl: env.webAppUrl },
      principal.userId,
    );
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    const server = createRemoteMcpServer({ api, principal });
    await server.connect(transport);
    return transport.handleRequest(request, {
      authInfo: {
        token: principal.token,
        clientId: principal.clientId,
        scopes: principal.scopes,
        expiresAt: principal.expiresAt,
        resource: new URL(request.url),
        extra: { userId: principal.userId },
      },
    });
  });

  expressInstance.use("/mcp", handler);
}
