export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Glama.ai domain-ownership HTTP challenge for the "Neonix" hosted MCP
 * connector. Served here (not at a literal .well-known/glama.json route
 * folder, which typescript-eslint's project service fails to resolve) and
 * exposed at the required /.well-known/glama.json path via a rewrite in
 * next.config.ts. The claim token is supplied through deployment
 * configuration so the value shown in the Glama dashboard is never committed
 * to the repo.
 */
export function GET() {
  const claim = process.env.GLAMA_CLAIM_TOKEN?.trim();

  if (!claim) {
    return new Response("Challenge token is not configured", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  return new Response(
    JSON.stringify({
      $schema: "https://glama.ai/mcp/schemas/connector.json",
      claim,
    }),
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8",
      },
    },
  );
}
