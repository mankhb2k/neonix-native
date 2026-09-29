// Builds only the "./remote" subpath to a CJS bundle for plain-Node
// consumers (apps/api) that can't use this package's normal
// bundler-transpiled `src/*.ts` exports (see ARCHITECHTURE-adjacent project
// memory: `tsc` with `moduleResolution: "node"` runs out of memory on this
// file specifically - 20+ `server.registerTool()` calls with complex zod
// schemas blow up TS's generic solver under that resolution mode, even
// though the exact same file typechecks fine under "bundler" resolution.
// esbuild sidesteps this because it strips types instead of solving them -
// same reason `tsx`/vitest already run this file without issue in dev.
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

buildSync({
  entryPoints: [path.join(packageRoot, "src/remote.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  outfile: path.join(distDir, "remote.js"),
  // Everything this file imports across a package boundary
  // (@modelcontextprotocol/sdk, @motionvideo/motion-protocol/v2, zod) stays
  // a real dependency, resolved at require()-time like any other package -
  // only motion-mcp's OWN local sibling files (./annotations, ./patch, etc.)
  // get inlined into this one bundle.
  external: ["@modelcontextprotocol/sdk", "@motionvideo/motion-protocol", "@motionvideo/motion-protocol/v2", "zod"],
});

// dist/remote.d.ts is hand-written (types/remote.d.ts), not tsc-generated,
// for the same OOM reason - copied here so there's exactly one source of
// truth to keep in sync with remote.ts's real exported surface
// (RemoteMcpProjectApi, RemoteMcpPrincipal, createRemoteMcpServer).
copyFileSync(path.join(packageRoot, "types/remote.d.ts"), path.join(distDir, "remote.d.ts"));
writeFileSync(path.join(distDir, "package.json"), JSON.stringify({ type: "commonjs" }, null, 2) + "\n");

console.log("[motion-mcp] built dist/remote.js (esbuild) + copied dist/remote.d.ts (hand-maintained)");
