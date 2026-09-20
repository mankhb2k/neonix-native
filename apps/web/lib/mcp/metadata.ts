import "server-only";

import { operationScopesEnabled } from "./auth";
import { getMcpConfig } from "./config";
import { MCP_OPERATION_SCOPES, MCP_STANDARD_SCOPES } from "./permissions";

export function getProtectedResourceMetadata(request: Request) {
  const config = getMcpConfig(request.url);
  if (!config) return null;

  return {
    resource: config.resource,
    authorization_servers: [config.issuer],
    bearer_methods_supported: ["header"],
    scopes_supported: [
      ...MCP_STANDARD_SCOPES,
      ...(operationScopesEnabled() ? MCP_OPERATION_SCOPES : []),
    ],
    resource_documentation: "https://www.neonix.video/docs",
  };
}
