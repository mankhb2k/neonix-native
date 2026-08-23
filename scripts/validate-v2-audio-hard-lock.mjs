import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(file));
    else if (/\.(?:ts|tsx|js|mjs|cjs)$/.test(entry.name)) files.push(file);
  }
  return files;
}

function relative(file) {
  return path.relative(repositoryRoot, file).split(path.sep).join("/");
}

function productionFiles(directory) {
  return walk(directory).filter((file) => !/(?:__tests__|\.test\.)/.test(relative(file)));
}

const violations = [];
const v1Pattern = /\b(?:MotionProjectV1|parseMotionProjectV1|serializeMotionProjectV1|compileProjectV1|motion-project)\b|formatVersion\s*:\s*1/;
const audioLegacyPattern = /audioSampleRate/;

const roots = [
  ["packages/motion-protocol/src", productionFiles(path.join(repositoryRoot, "packages", "motion-protocol", "src"))],
  ["packages/motion-compiler/src/compile-v2", productionFiles(path.join(repositoryRoot, "packages", "motion-compiler", "src", "compile-v2"))],
  ["packages/motion-runtime/src", productionFiles(path.join(repositoryRoot, "packages", "motion-runtime", "src"))],
  ["packages/playback-engine/src", productionFiles(path.join(repositoryRoot, "packages", "playback-engine", "src"))],
  ["packages/preview-renderer/src", productionFiles(path.join(repositoryRoot, "packages", "preview-renderer", "src"))],
  ["packages/remotion-renderer/src", productionFiles(path.join(repositoryRoot, "packages", "remotion-renderer", "src"))],
  ["apps/remotion-site/src", productionFiles(path.join(repositoryRoot, "apps", "remotion-site", "src"))],
  ["apps/web V2 preview host", [
    path.join(repositoryRoot, "apps", "web", "components", "docs", "PreviewLab.tsx"),
    path.join(repositoryRoot, "apps", "web", "components", "docs", "PreviewStage.tsx"),
    path.join(repositoryRoot, "apps", "web", "lib", "docs", "preview-lab.ts"),
  ].filter((file) => fs.existsSync(file)),],
];

for (const [label, files] of roots) {
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    if (v1Pattern.test(source)) violations.push(`${relative(file)}: V1 marker in ${label}`);
    if (audioLegacyPattern.test(source)) violations.push(`${relative(file)}: legacy audioSampleRate`);
  }
}

const protocolIndependentRoots = [
  "packages/motion-runtime/src",
  "packages/playback-engine/src",
  "packages/preview-renderer/src",
  "packages/remotion-renderer/src",
];
for (const root of protocolIndependentRoots) {
  for (const file of productionFiles(path.join(repositoryRoot, ...root.split("/")))) {
    const source = fs.readFileSync(file, "utf8");
    if (source.includes("@motionvideo/motion-protocol")) {
      violations.push(`${relative(file)}: runtime/adapter code imports Protocol JSON`);
    }
  }
}

const audioCapabilities = fs.readFileSync(
  path.join(repositoryRoot, "packages", "motion-protocol", "src", "v2", "audio-capabilities.ts"),
  "utf8",
);
if ((audioCapabilities.match(/status: "certified"/g) ?? []).length !== 10) {
  violations.push("audio-capabilities.ts: all ten Phase 2 audio atoms must be certified");
}

if (violations.length) {
  console.error("V2 audio hard-lock failed:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log("V2 audio hard-lock clean: Protocol, compiler, runtime, playback, preview, and Remotion are V2-only.");
