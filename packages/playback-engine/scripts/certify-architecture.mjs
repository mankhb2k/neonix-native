import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const sourceRoot = join(packageRoot, "src");
const required = ["core/playback-engine.ts", "core/transport-state-machine.ts", "clock/clock-controller.ts", "audio/pcm-window.ts", "audio/worklet-protocol.ts", "video/html-video-backend.ts", "resources/media-resource-provider.ts", "diagnostics/snapshot.ts", "editor/playback-controller-v3.ts"];
const forbiddenFlat = ["engine.ts", "clock.ts", "types.ts", "operations.ts", "readiness.ts", "video-preload.ts", "html-video-backend.ts"];
const missing = required.filter((file) => !existsSync(join(sourceRoot, file)));
const flat = forbiddenFlat.filter((file) => existsSync(join(sourceRoot, file)));
const workspaceRoot = resolve(packageRoot, "../..");
const legacyConsumers = [];
const compatibilityBridge = [];
function scan(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", "dist"].includes(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) scan(path);
    else if (/\.(ts|tsx|js|mjs|json)$/.test(entry.name) && !path.includes(`${join("packages", "playback-engine", "scripts")}`)) {
      const text = readFileSync(path, "utf8");
      if (text.includes("@motionvideo/playback-engine-next")) {
        const relativePath = relative(workspaceRoot, path);
        legacyConsumers.push(relativePath);
      }
    }
  }
}
scan(workspaceRoot);
const report = { canonicalStructure: missing.length === 0 && flat.length === 0, missing, flat, legacyConsumers, compatibilityBridge, cutoverReady: missing.length === 0 && flat.length === 0 && legacyConsumers.length === 0 && compatibilityBridge.length === 0 };
console.log(JSON.stringify(report, null, 2));
if (!report.cutoverReady) process.exitCode = 1;
