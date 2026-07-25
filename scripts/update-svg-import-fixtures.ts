import { readFileSync, mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertSafeSvgExport,
  importSvgExport,
  reconcileSvgReimport,
  SvgImportError,
} from "../packages/asset-registry/src/index.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(repoRoot, "docs/fixtures/v2");
const imports = resolve(root, "imports");

mkdirSync(resolve(imports, "expected-import"), { recursive: true });
mkdirSync(resolve(imports, "expected-reimport"), { recursive: true });
mkdirSync(resolve(root, "negative/imports"), { recursive: true });
copyFileSync(resolve(root, "assets/figma-export1.svg"), resolve(imports, "figma-cutout-source.svg"));
copyFileSync(
  resolve(root, "assets/adobe-illustrator-export-character.svg"),
  resolve(imports, "illustrator-cutout-source.svg"),
);

for (const [name, file] of [
  ["figma-cutout", "figma-cutout-source.svg"],
  ["illustrator-cutout", "illustrator-cutout-source.svg"],
] as const) {
  const svg = readFileSync(resolve(imports, file), "utf8");
  const result = importSvgExport(svg, { sourceId: name });
  const payload = {
    sourceFile: file,
    viewBox: result.viewBox,
    width: result.width,
    height: result.height,
    sourceIntegrity: result.sourceIntegrity,
    partCount: result.parts.length,
    elementCount: result.elements.length,
    parts: result.parts.map((part) => ({
      id: part.id,
      sourceElementIds: part.sourceElementIds,
      structuralFingerprint: part.structuralFingerprint,
      originalName: part.originalName,
    })),
  };
  writeFileSync(resolve(imports, "expected-import", `${name}.import.json`), `${JSON.stringify(payload, null, 2)}\n`);
  const again = importSvgExport(svg, { sourceId: name });
  const re = reconcileSvgReimport(
    result.parts.map((part, index) => ({
      id: part.id,
      structuralFingerprint: part.structuralFingerprint,
      nodeId: `node.${index}`,
    })),
    again.parts,
  );
  writeFileSync(
    resolve(imports, "expected-reimport", `${name}-reimport.json`),
    `${JSON.stringify({ keptCount: re.kept.length, conflictCount: re.conflicts.length, kept: re.kept, conflicts: re.conflicts }, null, 2)}\n`,
  );
}

writeFileSync(
  resolve(root, "negative/imports/svg-with-script.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><path d="M0 0h1v1z"/></svg>\n`,
);
writeFileSync(
  resolve(root, "negative/imports/svg-external-url.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.example/x.png" width="10" height="10"/></svg>\n`,
);
writeFileSync(
  resolve(root, "negative/imports/svg-malformed.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1v1z">\n`,
);

for (const [file, expectPath] of [
  ["svg-with-script.svg", "svg.script"],
  ["svg-external-url.svg", "svg.externalUrl"],
  ["svg-malformed.svg", "svg.root"],
] as const) {
  try {
    assertSafeSvgExport(readFileSync(resolve(root, "negative/imports", file), "utf8"));
    throw new Error(`expected reject ${file}`);
  } catch (error) {
    if (!(error instanceof SvgImportError) || error.path !== expectPath) throw error;
  }
}

console.log("wrote import fixtures");
