import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compileProtocol } from "@motionvideo/motion-compiler";
import { prepareRuntimeProjectV3Text } from "@motionvideo/motion-runtime";
import { encodeRgbaToPng, rasterizeSvgToRgba, renderOneFrameToSvg } from "@motionvideo/render-native";
import { PREVIEW_LAB_CASES } from "../lib/docs/preview-lab";
import { PATH_RENDERING_FIXTURES } from "../lib/docs/path-rendering-fixtures";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(appRoot, "../..");
const outputDir = path.join(repoRoot, "tmp", "emoji-export");
const width = 1920;
const height = 1080;

async function loadFont(uri: string): Promise<Buffer | null> {
  try { return await readFile(path.join(appRoot, "public", uri.replace(/^\/+/, ""))); }
  catch { return null; }
}

async function prepare(project: Parameters<typeof compileProtocol>[0]) {
  const compiled = compileProtocol(project);
  const harfbuzz = await import(pathToFileURL(path.join(appRoot, "node_modules/harfbuzzjs/dist/index.mjs")).href) as typeof import("harfbuzzjs");
  const prepared = await prepareRuntimeProjectV3Text(compiled, (font) => loadFont(font.uri), () => Promise.resolve(harfbuzz));
  const errors = prepared.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  if (errors.length) throw new Error(errors.map((diagnostic) => diagnostic.message).join(" | "));
  return prepared.project;
}

async function exportCase(caseId: string, fileName: string) {
  const fixture = PREVIEW_LAB_CASES.find((item) => item.id === caseId)
    ?? PATH_RENDERING_FIXTURES.find((item) => item.id === caseId);
  if (!fixture) throw new Error(`Preview case not found: ${caseId}`);
  const project = await prepare(fixture.project);
  const rendered = renderOneFrameToSvg(project, 0);
  const rgba = await rasterizeSvgToRgba(rendered.svg, width, height);
  const png = await encodeRgbaToPng(rgba, width, height);
  const svgPath = path.join(outputDir, `${fileName}.svg`);
  const pngPath = path.join(outputDir, `${fileName}.png`);
  await writeFile(svgPath, rendered.svg, "utf8");
  await writeFile(pngPath, png);
  const colorGlyphs = rendered.commands.commands
    .filter((command): command is Extract<typeof command, { op: "drawText" }> => command.op === "drawText")
    .flatMap((command) => command.glyphs ?? [])
    .filter((glyph) => glyph.colorGlyph)
    .map((glyph) => ({ glyphId: glyph.glyphId, renderMode: glyph.renderMode, source: glyph.colorGlyph?.kind, mimeType: glyph.colorGlyph?.kind === "bitmap" ? glyph.colorGlyph.mimeType : undefined, sourceBytes: glyph.colorGlyph?.kind === "bitmap" ? glyph.colorGlyph.bytes.byteLength : undefined }));
  const glyphs = rendered.commands.commands
    .filter((command): command is Extract<typeof command, { op: "drawText" }> => command.op === "drawText")
    .flatMap((command) => command.glyphs ?? [])
    .slice(0, 3)
    .map((glyph) => ({ glyphId: glyph.glyphId, x: glyph.x, y: glyph.y, width: glyph.width, height: glyph.height, outline: glyph.outline }));
  return { caseId, svgPath, pngPath, bytes: png.byteLength, colorGlyphs, glyphs };
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const results = [
    await exportCase("text.emoji-fallback", "export-emoji-fallback"),
    await exportCase("text.emoji-only", "export-emoji-only"),
    await exportCase("text-ligature-emoji", "export-debug-emoji-fallback"),
  ];
  console.log(JSON.stringify({ width, height, results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
