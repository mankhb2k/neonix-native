import "server-only";

// The MCP endpoint and its OAuth metadata document are authenticated with a
// Bearer token (Authorization header), not cookies, so a permissive
// Access-Control-Allow-Origin does not expose ambient credentials the way it
// would for a cookie-authenticated endpoint. Browser-based MCP clients and
// inspector tools need these headers to complete the Streamable HTTP
// handshake and the OAuth discovery fetch cross-origin.
export function mcpCorsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Authorization, Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version",
    "Access-Control-Expose-Headers": "Mcp-Session-Id, WWW-Authenticate",
    "Access-Control-Max-Age": "86400",
  };
}

export function withMcpCors(headers?: HeadersInit): Headers {
  const merged = new Headers(headers);
  for (const [key, value] of Object.entries(mcpCorsHeaders())) {
    merged.set(key, value);
  }
  return merged;
}

export function withMcpCorsResponse(response: Response): Response {
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: withMcpCors(response.headers),
  });
}
