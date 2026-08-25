import "server-only";

export type McpConfig = {
  issuer: string;
  jwksUrl: string;
  resource: string;
  resourceMetadataUrl: string;
};

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function getMcpConfig(requestUrl?: string): McpConfig | null {
  const issuer = process.env.SUPABASE_OAUTH_ISSUER?.trim();
  const configuredResource =
    process.env.MCP_SERVER_URL?.trim() ||
    process.env.MCP_TOKEN_AUDIENCE?.trim();

  if (!issuer) return null;

  const normalizedIssuer = trimTrailingSlash(issuer);
  const resource =
    configuredResource ||
    (requestUrl ? new URL("/api/mcp", requestUrl).toString() : null);

  if (!resource) return null;

  let resourceUrl: URL;
  try {
    resourceUrl = new URL(resource);
  } catch {
    return null;
  }
  const resourceMetadataUrl = new URL(
    "/.well-known/oauth-protected-resource",
    resourceUrl.origin,
  ).toString();

  return {
    issuer: normalizedIssuer,
    jwksUrl: `${normalizedIssuer}/.well-known/jwks.json`,
    resource: resourceUrl.toString(),
    resourceMetadataUrl,
  };
}
