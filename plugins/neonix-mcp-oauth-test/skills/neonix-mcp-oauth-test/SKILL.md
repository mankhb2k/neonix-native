---
name: neonix-mcp-oauth-test
description: Test Neonix remote MCP OAuth discovery and authenticated tool access.
---

# Neonix MCP OAuth test

Use the configured `neonix-mcp` server from `../.mcp.json` to verify the complete remote MCP authorization path.

## Preconditions

- The Neonix web app is running.
- `SUPABASE_OAUTH_ISSUER` is configured in the web app.
- `MCP_SERVER_URL` points at the same MCP resource URL as the client, normally `https://www.neonix.video/api/mcp` (or the exact canonical URL advertised by the server).

## Test sequence

1. Run `scripts/check-mcp-oauth.mjs` or inspect the endpoint directly. A request without a bearer token must return `401` and a `WWW-Authenticate` header containing `resource_metadata`.
2. Fetch the advertised protected-resource metadata. Confirm it contains:
   - `resource` equal to the MCP endpoint;
   - one `authorization_servers` entry matching `SUPABASE_OAUTH_ISSUER`;
   - `bearer_methods_supported` containing `header`;
   - the expected OpenID scopes.
3. Trigger the MCP connection through Codex. Allow the OAuth browser flow to complete and return to Codex.
4. Confirm the authenticated connection exposes the Neonix tools.
5. Call `list_workspaces`, which is read-only, to verify that the access token is accepted by the MCP JWT verifier and reaches the authenticated application API.

Do not use mutating project, asset, export, or delete tools for this smoke test. If authentication fails, report the HTTP status, `WWW-Authenticate` value, metadata URL, issuer, resource URL, and whether the failure happened before or after the browser callback. Never print access or refresh tokens.