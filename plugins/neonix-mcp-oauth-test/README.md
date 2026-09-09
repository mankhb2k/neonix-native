# Neonix MCP OAuth Test

This local plugin targets the canonical Neonix remote MCP resource:

`https://www.neonix.video/api/mcp`

The default points to the deployed canonical resource. The first authenticated use should exercise the OAuth flow. After login, use the read-only `list_workspaces` MCP tool as the smoke test.

For local testing, first set `MCP_SERVER_URL=http://localhost:3000/api/mcp` in the web app and then update `.mcp.json` to the same exact URL. For another deployment, use its canonical `/api/mcp` endpoint and make sure its protected-resource metadata advertises that exact URL.

Run the no-token discovery check from this directory:

```powershell
node .\scripts\check-mcp-oauth.mjs
```