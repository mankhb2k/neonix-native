/**
 * Compatibility facade for internal imports that still use the pre-Phase 1
 * module path. New code should import from `compiler/html/*` directly.
 */
export { parseHtml } from "./html/parser";
export { neonixManifest, withoutNeonixManifest } from "./html/manifest";
