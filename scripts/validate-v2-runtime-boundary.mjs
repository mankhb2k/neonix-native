import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const runtimeRoot = path.join(repositoryRoot, "packages", "motion-runtime");
const runtimeSourceRoot = path.join(runtimeRoot, "src");
const packageJson = JSON.parse(
  fs.readFileSync(path.join(runtimeRoot, "package.json"), "utf8"),
);

const sourceFiles = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(entryPath);
    else if (/\.(?:ts|tsx|mts|cts|js|mjs)$/.test(entry.name)) {
      sourceFiles.push(entryPath);
    }
  }
}

walk(runtimeSourceRoot);
const violations = [];

if (
  packageJson.dependencies?.["@motionvideo/motion-protocol"] ||
  packageJson.devDependencies?.["@motionvideo/motion-protocol"]
) {
  violations.push("motion-runtime package.json depends on motion-protocol");
}

for (const file of sourceFiles) {
  const source = fs.readFileSync(file, "utf8");
  if (source.includes("@motionvideo/motion-protocol")) {
    violations.push(`${path.relative(repositoryRoot, file)} imports motion-protocol`);
  }
  if (path.relative(runtimeSourceRoot, file).split(path.sep)[0] === "testing") {
    violations.push(`${path.relative(repositoryRoot, file)} is a runtime Protocol fixture`);
  }
}

if (violations.length > 0) {
  console.error("V2 runtime boundary failed:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log("V2 runtime boundary clean: Runtime IR is independent of Protocol JSON.");
