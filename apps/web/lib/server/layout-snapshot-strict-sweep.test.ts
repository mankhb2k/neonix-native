// @vitest-environment node
//
// This sweep makes real network calls to the deployed Cloud Run service via
// fetchLayoutSnapshot(), which is server-side-only code (never runs in a
// browser). The repo's default vitest environment for apps/web is
// happy-dom (see vitest.config.ts), which polyfills a browser-like fetch
// that enforces CORS/SOP preflight semantics no real Node.js server-to-server
// call is subject to - that mismatch produced OPTIONS 404 / "Same Origin
// Policy" errors here that have nothing to do with the real service. Forcing
// the Node environment for this one file makes it behave like the actual
// Next.js server runtime that calls this code in production.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { compileHtmlWithLayoutSnapshot, fetchLayoutSnapshot } from "./layout-snapshot";
import { stampNodeIds } from "@motionvideo/html-compiler";
import { HTML_COMPILER_PREVIEW_CASES, HTML_COMPILER_PREVIEW_FONT_ASSETS, HTML_COMPILER_PREVIEW_MEDIA_ASSETS } from "../docs/html-compiler-preview";

// Canary: fetchLayoutSnapshot() returns undefined on ANY failure (disabled
// flag, network error, timeout, non-2xx) by design - the same "safe no-op"
// contract that lets a real gap fall back to native silently. That means a
// fully unreachable service and a real 100%-covered fixture can look
// identical to the sweep below (layoutSnapshotStrict never gets a chance to
// fire if layoutSnapshot was never set at all). Confirm the service is
// actually reachable and returns real coverage BEFORE trusting the sweep's
// per-fixture results, so a connectivity outage fails loudly here instead of
// silently reporting a suspiciously clean report.
async function assertServiceIsReachable(): Promise<void> {
  const CANARY_HTML = `<!doctype html><html><head><meta name="neonix-document" content='{"kind":"neonix-html-document","schemaVersion":2,"composition":{"width":100,"height":100,"fps":30,"background":"#000","colorSpace":"srgb"}}'></head><body><div id="canary" style="width:10px;height:10px"></div></body></html>`;
  const stamped = stampNodeIds(CANARY_HTML);
  const snapshot = await fetchLayoutSnapshot(globalThis.crypto.randomUUID(), stamped, []);
  if (!snapshot || Object.keys(snapshot).length === 0) {
    throw new Error(
      "layout-probe service unreachable or returned no coverage for the canary fixture - " +
        "check LAYOUT_SNAPSHOT_ENABLED/LAYOUT_SNAPSHOT_URL/INTERNAL_WORKER_TOKEN in .env and that the Cloud Run service is up. " +
        "Aborting before the sweep, since a total connectivity failure would otherwise be indistinguishable from '100% CDP coverage' below.",
    );
  }
}

// Manual, network-dependent sweep against the REAL deployed layout-probe
// Cloud Run service (needs LAYOUT_SNAPSHOT_ENABLED/URL/INTERNAL_WORKER_TOKEN
// in .env pointed at it - see infra/cloud-run/layout-probe). Runs every
// fixture in the catalog (basic to advanced) with layoutSnapshotStrict: true,
// so ANY node missing CDP coverage (permanent exclusions - transform, SVG -
// or a real gap) is a hard compile error instead of a silent native
// fallback. Purpose: know the exact boundary of "layout is 100% CDP,
// verified" before starting paint-fidelity work on top of it.
const publicRoot = resolve(import.meta.dirname, "../../public");
const outDir = resolve(import.meta.dirname, "../../scripts/.html-compiler-layout-snapshots");
mkdirSync(outDir, { recursive: true });

describe("layout-snapshot strict sweep (manual, hits the real deployed service)", () => {
  it(
    "reports which fixtures compile with 100% CDP layout coverage vs which still need native fallback",
    async () => {
      await assertServiceIsReachable();
      const results: Array<{ id: string; group: string; status: "success" | "error"; errorCode?: string; errorMessage?: string }> = [];
      for (const fixture of HTML_COMPILER_PREVIEW_CASES) {
        const html = readFileSync(join(publicRoot, fixture.fixtureUrl.replace(/^\//, "")), "utf8");
        const result = await compileHtmlWithLayoutSnapshot(
          { html },
          HTML_COMPILER_PREVIEW_FONT_ASSETS,
          { composition: { id: fixture.id }, mediaAssets: HTML_COMPILER_PREVIEW_MEDIA_ASSETS, layoutSnapshotStrict: true },
        );
        const error = result.diagnostics.find((d) => d.severity === "error");
        results.push({
          id: fixture.id,
          group: fixture.category,
          status: result.status,
          ...(error ? { errorCode: error.code, errorMessage: error.message } : {}),
        });
        console.log(`${result.status === "success" ? "OK  " : "MISS"} ${fixture.id}${error ? ` - ${error.message}` : ""}`);
      }

      const succeeded = results.filter((r) => r.status === "success");
      const failed = results.filter((r) => r.status !== "success");
      const lines = [
        "# Layout snapshot strict sweep: 100% CDP coverage per fixture",
        "",
        `Total: ${results.length}, 100% CDP coverage: ${succeeded.length}, has a gap (native still needed): ${failed.length}`,
        "",
        "## Fixtures with a CDP gap (node/tag in the error message)",
        "",
        ...failed.map((r) => `- **${r.id}**: ${r.errorMessage}`),
        "",
        "## Fixtures with 100% CDP layout coverage (safe to trust layout as Chrome-exact for paint-fidelity work)",
        "",
        ...succeeded.map((r) => `- ${r.id}`),
      ];
      writeFileSync(join(outDir, "strict-sweep-report.md"), `${lines.join("\n")}\n`);
      console.log(`\n${succeeded.length}/${results.length} fixtures have 100% CDP layout coverage.`);
      console.log("Full report: scripts/.html-compiler-layout-snapshots/strict-sweep-report.md");
    },
    180_000,
  );
});
