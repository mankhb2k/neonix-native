import "server-only";

import { getMcpConfig } from "./config";
import { MCP_STANDARD_SCOPES } from "./permissions";

export function getProtectedResourceMetadata(request: Request) {
  const config = getMcpConfig(request.url);
  if (!config) return null;

  // The OAuth authorization server (Supabase Auth) only recognizes
  // openid/profile/email/phone/offline_access as valid `scope` request
  // values and rejects the authorize request outright (redirecting back to
  // the client with `error=invalid_request`) if any operation scope
  // (e.g. "projects:read") is included. Operation-level access is granted
  // through the app's own consent flow, not the OAuth scope parameter, so
  // those scopes must never be advertised here — a spec-compliant client
  // (e.g. Smithery) that requests exactly what's advertised would otherwise
  // have its authorization popup rejected before it ever loads.
  return {
    resource: config.resource,
    authorization_servers: [config.issuer],
    bearer_methods_supported: ["header"],
    scopes_supported: [...MCP_STANDARD_SCOPES],
    resource_documentation: "https://www.neonix.video/docs",
  };
}
