/** Custom protocol for project-scoped media files. */

export const MVMEDIA_PROTOCOL = "mvmedia";
export const MVMEDIA_HOST = "media";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
};

/** token → absolute project directory (parent of .mt / assets). */
const projectRootsByToken = new Map<string, string>();

export function mimeForExt(ext: string): string {
  return MIME[ext.toLowerCase()] ?? "application/octet-stream";
}

export function ensureProjectMediaToken(projectDir: string): string {
  const normalized = projectDir.replace(/\\/g, "/");
  for (const [token, dir] of projectRootsByToken) {
    if (dir.replace(/\\/g, "/") === normalized) return token;
  }
  const token = `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  projectRootsByToken.set(token, projectDir);
  return token;
}

export function revokeProjectMediaToken(projectDir: string): void {
  const normalized = projectDir.replace(/\\/g, "/");
  for (const [token, dir] of [...projectRootsByToken.entries()]) {
    if (dir.replace(/\\/g, "/") === normalized) {
      projectRootsByToken.delete(token);
    }
  }
}

export function clearAllProjectMediaTokens(): void {
  projectRootsByToken.clear();
}

export function getProjectDirForToken(token: string): string | undefined {
  return projectRootsByToken.get(token);
}

/** Build `mvmedia://media/<token>/<relative-uri>`. */
export function buildMvmediaUrl(token: string, relativeUri: string): string {
  const cleaned = relativeUri.replace(/\\/g, "/").replace(/^\/+/, "");
  const encoded = cleaned
    .split("/")
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `${MVMEDIA_PROTOCOL}://${MVMEDIA_HOST}/${token}/${encoded}`;
}

export function parseMvmediaUrl(requestUrl: string): {
  token: string;
  relativeUri: string;
} | null {
  let parsed: URL;
  try {
    parsed = new URL(requestUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== `${MVMEDIA_PROTOCOL}:`) return null;
  if (parsed.hostname !== MVMEDIA_HOST) return null;

  let pathname = decodeURIComponent(parsed.pathname || "/");
  if (pathname.startsWith("/")) pathname = pathname.slice(1);
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;
  const token = segments[0]!;
  const relativeUri = segments.slice(1).join("/");
  return { token, relativeUri };
}

export { projectRootsByToken as _projectRootsByTokenForTests };
