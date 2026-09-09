const endpoint = process.argv[2] || process.env.NEONIX_MCP_URL || "https://www.neonix.video/api/mcp";

function fail(message) {
  console.error(`MCP OAuth preflight failed: ${message}`);
  process.exitCode = 1;
}

try {
  const endpointUrl = new URL(endpoint);
  const unauthenticated = await fetch(endpointUrl, { headers: { Accept: "application/json" } });
  const challenge = unauthenticated.headers.get("www-authenticate") || "";

  console.log(`endpoint: ${endpointUrl}`);
  console.log(`unauthenticated status: ${unauthenticated.status}`);
  console.log(`www-authenticate: ${challenge || "<missing>"}`);

  if (unauthenticated.status !== 401) {
    fail("the MCP endpoint should reject a request without a bearer token with HTTP 401");
    process.exit();
  }

  const metadataMatch = /resource_metadata="([^"]+)"/i.exec(challenge);
  const metadataUrl = metadataMatch?.[1] || new URL("/.well-known/oauth-protected-resource", endpointUrl.origin).toString();
  const metadataResponse = await fetch(metadataUrl, { headers: { Accept: "application/json" } });
  const metadata = await metadataResponse.json();

  console.log(`metadata status: ${metadataResponse.status}`);
  console.log(`resource: ${metadata.resource || "<missing>"}`);
  console.log(`authorization_servers: ${JSON.stringify(metadata.authorization_servers || [])}`);
  console.log(`scopes_supported: ${JSON.stringify(metadata.scopes_supported || [])}`);

  if (!metadataResponse.ok) fail("protected-resource metadata was not reachable");
  if (metadata.resource !== endpointUrl.toString()) fail("metadata resource does not exactly match the MCP endpoint");
  if (!Array.isArray(metadata.authorization_servers) || metadata.authorization_servers.length === 0) fail("metadata has no authorization server");
  if (!Array.isArray(metadata.bearer_methods_supported) || !metadata.bearer_methods_supported.includes("header")) fail("metadata does not advertise bearer header support");
  if (process.exitCode === undefined) console.log("MCP OAuth discovery preflight passed; continue with the browser OAuth flow in Codex.");
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}