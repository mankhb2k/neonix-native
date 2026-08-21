import fs from "node:fs";
import path from "node:path";

const repositoryRoot = process.cwd();

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
  return walk(directory).filter((file) => {
    const rel = relative(file);
    return !/(?:__tests__|\.test\.)/.test(rel);
  });
}

const violations = [];
const certifiedRuntimeFiles = productionFiles(
  path.join(repositoryRoot, "packages", "motion-runtime", "src"),
).filter((file) => {
  const rel = relative(file);
  return ![
    "packages/motion-runtime/src/matrix.ts",
    "packages/motion-runtime/src/paint/evaluated-geometry.ts",
    "packages/motion-runtime/src/paint/replay-2d.ts",
  ].includes(rel);
});
const previewFiles = productionFiles(
  path.join(repositoryRoot, "packages", "preview-renderer", "src"),
);
const remotionFiles = productionFiles(
  path.join(repositoryRoot, "packages", "remotion-renderer", "src"),
);
const compilerV2Files = productionFiles(
  path.join(repositoryRoot, "packages", "motion-compiler", "src", "compile-v2"),
);

function checkFiles(files, rules) {
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    for (const rule of rules) {
      if (rule.pattern.test(source)) violations.push(`${relative(file)}: ${rule.label}`);
    }
  }
}

const matrix4OnlyRules = [
  { pattern: /\bMatrix2D\b|\bTransform2D\b|\bmatrix2D\b/, label: "2D matrix contract marker" },
  { pattern: /matrixToCssTransform|localTransformMatrix\s*\(/, label: "legacy transform helper" },
  { pattern: /matrix4\s*\?\s*:/, label: "optional Matrix4 field" },
  { pattern: /anchorZ\s*\*\s*0/, label: "discarded anchor Z" },
  { pattern: /new\s+Float(?:32|64)Array\s*\(\s*16\s*\)/, label: "unvalidated partial Matrix4 allocation" },
];
const rendererMatrixRules = matrix4OnlyRules.filter(
  (rule) => rule.label !== "unvalidated partial Matrix4 allocation",
);
const runtimeMatrixRules = matrix4OnlyRules.filter(
  (rule) => rule.label !== "unvalidated partial Matrix4 allocation",
);
const partialMatrixRule = matrix4OnlyRules.find(
  (rule) => rule.label === "unvalidated partial Matrix4 allocation",
);
const runtimeNonMatrix4Files = certifiedRuntimeFiles.filter(
  (file) => relative(file) !== "packages/motion-runtime/src/matrix4.ts",
);

checkFiles(certifiedRuntimeFiles, runtimeMatrixRules);
if (partialMatrixRule) {
  checkFiles(runtimeNonMatrix4Files, [partialMatrixRule]);
  checkFiles(compilerV2Files, [partialMatrixRule]);
}
checkFiles(compilerV2Files, matrix4OnlyRules);
checkFiles(previewFiles, [
  ...rendererMatrixRules,
  {
    pattern: /\b(?:translationMatrix3D|rotationMatrixX|rotationMatrixY|rotationMatrixZ|scaleMatrix3D|skewMatrix3D|multiplyMatrix4|localTransformMatrix3D)\b/,
    label: "renderer-side semantic transform composition",
  },
]);
checkFiles(remotionFiles, [
  ...rendererMatrixRules,
  { pattern: /\bmatrix(?:3d)?\s*\(/i, label: "CSS matrix transform" },
  {
    pattern: /\b(?:translationMatrix3D|rotationMatrixX|rotationMatrixY|rotationMatrixZ|scaleMatrix3D|skewMatrix3D|multiplyMatrix4|localTransformMatrix3D)\b/,
    label: "renderer-side semantic transform composition",
  },
]);

const runtimeIndex = fs.readFileSync(
  path.join(repositoryRoot, "packages", "motion-runtime", "src", "index.ts"),
  "utf8",
);
for (const legacyExport of [
  'export * from "./matrix"',
  'export * from "./paint"',
]) {
  if (runtimeIndex.includes(legacyExport)) {
    violations.push(`packages/motion-runtime/src/index.ts: legacy public export ${legacyExport}`);
  }
}

const paintCommand = fs.readFileSync(
  path.join(repositoryRoot, "packages", "motion-runtime", "src", "paint", "paint-command.ts"),
  "utf8",
);
if (!/matrix4\s*:\s*number\[\]/.test(paintCommand)) {
  violations.push("paint-command.ts: Runtime V2 setTransform must require matrix4: number[]");
}

if (violations.length) {
  console.error("V2 Matrix4 hard-lock failed:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(
  "V2 Matrix4 hard-lock clean: Runtime, preview, Remotion, and Compiler V2 keep the certified boundary.",
);
