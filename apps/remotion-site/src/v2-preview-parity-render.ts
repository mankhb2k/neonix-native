/** Full Protocol V2 preview/export gate using the web preview lab fixtures. */
import { createServer, type Server } from "node:http";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { compileProtocolV2 } from "@motionvideo/motion-compiler";
import { evaluateRuntimeProjectV2, frameIndexAtTime, prepareRuntimeProjectV2Text } from "@motionvideo/motion-runtime";
import * as harfBuzz from "harfbuzzjs";
import { MotionProtocolV2Schema, type MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";
import { PREVIEW_LAB_CASES } from "../../../apps/web/lib/docs/preview-lab";
import { remotionWebpackOverride } from "./webpack-override";
import { countPixels, decodeRgbaPng, pixel } from "./png";

const SITE_ROOT = path.resolve(import.meta.dirname, "..");
const WEB_PUBLIC = path.resolve(SITE_ROOT, "../web/public");
const OUT_DIR = path.resolve(SITE_ROOT, "../../tmp/remotion-v2-preview-parity");
const BACKGROUND = [16, 24, 32] as const;

function isWithinRoot(file: string, root: string): boolean {
  const relative = path.relative(root, file);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function startAssetServer(): Promise<{ server: Server; baseUrl: string }> {
  return new Promise((resolve, reject) => {
    const server = createServer(async (request, response) => {
      try {
        const requestPath = decodeURIComponent(new URL(request.url ?? "/", "http://127.0.0.1").pathname);
        const file = path.resolve(WEB_PUBLIC, `.${requestPath}`);
        if (!isWithinRoot(file, WEB_PUBLIC)) { response.writeHead(403).end(); return; }
        const info = await stat(file);
        if (!info.isFile()) { response.writeHead(404).end(); return; }
        response.writeHead(200, {
          "Access-Control-Allow-Origin": "*",
          "Content-Length": info.size,
        });
        createReadStream(file).pipe(response);
      } catch { response.writeHead(404).end(); }
    });
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") { reject(new Error("Unable to start asset server")); return; }
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
    });
  });
}

function withServedAssetUris(project: MotionProtocolV2, baseUrl: string): MotionProtocolV2 {
  return {
    ...project,
    ...(project.assets ? { assets: project.assets.map((asset) => ({ ...asset, uri: `${baseUrl}${asset.uri}` })) } : {}),
  };
}

async function prepareRuntime(project: MotionProtocolV2): Promise<ReturnType<typeof compileProtocolV2>> {
  const runtime = compileProtocolV2(project);
  if (!runtime.nodes.some((node) => node.content.kind === "text")) return runtime;
  const fontBytes = new Map<string, Uint8Array>();
  for (const asset of project.assets ?? []) {
    if (asset.kind !== "font") continue;
    const uri = new URL(asset.uri);
    fontBytes.set(asset.id, await readFile(path.resolve(WEB_PUBLIC, `.${uri.pathname}`)));
  }
  const prepared = await prepareRuntimeProjectV2Text(runtime, async (font) => fontBytes.get(font.assetId) ?? null, async () => harfBuzz);
  const errors = prepared.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  if (errors.length) throw new Error(`Text preparation failed: ${errors.map((item) => item.code).join(", ")}`);
  return prepared.project;
}

function assertVisibleOutput(caseId: string, image: ReturnType<typeof decodeRgbaPng>): void {
  if (caseId === "primitive.shape.rectangle" && pixel(image, 48, 32).join(",") !== "0,170,136,255") throw new Error(`${caseId}: rectangle pixel mismatch`);
  if (caseId === "primitive.shape.ellipse" && pixel(image, 112, 72).join(",") !== "0,170,136,255") throw new Error(`${caseId}: ellipse pixel mismatch`);
  if (caseId === "text.single-line.alignment" && countPixels(image, (value) => value[0] > 210 && value[1] > 210 && value[2] > 210) < 1_000) throw new Error(`${caseId}: glyph output is too small`);
  if (caseId === "composite.mask.clip") {
    if (pixel(image, 960, 540).join(",") === "16,24,32,255") throw new Error(`${caseId}: covered image pixel is missing`);
    if (pixel(image, 500, 220).join(",") !== "16,24,32,255") throw new Error(`${caseId}: uncovered image pixel escaped the clip`);
  }
  if (caseId === "composite.mask.alpha") {
    if (pixel(image, 960, 540).join(",") === "16,24,32,255") throw new Error(`${caseId}: alpha-covered image pixel is missing`);
    if (pixel(image, 500, 220).join(",") !== "16,24,32,255") throw new Error(`${caseId}: uncovered image pixel escaped the alpha mask`);
  }
  if (caseId === "composite.mask.inverse-alpha") {
    if (pixel(image, 960, 540).join(",") !== "16,24,32,255") throw new Error(`${caseId}: opaque inverse-mask center did not clear content`);
    if (pixel(image, 500, 220).join(",") === "16,24,32,255") throw new Error(`${caseId}: inverse-mask outside image pixel is missing`);
  }
  if (caseId === "composite.mask.luma") {
    if (pixel(image, 960, 540).join(",") === "16,24,32,255") throw new Error(`${caseId}: luma-covered image pixel is missing`);
    if (pixel(image, 500, 220).join(",") !== "16,24,32,255") throw new Error(`${caseId}: uncovered image pixel escaped the luma mask`);
  }
  if (caseId === "group.isolation.nested") {
    const overlap = pixel(image, 800, 540);
    const frontOnly = pixel(image, 1100, 540);
    if (overlap.some((value, index) => Math.abs(value - frontOnly[index]!) > 2)) throw new Error(`${caseId}: nested opacity was applied per child`);
  }
  if (caseId === "composite.mask.nested") {
    if (pixel(image, 960, 540).join(",") === "16,24,32,255") throw new Error(`${caseId}: nested masked content is missing`);
    if (pixel(image, 500, 220).join(",") !== "16,24,32,255") throw new Error(`${caseId}: nested mask escaped its group`);
  }
  if (caseId === "image.missing-asset") return;
  const backgroundPixels = countPixels(image, (value) => value[0] === BACKGROUND[0] && value[1] === BACKGROUND[1] && value[2] === BACKGROUND[2]);
  if (backgroundPixels === image.width * image.height && caseId !== "matrix4.camera-plane") throw new Error(`${caseId}: output is only the background`);
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const assets = await startAssetServer();
  try {
    const serveUrl = await bundle({ entryPoint: path.join(SITE_ROOT, "src/index.ts"), webpackOverride: remotionWebpackOverride });
    let rendered = 0;
    for (const fixture of PREVIEW_LAB_CASES) {
      const project = MotionProtocolV2Schema.parse(withServedAssetUris(fixture.project, assets.baseUrl));
      const runtime = await prepareRuntime(project);
      const previewTime = fixture.previewTime ?? 0;
      const frameIndex = frameIndexAtTime(previewTime, project.composition.fps);
      const frame = evaluateRuntimeProjectV2(runtime, frameIndex, { time: previewTime });
      const drawable = frame.commands.some((command) => command.op.startsWith("draw"));
      if (!drawable && fixture.id !== "matrix4.camera-plane" && fixture.id !== "image.missing-asset") throw new Error(`${fixture.id}: no drawable command`);
      const composition = await selectComposition({ serveUrl, id: "MotiClipVideo", inputProps: { runtime } });
      const output = path.join(OUT_DIR, `${fixture.id.replaceAll(".", "-")}.png`);
      await renderStill({ chromiumOptions: { gl: "angle" }, composition, frame: frameIndex, inputProps: { runtime }, output, serveUrl });
      const info = await stat(output);
      if (info.size < 1_000) throw new Error(`${fixture.id}: PNG is unexpectedly small`);
      assertVisibleOutput(fixture.id, decodeRgbaPng(await readFile(output)));
      rendered += 1;
      console.log(`[e2e] ${fixture.id} -> ${output}`);
    }
    console.log(`[e2e] Remotion V2 parity passed for ${rendered}/${PREVIEW_LAB_CASES.length} preview fixtures`);
  } finally {
    await new Promise<void>((resolve, reject) => assets.server.close((error) => error ? reject(error) : resolve()));
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
