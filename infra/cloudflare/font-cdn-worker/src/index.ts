type FontRecord = {
  familyName: string;
  subfamilyName?: string;
  weight: number;
  style: string;
  format: string;
  uri: string;
};

type CatalogResponse = {
  fonts?: FontRecord[];
};

type Env = {
  FONT_BUCKET: R2Bucket;
  FONT_CATALOG_URL: string;
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Accept, Content-Type, Range",
  "Access-Control-Expose-Headers": "Content-Type, Content-Length, ETag, Last-Modified",
};

function responseHeaders(contentType: string, cacheControl: string): Headers {
  const headers = new Headers(CORS_HEADERS);
  headers.set("Content-Type", contentType);
  headers.set("Cache-Control", cacheControl);
  return headers;
}

function cssFamilyName(value: string): string {
  return value.replace(/\+/g, " ").trim();
}

function cssQuote(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function cssFormat(format: string): string {
  switch (format.toLowerCase()) {
    case "woff2": return "woff2";
    case "woff": return "woff";
    case "otf": return "opentype";
    default: return "truetype";
  }
}

function opticalSizeRank(uri: string): number {
  const match = uri.match(/_(\d+)pt-/);
  if (!match) return 100;
  const size = Number(match[1]);
  return size === 18 ? 0 : size === 24 ? 1 : size === 28 ? 2 : size;
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function requestedFaces(spec: string | null): Array<{ weight: number; style: "normal" | "italic" }> {
  if (!spec) return [{ weight: 400, style: "normal" }];

  const at = spec.indexOf("@");
  if (at < 0) return [{ weight: 400, style: "normal" }];

  const axes = spec.slice(0, at).split(",").map((axis) => axis.trim());
  const rows = spec.slice(at + 1).split(";");
  return rows.flatMap((row) => {
    const values = row.split(",").map((value) => value.trim());
    const axisValues = new Map(axes.map((axis, index) => [axis, values[index]]));
    const weight = parseNumber(axisValues.get("wght")) ?? 400;
    const style = axisValues.get("ital") === "1" ? "italic" : "normal";
    return [{ weight, style }];
  });
}

function parseFamilyRequest(value: string): { familyName: string; faces: Array<{ weight: number; style: "normal" | "italic" }> } {
  const separator = value.indexOf(":");
  if (separator < 0) return { familyName: cssFamilyName(value), faces: [{ weight: 400, style: "normal" }] };
  return {
    familyName: cssFamilyName(value.slice(0, separator)),
    faces: requestedFaces(value.slice(separator + 1)),
  };
}

async function loadCatalog(env: Env): Promise<FontRecord[]> {
  const response = await fetch(env.FONT_CATALOG_URL, {
    headers: { Accept: "application/json" },
    cf: { cacheTtl: 3600, cacheEverything: true },
  });
  if (!response.ok) throw new Error(`Font catalog returned ${response.status}`);
  const payload = await response.json() as CatalogResponse;
  return Array.isArray(payload.fonts) ? payload.fonts.filter((font) => font.familyName && font.uri) : [];
}

function createCss(request: Request, fonts: FontRecord[]): Response {
  const url = new URL(request.url);
  const familyParams = url.searchParams.getAll("family");
  if (familyParams.length === 0) {
    return new Response("Missing family parameter", { status: 400, headers: responseHeaders("text/plain; charset=utf-8", "no-store") });
  }

  const display = url.searchParams.get("display") || "swap";
  const allowedDisplay = new Set(["auto", "block", "swap", "fallback", "optional"]);
  if (!allowedDisplay.has(display)) {
    return new Response("Invalid display parameter", { status: 400, headers: responseHeaders("text/plain; charset=utf-8", "no-store") });
  }

  const blocks: string[] = [];
  for (const familyParam of familyParams) {
    const requestSpec = parseFamilyRequest(familyParam);
    const familyFonts = fonts.filter((font) => font.familyName === requestSpec.familyName);
    if (familyFonts.length === 0) {
      return new Response(`Unknown font family: ${requestSpec.familyName}`, { status: 404, headers: responseHeaders("text/plain; charset=utf-8", "no-store") });
    }

    for (const face of requestSpec.faces) {
      const match = familyFonts
        .filter((font) => font.weight === face.weight && font.style === face.style)
        .sort((a, b) => opticalSizeRank(a.uri) - opticalSizeRank(b.uri) || a.uri.localeCompare(b.uri))[0];
      if (!match) {
        return new Response(`Font face is not available: ${requestSpec.familyName} ${face.style} ${face.weight}`, { status: 404, headers: responseHeaders("text/plain; charset=utf-8", "no-store") });
      }
      blocks.push([
        "@font-face {",
        `  font-family: ${cssQuote(match.familyName)};`,
        `  font-style: ${match.style};`,
        `  font-weight: ${match.weight};`,
        `  font-display: ${display};`,
        `  src: url(${cssQuote(match.uri)}) format(${cssQuote(cssFormat(match.format))});`,
        "}",
      ].join("\n"));
    }
  }

  const headers = responseHeaders("text/css; charset=utf-8", "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400");
  headers.set("Vary", "Accept-Encoding");
  return new Response(`${blocks.join("\n\n")}\n`, { headers });
}

function objectContentType(key: string): string {
  const extension = key.split(".").pop()?.toLowerCase();
  if (extension === "woff2") return "font/woff2";
  if (extension === "woff") return "font/woff";
  if (extension === "otf") return "font/otf";
  return "font/ttf";
}

async function serveObject(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const key = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  if (!key || key.includes("..")) return new Response("Not found", { status: 404 });

  const object = await env.FONT_BUCKET.get(key);
  if (!object) return new Response("Not found", { status: 404 });

  const headers = responseHeaders(object.httpMetadata?.contentType || objectContentType(key), "public, max-age=31536000, immutable");
  headers.set("ETag", object.httpEtag);
  headers.set("Content-Length", String(object.size));
  if (object.uploaded) headers.set("Last-Modified", object.uploaded.toUTCString());
  if (request.headers.get("If-None-Match") === object.httpEtag) return new Response(null, { status: 304, headers });
  return new Response(request.method === "HEAD" ? null : object.body, { headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: new Headers(CORS_HEADERS) });
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405, headers: new Headers({ Allow: "GET, HEAD, OPTIONS", ...CORS_HEADERS }) });

    const url = new URL(request.url);
    if (url.pathname === "/css2" || url.pathname === "/css") {
      try {
        return createCss(request, await loadCatalog(env));
      } catch (error) {
        return new Response(error instanceof Error ? error.message : "Unable to load font catalog", { status: 502, headers: responseHeaders("text/plain; charset=utf-8", "no-store") });
      }
    }
    return serveObject(request, env);
  },
};
