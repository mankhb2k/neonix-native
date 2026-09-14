import "server-only";

import { operationScopesEnabled } from "./auth";
import { getMcpConfig } from "./config";

export function getProtectedResourceMetadata(request: Request) {
  const config = getMcpConfig(request.url);
  if (!config) return null;

  return {
    resource: config.resource,
    authorization_servers: [config.issuer],
    bearer_methods_supported: ["header"],
    scopes_supported: [
      "openid",
      "email",
      "profile",
      "offline_access",
      ...(operationScopesEnabled() ? [
        "projects:read",
        "projects:write",
        "projects:delete",
        "assets:read",
        "assets:write",
        "assets:delete",
        "exports:read",
        "exports:write",
        "exports:delete",
      ] : []),
    ],
    resource_documentation: "https://neonix.video/docs",
  };
}
