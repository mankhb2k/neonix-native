import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { LayoutSnapshot } from "@motionvideo/html-compiler";

export const runtime = "nodejs";

type BakedEntry = { snapshot: LayoutSnapshot; stampedHtml: string };

/**
 * Dev-only: serves the real-Chromium layout measurements baked by
 * scripts/html-compiler-layout-snapshot-bake.mts, keyed by fixture id, so a
 * client component (native-stage's ComparePreviewLab) can compile a fixture
 * with `layoutSnapshot` set without embedding a Cloud Run secret token in
 * browser code. Baked, not a live Cloud Run call, on purpose - deterministic
 * and matches what html-compiler-layout-snapshot-diff.mts already verifies
 * offline against the same file. Re-reads the file on every request (no
 * in-memory cache) - it's a small dev-only JSON file re-baked often while
 * iterating, and a stale in-process cache would silently keep serving a
 * previous run's data across a re-bake.
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") return new Response(null, { status: 404 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: { message: "Missing id query param" } }, { status: 400 });

  const path = join(process.cwd(), "scripts/.html-compiler-layout-snapshots/snapshots.json");
  let baked: Record<string, BakedEntry>;
  try {
    baked = JSON.parse(await readFile(path, "utf8")) as Record<string, BakedEntry>;
  } catch {
    return Response.json({ error: { message: "No baked snapshots found - run scripts/html-compiler-layout-snapshot-bake.mts first" } }, { status: 503 });
  }

  const entry = baked[id];
  if (!entry) return Response.json({ error: { message: `No baked snapshot for fixture id "${id}"` } }, { status: 404 });
  return Response.json(entry);
}
