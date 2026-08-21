import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const corePackages = [
  "motion-protocol",
  "motion-compiler",
  "motion-runtime",
  "preview-renderer",
  "remotion-renderer",
];

const packageRules = {
  "motion-protocol": {
    dependencies: new Set(["zod"]),
    exports: new Set([".", "./v2"]),
    forbiddenImports: [],
  },
  "motion-compiler": {
    dependencies: new Set([
      "@motionvideo/motion-protocol",
      "@motionvideo/motion-runtime",
    ]),
    exports: new Set([".", "./testing"]),
    forbiddenImports: ["@motionvideo/render-contracts"],
  },
  "motion-runtime": {
    dependencies: new Set(),
    exports: new Set(["."]),
    forbiddenImports: [
      "@motionvideo/motion-protocol",
      "@motionvideo/motion-compiler",
      "@motionvideo/render-contracts",
    ],
  },
  "preview-renderer": {
    dependencies: new Set(["@motionvideo/motion-runtime"]),
    exports: new Set(["."]),
    forbiddenImports: [
      "@motionvideo/motion-protocol",
      "@motionvideo/motion-compiler",
      "@motionvideo/render-contracts",
    ],
  },
  "remotion-renderer": {
    dependencies: new Set([
      "@motionvideo/motion-runtime",
      "@motionvideo/preview-renderer",
      "remotion",
    ]),
    exports: new Set(["."]),
    forbiddenImports: [
      "@motionvideo/motion-protocol",
      "@motionvideo/motion-compiler",
      "@motionvideo/render-contracts",
    ],
  },
};

const forbiddenTokens = [
  { pattern: /\b(?:V1|v1)\b/, label: "V1 marker" },
  { pattern: /formatVersion\s*[:=]\s*1\b/, label: "V1 format marker" },
  { pattern: /motion-protocol[\\/]v1/, label: "Protocol V1 import" },
  { pattern: /@motionvideo[\\/]motion-protocol[\\/]runtime/, label: "legacy Protocol runtime import" },
  {
    pattern: /\b(?:MotionProjectV1|MotionProjectSchema|parseMotionProjectV1|serializeMotionProjectV1|compileMotionProjectV1|evaluateCompositionFrameV1)\b/,
    label: "retired V1 API",
  },
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function walkProductionSource(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "testing" || entry.name === "__tests__") continue;
      files.push(...walkProductionSource(file));
    } else if (
      /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/.test(entry.name) &&
      !/\.test\./.test(entry.name)
    ) {
      files.push(file);
    }
  }
  return files;
}

function relative(file) {
  return path.relative(root, file).split(path.sep).join("/");
}

const violations = [];

for (const packageName of corePackages) {
  const packageRoot = path.join(root, "packages", packageName);
  const packageJson = readJson(path.join(packageRoot, "package.json"));
  const rule = packageRules[packageName];
  const dependencies = Object.keys(packageJson.dependencies ?? {});
  const expectedDependencies = [...rule.dependencies].sort();
  if (JSON.stringify(dependencies.sort()) !== JSON.stringify(expectedDependencies)) {
    violations.push(
      `${packageName}: production dependency direction mismatch (${dependencies.join(", ") || "none"})`,
    );
  }

  const exports = Object.keys(packageJson.exports ?? {}).sort();
  const expectedExports = [...rule.exports].sort();
  if (JSON.stringify(exports) !== JSON.stringify(expectedExports)) {
    violations.push(
      `${packageName}: public exports mismatch (${exports.join(", ") || "none"})`,
    );
  }

  for (const file of walkProductionSource(path.join(packageRoot, "src"))) {
    const source = fs.readFileSync(file, "utf8");
    const fileName = relative(file);
    for (const token of forbiddenTokens) {
      if (token.pattern.test(source)) violations.push(`${fileName}: ${token.label}`);
    }
    for (const importName of rule.forbiddenImports) {
      if (source.includes(importName)) {
        violations.push(`${fileName}: forbidden import ${importName}`);
      }
    }
  }
}

const protocolRoot = path.join(root, "packages", "motion-protocol");
for (const retiredPath of [
  "src/v1",
  "src/runtime",
  "schema/v1.json",
]) {
  if (fs.existsSync(path.join(protocolRoot, retiredPath))) {
    violations.push(`motion-protocol: retired path still exists: ${retiredPath}`);
  }
}
const schemaFiles = fs
  .readdirSync(path.join(protocolRoot, "schema"))
  .filter((file) => file.endsWith(".json"));
if (JSON.stringify(schemaFiles) !== JSON.stringify(["v2.json"])) {
  violations.push(`motion-protocol: schema directory must contain only v2.json`);
}

if (violations.length) {
  console.error("V2 core boundary failed:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log("V2 core boundary clean: source, dependencies, exports and schema are V2-only.");
