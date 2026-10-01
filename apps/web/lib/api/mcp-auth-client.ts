import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import { createAuthClient } from "better-auth/react";

// Auth client for the MCP OAuth sign-in/consent pages only. oauthProviderClient()
// attaches the page's signed authorize query (`oauth_query`) to every non-GET
// request, so the provider can resume the flow after sign-in (including the
// Google round-trip) and send the browser on to /mcp/consent. It must stay off
// the regular `authClient`: on pages with unrelated query strings (e.g.
// /login?next=...) it would send an invalid `oauth_query` and break sign-in.
export const mcpAuthClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080",
  fetchOptions: { credentials: "include" },
  plugins: [oauthProviderClient()],
});
