/* eslint-disable no-console */
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { NextResponse } from "next/server";
import { authenticateMcpRequest } from "@/lib/mcp/auth";
import { mcpCorsHeaders, withMcpCorsResponse } from "@/lib/mcp/cors";
import { createMcpServer } from "@/lib/mcp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status: number, headers?: HeadersInit) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...mcpCorsHeaders(),
        ...headers,
      },
    },
  );
}

async function handle(request: Request) {
  const authentication = await authenticateMcpRequest(request);
  if (!authentication.ok) {
    if (authentication.reason === "misconfigured") {
      return jsonError("MCP authentication is not configured", 500);
    }
    const metadata = authentication.config?.resourceMetadataUrl;
    return jsonError("Unauthorized", 401, {
      "WWW-Authenticate": metadata
        ? `Bearer resource_metadata="${metadata}"`
        : "Bearer",
    });
  }

  try {
    const { principal, config } = authentication;
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    const server = createMcpServer(principal);
    await server.connect(transport);
    const response = await transport.handleRequest(request, {
      authInfo: {
        token: principal.token,
        clientId: principal.clientId,
        scopes: principal.scopes,
        expiresAt: principal.expiresAt,
        resource: new URL(config.resource),
        extra: { userId: principal.userId },
      },
    });
    return withMcpCorsResponse(response);
  } catch (error) {
    console.error("[mcp] request failed", error);
    return jsonError("MCP request failed", 500);
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: mcpCorsHeaders() });
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
