/**
 * Glama.ai domain-ownership HTTP challenge for the "Neonix" hosted MCP
 * connector. Served here (not at a literal .well-known/glama.json route
 * folder, which typescript-eslint's project service fails to resolve) and
 * exposed at the required /.well-known/glama.json path via a rewrite in
 * next.config.ts. The claim value is not a secret — Glama documents it as
 * account-bound but not personal information, and it must be publicly
 * fetchable for verification to work — so it's committed here directly.
 */
const GLAMA_CLAIM = "glama_claim_bqFczvOnRE0bauJrz2n4gQaU7hkcjkKW";

export function GET() {
  return new Response(
    JSON.stringify({
      $schema: "https://glama.ai/mcp/schemas/connector.json",
      claim: GLAMA_CLAIM,
    }),
    {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Content-Type": "application/json; charset=utf-8",
      },
    },
  );
}
