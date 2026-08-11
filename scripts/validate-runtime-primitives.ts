/**
 * V3 Runtime Primitives — replaced by vitest smoke test.
 *
 * Phase 3 (compat-removal): previously depended on V2 parsers,
 * compiler bridge, and docs/fixtures/v2/ (all removed).
 * The actual validation now lives at:
 *   packages/motion-runtime/src/__tests__/v3-primitives-smoke.test.ts
 *
 * Run directly: pnpm --filter @motionvideo/motion-runtime test
 */
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

console.log("Running V3 runtime primitives via vitest...");
execSync(
  "pnpm --filter @motionvideo/motion-runtime exec vitest run --reporter=verbose src/__tests__/v3-primitives-smoke.test.ts",
  { cwd: repoRoot, stdio: "inherit" },
);
console.log("V3 runtime primitives smoke test PASSED");
