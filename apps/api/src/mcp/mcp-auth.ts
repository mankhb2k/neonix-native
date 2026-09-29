import type { RemoteMcpPrincipal } from "@motionvideo/motion-mcp/remote";

// TODO(auth): replace with a real Better Auth / OAuth resource-server check
// (the MCP 2026-07-28 authorization profile - @better-auth/mcp) once that
// cutover happens, same deferral as CurrentUserGuard (see
// src/auth/current-user.guard.ts). Every MCP request is currently treated
// as already authenticated as SEED_USER_ID - fine for the internal/test
// deployment this is being built for first, not for real end-user traffic.
export function stubMcpPrincipal(): RemoteMcpPrincipal {
  const userId = process.env.SEED_USER_ID?.trim();
  if (!userId) throw new Error("SEED_USER_ID is not configured");
  return {
    userId,
    clientId: "internal-stub-client",
    scopes: ["*"],
    token: "stub-token",
  };
}
