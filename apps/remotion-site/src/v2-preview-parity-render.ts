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
const AUDIO_FIXTURE = path.resolve(SITE_ROOT, "../../assets/music/Music-MBB-Island-Tropical_128k.mp3");
const OUT_DIR = path.resolve(SITE_ROOT, "../../tmp/remotion-v2-preview-parity");
const BACKGROUND = [16, 24, 32] as const;

function isWithinRoot(file: string, root: string): boolean {
  const relative = path.relative(root, file);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function mediaContentType(file: string): string {
  const extension = path.extname(file).toLowerCase();
  return {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".aac": "audio/aac",
    ".ogg": "audio/ogg",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
  }[extension] ?? "application/octet-stream";
}

function parseByteRange(value: string | undefined, size: number): { start: number; end: number } | null {
  if (!value?.startsWith("bytes=")) return null;
  const [range] = value.slice("bytes=".length).split(",", 1);
  const [startText, endText] = range?.split("-", 2) ?? [];
  const start = Number(startText);
  const end = endText ? Number(endText) : size - 1;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= size) return null;
  return { start, end: Math.min(end, size - 1) };
}

function startAssetServer(): Promise<{ server: Server; baseUrl: string }> {
  return new Promise((resolve, reject) => {
    const server = createServer(async (request, response) => {
      try {
        if (request.method === "OPTIONS") {
          response.writeHead(204, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
            "Access-Control-Allow-Headers": "Range, Content-Type",
            "Access-Control-Max-Age": "3600",
          }).end();
          return;
        }
        const requestPath = decodeURIComponent(new URL(request.url ?? "/", "http://127.0.0.1").pathname);
        const file = requestPath === "/api/docs/audio"
          ? AUDIO_FIXTURE
          : path.resolve(WEB_PUBLIC, `.${requestPath}`);
        if (requestPath !== "/api/docs/audio" && !isWithinRoot(file, WEB_PUBLIC)) {
          response.writeHead(403).end();
          return;
        }
        const info = await stat(file);
        if (!info.isFile()) { response.writeHead(404).end(); return; }
        const range = parseByteRange(request.headers.range, info.size);
        const headers = {
          "Access-Control-Allow-Origin": "*",
          "Accept-Ranges": "bytes",
          "Content-Type": mediaContentType(file),
          ...(range
            ? {
                "Content-Length": range.end - range.start + 1,
                "Content-Range": `bytes ${range.start}-${range.end}/${info.size}`,
              }
            : { "Content-Length": info.size }),
        };
        const status = range ? 206 : 200;
        response.writeHead(status, headers);
        if (request.method === "HEAD") {
          response.end();
          return;
        }
        createReadStream(file, range ? { start: range.start, end: range.end } : undefined).pipe(response);
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
      const visualFixture = !fixture.audioFixture;
      if (!drawable && visualFixture && fixture.id !== "matrix4.camera-plane" && fixture.id !== "image.missing-asset") throw new Error(`${fixture.id}: no drawable command`);
      const composition = await selectComposition({ serveUrl, id: "MotiClipVideo", inputProps: { runtime } });
      const output = path.join(OUT_DIR, `${fixture.id.replaceAll(".", "-")}.png`);
      await renderStill({ chromiumOptions: { gl: "angle" }, composition, frame: frameIndex, inputProps: { runtime }, output, serveUrl });
      const info = await stat(output);
      if (info.size < 1_000) throw new Error(`${fixture.id}: PNG is unexpectedly small`);
      if (visualFixture) assertVisibleOutput(fixture.id, decodeRgbaPng(await readFile(output)));
      rendered += 1;
      console.log(`[e2e] ${fixture.id} -> ${output}`);
    }
    console.log(`[e2e] Remotion V2 parity passed for ${rendered}/${PREVIEW_LAB_CASES.length} preview fixtures`);
  } finally {
    await new Promise<void>((resolve, reject) => assets.server.close((error) => error ? reject(error) : resolve()));
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
