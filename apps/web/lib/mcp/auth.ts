import "server-only";

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { getMcpConfig, type McpConfig } from "./config";

export type McpPrincipal = {
  userId: string;
  clientId: string;
  scopes: string[];
  token: string;
  expiresAt?: number;
};

type AuthenticationResult =
  | { ok: true; config: McpConfig; principal: McpPrincipal }
  | { ok: false; reason: "misconfigured" | "unauthorized"; config: McpConfig | null };

const jwksByUrl = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(config: McpConfig) {
  const existing = jwksByUrl.get(config.jwksUrl);
  if (existing) return existing;

  const jwks = createRemoteJWKSet(new URL(config.jwksUrl));
  jwksByUrl.set(config.jwksUrl, jwks);
  return jwks;
}

function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;

  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

function getStringClaim(payload: JWTPayload, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function authenticateMcpRequest(
  request: Request,
): Promise<AuthenticationResult> {
  const config = getMcpConfig(request.url);
  if (!config) return { ok: false, reason: "misconfigured", config: null };

  const token = getBearerToken(request);
  if (!token) return { ok: false, reason: "unauthorized", config };

  try {
    const { payload } = await jwtVerify(token, getJwks(config), {
      issuer: config.issuer,
      audience: "authenticated",
    });

    const userId = getStringClaim(payload, "sub");
    const clientId = getStringClaim(payload, "client_id");
    if (!userId || !clientId) {
      return { ok: false, reason: "unauthorized", config };
    }

    const rawScope = payload.scope;
    const scopes =
      typeof rawScope === "string"
        ? rawScope.split(/\s+/).filter(Boolean)
        : [];

    return {
      ok: true,
      config,
      principal: {
        userId,
        clientId,
        scopes,
        token,
        expiresAt: typeof payload.exp === "number" ? payload.exp : undefined,
      },
    };
  } catch {
    return { ok: false, reason: "unauthorized", config };
  }
}
