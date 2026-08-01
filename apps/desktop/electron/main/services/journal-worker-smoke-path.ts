/**
 * Pure path rules for journal-worker packaged smoke reports (no Electron import).
 */
import path from "node:path";

export function isPathInside(parent: string, child: string): boolean {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return (
    rel === "" ||
    (!rel.startsWith(`..${path.sep}`) && rel !== ".." && !path.isAbsolute(rel))
  );
}

/**
 * Resolve a report path that must live under tempRoot.
 * Harness supplies a hex token and optional OUT path (absolute under temp, or relative name).
 */
export function resolveJournalWorkerSmokeOutPath(input: {
  token?: string | null;
  requestedOut?: string | null;
  tempRoot: string;
}): string | null {
  const token = (input.token ?? "").trim();
  if (!/^[a-f0-9]{16,64}$/i.test(token)) return null;

  const tempRoot = path.resolve(input.tempRoot);
  const requested = (input.requestedOut ?? "").trim();

  const outPath = requested
    ? path.isAbsolute(requested)
      ? path.resolve(requested)
      : path.resolve(tempRoot, requested)
    : path.join(tempRoot, `journal-worker-smoke-${token}.json`);

  if (!isPathInside(tempRoot, outPath)) return null;
  return outPath;
}
