import { NextResponse } from "next/server";
import { mcpCorsHeaders } from "@/lib/mcp/cors";
import { getProtectedResourceMetadata } from "@/lib/mcp/metadata";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const metadata = getProtectedResourceMetadata(request);
  if (!metadata) {
    return NextResponse.json(
      { error: "MCP is not configured" },
      { status: 500, headers: mcpCorsHeaders() },
    );
  }
  return NextResponse.json(metadata, {
    headers: { "Cache-Control": "public, max-age=300", ...mcpCorsHeaders() },
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: mcpCorsHeaders() });
}
