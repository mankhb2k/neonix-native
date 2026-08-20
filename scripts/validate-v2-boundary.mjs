import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repositoryRoot = path.resolve(new URL("..", import.meta.url).pathname);
const ownedRoots = [
  path.join(repositoryRoot, "packages", "motion-compiler", "src", "compile-v2"),
  path.join(repositoryRoot, "packages", "motion-runtime", "src", "v2"),
];
const forbidden = [
  { pattern: /\bV1\b|v1/, label: "V1 marker" },
  { pattern: /formatVersion\s*:\s*1/, label: "Runtime/Protocol V1 format" },
  { pattern: /motion-protocol[\\/]v1/, label: "Protocol V1 import" },
  { pattern: /compile(?:MotionProject|Project).*V1/, label: "V1 compiler API" },
  { pattern: /evaluateCompositionFrameV1/, label: "V1 runtime evaluator API" },
];

function filesUnder(root) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...filesUnder(entryPath));
    else if (/\.(?:ts|tsx|mts|cts|js|mjs)$/.test(entry.name)) files.push(entryPath);
  }
  return files;
}

const violations = [];
for (const root of ownedRoots) {
  for (const file of filesUnder(root)) {
    const source = fs.readFileSync(file, "utf8");
    for (const rule of forbidden) {
      if (rule.pattern.test(source)) {
        violations.push(`${path.relative(repositoryRoot, file)}: ${rule.label}`);
      }
    }
  }
}

if (violations.length) {
  console.error("V2 boundary violations detected:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log("V2 boundary clean: compiler/runtime V2-owned sources contain no V1 path.");
