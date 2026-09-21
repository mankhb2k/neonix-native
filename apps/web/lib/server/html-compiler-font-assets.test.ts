import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { HTML_COMPILER_FONT_ASSETS } from "./html-compiler-font-assets";

// This catalog is the deterministic font source for the public/MCP HTML
// compile path (create_project_html, update_project_html). A stale uri or
// integrity hash here compiles "successfully" but bakes a dead font
// reference into an otherwise-immutable project_revisions row.
describe("HTML_COMPILER_FONT_ASSETS", () => {
  for (const asset of HTML_COMPILER_FONT_ASSETS) {
    it(`${asset.id} points at a real file on disk with a matching integrity hash`, () => {
      const filePath = path.join(process.cwd(), "public", asset.uri.replace(/^\//, ""));
      expect(existsSync(filePath), `missing file for ${asset.uri}`).toBe(true);

      const bytes = readFileSync(filePath);
      const digest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
      expect(digest, `integrity mismatch for ${asset.uri}`).toBe(asset.integrity);
    });
  }
});
