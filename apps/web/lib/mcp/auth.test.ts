import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { authenticateMcpRequest } from "./auth";

const ISSUER_PATH = "/auth/v1";
const realFetch = globalThis.fetch;

function makeRequest(token?: string): Request {
  return new Request("https://app.neonix.video/api/mcp", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe("authenticateMcpRequest", () => {
  let issuer: string;
  let privateKey: CryptoKey;

  beforeEach(async () => {
    // A distinct issuer host per test keeps the module-level JWKS resolver
    // cache in auth.ts from reusing a previous test's key across tests.
    issuer = `https://${crypto.randomUUID()}.supabase.co${ISSUER_PATH}`;
    const { publicKey, privateKey: signingKey } = await generateKeyPair("RS256");
    privateKey = signingKey;

    process.env.SUPABASE_OAUTH_ISSUER = issuer;
    process.env.MCP_SERVER_URL = "https://app.neonix.video/api/mcp";

    const jwk = await exportJWK(publicKey);
    const publicJwk = { ...jwk, kid: "test-key", alg: "RS256", use: "sig" };

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url === `${issuer}/.well-known/jwks.json`) {
        return new Response(JSON.stringify({ keys: [publicJwk] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return realFetch(input as RequestInfo);
    }) as typeof fetch;
  });

  async function signToken(claims: Record<string, unknown>, expiresIn = "1h") {
    return new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer(issuer)
      .setAudience("authenticated")
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(privateKey);
  }

  it("rejects a request with no bearer token", async () => {
    const result = await authenticateMcpRequest(makeRequest());
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected unauthorized result");
    expect(result.reason).toBe("unauthorized");
  });

  it("reports misconfigured when SUPABASE_OAUTH_ISSUER is unset", async () => {
    delete process.env.SUPABASE_OAUTH_ISSUER;
    const result = await authenticateMcpRequest(makeRequest("anything"));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected misconfigured result");
    expect(result.reason).toBe("misconfigured");
  });

  it("authenticates a valid token and parses its space-delimited scopes", async () => {
    const token = await signToken({ sub: "user-1", scope: "openid profile email" });
    const result = await authenticateMcpRequest(makeRequest(token));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.principal.userId).toBe("user-1");
    expect(result.principal.scopes).toEqual(["openid", "profile", "email"]);
    expect(result.principal.clientId).toBe("oauth-client");
  });

  it("accepts a token with no scope claim at all", async () => {
    // This is the shape every real Neonix MCP connector token has today:
    // Supabase Auth only ever issues openid/profile/email/offline_access,
    // and callers should stay authenticated even if `scope` is absent.
    const token = await signToken({ sub: "user-1" });
    const result = await authenticateMcpRequest(makeRequest(token));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.principal.scopes).toEqual([]);
  });

  it("falls back to the azp claim for clientId when client_id is absent", async () => {
    const token = await signToken({ sub: "user-2", azp: "claude-desktop" });
    const result = await authenticateMcpRequest(makeRequest(token));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.principal.clientId).toBe("claude-desktop");
  });

  it("rejects an expired token", async () => {
    const token = await signToken({ sub: "user-3" }, "-10s");
    const result = await authenticateMcpRequest(makeRequest(token));
    expect(result.ok).toBe(false);
  });

  it("rejects a token signed by an untrusted key", async () => {
    const { privateKey: rogueKey } = await generateKeyPair("RS256");
    const token = await new SignJWT({ sub: "user-4" })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer(issuer)
      .setAudience("authenticated")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(rogueKey);

    const result = await authenticateMcpRequest(makeRequest(token));
    expect(result.ok).toBe(false);
  });

  it("rejects a token whose issuer does not match the configured issuer", async () => {
    const token = await new SignJWT({ sub: "user-5" })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer("https://not-the-configured-issuer.example.com/auth/v1")
      .setAudience("authenticated")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);

    const result = await authenticateMcpRequest(makeRequest(token));
    expect(result.ok).toBe(false);
  });
});
