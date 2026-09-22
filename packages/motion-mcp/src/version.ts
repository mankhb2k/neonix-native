// Single source of truth for the MCP server's protocol-level version — the
// value sent to every client in the `initialize` response's serverInfo. Keep
// packages/motion-mcp/package.json's "version" field in sync with this.
export const MCP_SERVER_VERSION = "1.0.0";
