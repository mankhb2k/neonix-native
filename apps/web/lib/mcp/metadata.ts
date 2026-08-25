import "server-only";

import { getMcpConfig } from "./config";

export function getProtectedResourceMetadata(request: Request) {
  const config = getMcpConfig(request.url);
  if (!config) return null;

  return {
    resource: config.resource,
    authorization_servers: [config.issuer],
    bearer_methods_supported: ["header"],
    scopes_supported: ["openid", "email", "profile"],
    resource_documentation: "https://neonix.video/docs",
  };
}
