import { NextResponse } from "next/server";
import { getProtectedResourceMetadata } from "@/lib/mcp/metadata";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const metadata = getProtectedResourceMetadata(request);
  if (!metadata) return NextResponse.json({ error: "MCP is not configured" }, { status: 500 });
  return NextResponse.json(metadata, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
