export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * OpenAI Apps submission domain-verification challenge.
 *
 * The token is intentionally supplied through deployment configuration so the
 * value shown in the OpenAI submission form is never committed to the repo.
 */
export function GET() {
  const token = process.env.OPENAI_APPS_CHALLENGE_TOKEN?.trim();

  if (!token) {
    return new Response("Challenge token is not configured", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  return new Response(token, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
