import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { net, protocol, type CustomScheme } from "electron";
import {
  APP_HOST,
  APP_PROTOCOL,
  getPackagedHint,
} from "../../shared/renderer-mode";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

export const APP_SCHEME_PRIVILEGES: CustomScheme = {
  scheme: APP_PROTOCOL,
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    corsEnabled: true,
    stream: true,
  },
};

/** Must run before app.ready. Prefer registerDesktopSchemesPrivileged when both protocols are needed. */
export function registerAppSchemePrivileged(): void {
  protocol.registerSchemesAsPrivileged([APP_SCHEME_PRIVILEGES]);
}

type RendererRootResolver = () => string;

/** Placeholder until `configureDesktopPaths` / packaged configure runs. */
let rendererRootResolver: RendererRootResolver = () => {
  throw new Error(
    "rendererRoot not configured — call configureDesktopPaths before registering app protocol",
  );
};

/** Override for tests or packaged layout injection. */
export function setRendererRootResolver(resolver: RendererRootResolver): void {
  rendererRootResolver = resolver;
}

export function resetRendererRootResolver(): void {
  rendererRootResolver = () => {
    throw new Error(
      "rendererRoot not configured — call configureDesktopPaths before registering app protocol",
    );
  };
}

export function rendererRoot(): string {
  return rendererRootResolver();
}

/**
 * Resolve app://bundle/... to a file under dist-renderer.
 * Rejects path traversal outside the bundle root.
 * Returns null for missing/invalid URLs and for `.map` when release/packaged.
 */
export function resolveBundlePath(
  requestUrl: string,
  options?: { allowSourceMaps?: boolean; root?: string },
): string | null {
  let parsed: URL;
  try {
    parsed = new URL(requestUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== `${APP_PROTOCOL}:`) return null;
  if (parsed.hostname !== APP_HOST) return null;

  const root = path.resolve(options?.root ?? rendererRoot());
  let rel = decodeURIComponent(parsed.pathname || "/");
  if (rel.startsWith("/")) rel = rel.slice(1);
  if (!rel || rel.endsWith("/")) {
    rel = rel ? `${rel}index.html` : "index.html";
  }

  const segments = rel.split(/[/\\]+/).filter((seg) => seg.length > 0);
  if (segments.some((seg) => seg === "..")) return null;
  const cleaned = segments.filter((seg) => seg !== ".");

  const candidate = path.resolve(root, ...cleaned);
  const relative = path.relative(root, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }

  const ext = path.extname(candidate).toLowerCase();
  const allowMaps =
    options?.allowSourceMaps === true ||
    (options?.allowSourceMaps !== false &&
      !getPackagedHint() &&
      process.env.MOTIONVIDEO_RELEASE !== "1");
  if (ext === ".map" && !allowMaps) {
    return null;
  }

  return candidate;
}

export function registerAppProtocolHandler(): void {
  protocol.handle(APP_PROTOCOL, async (request) => {
    const filePath = resolveBundlePath(request.url);
    if (!filePath) {
      return new Response("Not found", { status: 404, statusText: "Not Found" });
    }
    try {
      await fs.promises.access(filePath, fs.constants.R_OK);
    } catch {
      return new Response("Not found", { status: 404, statusText: "Not Found" });
    }
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] ?? "application/octet-stream";
    const response = await net.fetch(pathToFileURL(filePath).toString());
    const headers = new Headers(response.headers);
    headers.set("Content-Type", mime);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  });
}

export function appBundleIndexUrl(): string {
  return `${APP_PROTOCOL}://${APP_HOST}/index.html`;
}

/**
 * Packaged asar layout: dist-renderer next to package.json inside app.asar.
 * Prefer `configureDesktopPaths` which also sets repo/resources roots.
 */
export function configurePackagedRendererRoot(appPath: string): void {
  setRendererRootResolver(() => path.join(appPath, "dist-renderer"));
}
