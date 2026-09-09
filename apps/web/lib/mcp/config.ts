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

function sameCanonicalHost(left: URL, right: URL): boolean {
  const normalize = (host: string) => host.toLowerCase().replace(/^www\./, "");
  return normalize(left.hostname) === normalize(right.hostname) && left.port === right.port;
}

export function getMcpConfig(requestUrl?: string): McpConfig | null {
  const issuer = process.env.SUPABASE_OAUTH_ISSUER?.trim();
  const configuredResource = process.env.MCP_SERVER_URL?.trim();

  if (!issuer) return null;

  const normalizedIssuer = trimTrailingSlash(issuer);
  const requestResource = requestUrl ? new URL("/api/mcp", requestUrl) : null;
  let resource = configuredResource || requestResource?.toString() || null;

  // Vercel commonly redirects the apex domain to its www canonical host. If
  // MCP_SERVER_URL still contains the apex domain, advertise the actual
  // resource host seen by the client so OAuth resource matching remains exact.
  if (configuredResource && requestResource) {
    try {
      const configuredUrl = new URL(configuredResource);
      if (sameCanonicalHost(configuredUrl, requestResource)) {
        resource = requestResource.toString();
      }
    } catch {
      return null;
    }
  }

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
