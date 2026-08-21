import fs from "node:fs";
import path from "node:path";

const repositoryRoot = process.cwd();
const rendererRoots = [
  path.join(repositoryRoot, "packages", "preview-renderer", "src"),
  path.join(repositoryRoot, "packages", "remotion-renderer", "src"),
];
const forbidden = [
  { pattern: /\bV1\b|\bv1\b/, label: "V1 marker" },
  { pattern: /formatVersion\s*:\s*1/, label: "V1 format" },
  { pattern: /@motionvideo[\\/]motion-protocol/, label: "Protocol import" },
  { pattern: /@motionvideo[\\/]motion-compiler/, label: "Compiler import" },
  { pattern: /@motionvideo[\\/]render-contracts/, label: "render-contracts import" },
];

function walk(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(file));
    else if (/\.(?:ts|tsx|js|mjs|cjs)$/.test(entry.name)) files.push(file);
  }
  return files;
}

const violations = [];
for (const root of rendererRoots) {
  for (const file of walk(root)) {
    const relative = path.relative(repositoryRoot, file).split(path.sep).join("/");
    if (/(?:__tests__|\.test\.)/.test(relative)) continue;
    const source = fs.readFileSync(file, "utf8");
    for (const rule of forbidden) {
      if (rule.pattern.test(source)) violations.push(`${relative}: ${rule.label}`);
    }
  }
}

const previewPackage = JSON.parse(
  fs.readFileSync(path.join(repositoryRoot, "packages", "preview-renderer", "package.json"), "utf8"),
);
const remotionPackage = JSON.parse(
  fs.readFileSync(path.join(repositoryRoot, "packages", "remotion-renderer", "package.json"), "utf8"),
);
if (Object.keys(previewPackage.dependencies ?? {}).some((name) => name !== "@motionvideo/motion-runtime")) {
  violations.push("preview-renderer production dependencies must contain only motion-runtime");
}
for (const name of [
  "@motionvideo/motion-protocol",
  "@motionvideo/motion-compiler",
  "@motionvideo/render-contracts",
]) {
  if (remotionPackage.dependencies?.[name]) {
    violations.push(`remotion-renderer production dependency must not contain ${name}`);
  }
}
for (const packageName of [
  "motion-compiler",
  "motion-runtime",
  "preview-renderer",
  "remotion-renderer",
]) {
  const packageJson = JSON.parse(
    fs.readFileSync(
      path.join(repositoryRoot, "packages", packageName, "package.json"),
      "utf8",
    ),
  );
  if (packageJson.dependencies?.["@motionvideo/render-contracts"]) {
    violations.push(`${packageName} production dependency must not contain @motionvideo/render-contracts`);
  }
}

if (violations.length) {
  console.error("V2 renderer boundary failed:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log("V2 renderer boundary clean: preview and Remotion production code consume Runtime V2 only.");
