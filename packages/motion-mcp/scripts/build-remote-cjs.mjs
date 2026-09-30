// Builds the "./remote" and "./patch" subpaths to CJS bundles for plain-Node
// consumers (apps/api) that can't use this package's normal
// bundler-transpiled `src/*.ts` exports (see ARCHITECHTURE-adjacent project
// memory: `tsc` with `moduleResolution: "node"` runs out of memory
// resolving this package's raw TS source - for "./remote" it's 20+
// `server.registerTool()` calls with complex zod schemas blowing up TS's
// generic solver; for "./patch" it's not patch.ts itself (small, typechecks
// fine alone) but apps/api's `tsc`/Node needing to reach it through this
// package's much larger barrel (src/index.ts re-exports ./mcp, ./server,
// ./output-schemas too) and, at runtime, Node 22 flatly refusing to
// type-strip any .ts file under node_modules
// (ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING) regardless of OOM. Same
// fix either way: esbuild strips types instead of solving them and emits
// real, pre-compiled CJS - same reason `tsx`/vitest already run these files
// without issue in dev.
//
// This is a scoped exception, not the general packaging strategy: every
// other workspace package (and motion-mcp's own other subpaths) uses a
// plain `tsc` build - see each package's own tsconfig.build.json.
import { buildSync } from "esbuild";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const distDir = path.join(packageRoot, "dist");

mkdirSync(distDir, { recursive: true });

// Everything each entry point imports across a package boundary
// (@modelcontextprotocol/sdk, @motionvideo/motion-protocol/v2, zod) stays a
// real dependency, resolved at require()-time like any other package - only
// motion-mcp's OWN local sibling files (./annotations, ./patch, etc.) get
// inlined into that entry's bundle.
const external = ["@modelcontextprotocol/sdk", "@motionvideo/motion-protocol", "@motionvideo/motion-protocol/v2", "zod"];

buildSync({
  entryPoints: [path.join(packageRoot, "src/remote.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  outfile: path.join(distDir, "remote.js"),
  external,
});

buildSync({
  entryPoints: [path.join(packageRoot, "src/patch.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  outfile: path.join(distDir, "patch.js"),
  external,
});

// dist/*.d.ts are hand-written (types/*.d.ts), not tsc-generated, for the
// same reason - copied here so there's exactly one source of truth to keep
// in sync with each file's real exported surface.
copyFileSync(path.join(packageRoot, "types/remote.d.ts"), path.join(distDir, "remote.d.ts"));
copyFileSync(path.join(packageRoot, "types/patch.d.ts"), path.join(distDir, "patch.d.ts"));
writeFileSync(path.join(distDir, "package.json"), JSON.stringify({ type: "commonjs" }, null, 2) + "\n");

console.log("[motion-mcp] built dist/remote.js + dist/patch.js (esbuild) + copied hand-maintained .d.ts files");
