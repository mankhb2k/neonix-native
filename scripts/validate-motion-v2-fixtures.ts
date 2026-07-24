import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { GlobalFonts } from "@napi-rs/canvas";

import {
  parseMotionComponentV2,
  parseMotionProjectV2,
  MotionPatchSchema,
} from "../packages/motion-schema/src/index";
import { compileMotionProject } from "../apps/render-worker/src/compiler/index";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixturesRoot = resolve(repoRoot, "docs", "fixtures", "v2");
const assetsRoot = resolve(fixturesRoot, "assets");
const require = createRequire(import.meta.url);

type AssetManifestEntry = {
  path: string;
  kind: "audio" | "font" | "image" | "svg" | "video";
  bytes: number;
  sha256: string;
  codec?: string;
  pixelFormat?: string;
  duration?: number;
  width?: number;
  height?: number;
  fps?: number;
  hasAudio?: boolean;
  audioCodec?: string;
  sampleRate?: number;
  channels?: number;
  family?: string;
  style?: string;
  localeCoverage?: string;
  viewBox?: string;
  expectedGroups?: number;
  expectedPaths?: number;
  expectedMasks?: number;
};

type AssetManifest = {
  manifestVersion: number;
  usage: { status: string };
  assets: AssetManifestEntry[];
};

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

function parseDuration(probe: string): number | undefined {
  const match = probe.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
  if (!match) return undefined;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

function expectProbe(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Asset probe failed: ${message}`);
}

function probeAsset(path: string, entry: AssetManifestEntry): void {
  if (entry.kind === "font") {
    expectProbe(GlobalFonts.registerFromPath(path, `${entry.family ?? "Fixture"}-${entry.style ?? "Regular"}`), `${entry.path} font registration`);
    return;
  }
  if (entry.kind === "svg") return;

  const ffmpeg = require("ffmpeg-static") as string | null;
  if (!ffmpeg) throw new Error("ffmpeg-static binary missing");
  const result = spawnSync(ffmpeg, ["-hide_banner", "-i", path], { encoding: "utf8" });
  const output = result.stderr ?? "";
  const streamKind = entry.kind === "audio" ? "Audio" : "Video";
  expectProbe(output.includes(`${streamKind}: ${entry.codec}`), `${entry.path} codec ${entry.codec}`);
  if (entry.pixelFormat) expectProbe(output.includes(entry.pixelFormat), `${entry.path} pixel format ${entry.pixelFormat}`);
  if (entry.width && entry.height) expectProbe(output.includes(`${entry.width}x${entry.height}`), `${entry.path} dimensions ${entry.width}x${entry.height}`);
  if (entry.duration !== undefined) {
    const duration = parseDuration(output);
    expectProbe(duration !== undefined && Math.abs(duration - entry.duration) <= 0.06, `${entry.path} duration ${entry.duration}`);
  }
  if (entry.fps) expectProbe(output.includes(`${entry.fps} fps`), `${entry.path} fps ${entry.fps}`);
  if (entry.sampleRate) expectProbe(output.includes(`${entry.sampleRate} Hz`), `${entry.path} sample rate ${entry.sampleRate}`);
  if (entry.channels) {
    const channelsMatch = entry.channels === 1
      ? output.includes("mono")
      : entry.channels === 2
        ? /(stereo|2 channels)/.test(output)
        : output.includes(`${entry.channels} channels`);
    expectProbe(channelsMatch, `${entry.path} channels ${entry.channels}`);
  }
  if (entry.hasAudio !== undefined) expectProbe(/Audio:/.test(output) === entry.hasAudio, `${entry.path} hasAudio=${entry.hasAudio}`);
  if (entry.audioCodec) expectProbe(output.includes(`Audio: ${entry.audioCodec}`), `${entry.path} audio codec ${entry.audioCodec}`);
}

function collectAssetReferences(value: unknown, references: Array<{ uri: string; integrity?: string }>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectAssetReferences(item, references);
    return;
  }
  if (value === null || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  for (const [key, nested] of Object.entries(record)) {
    if ((key === "uri" || key === "thumbnail") && typeof nested === "string" && nested.startsWith("assets/")) {
      references.push({ uri: nested, integrity: typeof record.integrity === "string" ? record.integrity : undefined });
    }
    collectAssetReferences(nested, references);
  }
}

async function validateAssetKit(): Promise<number> {
  const manifest = await readJson(resolve(assetsRoot, "manifest.json")) as AssetManifest;
  if (manifest.manifestVersion !== 1 || manifest.usage.status !== "approved-by-project-owner") {
    throw new Error("Fixture asset manifest is missing version or usage approval");
  }
  const manifestByPath = new Map(manifest.assets.map((entry) => [entry.path, entry]));
  const files = (await readdir(assetsRoot)).filter((file) => file !== "manifest.json").sort();
  if (files.length !== manifest.assets.length || files.some((file) => !manifestByPath.has(file))) {
    throw new Error("Asset directory and manifest entries differ");
  }
  for (const entry of manifest.assets) {
    const path = resolve(assetsRoot, entry.path);
    const relativePath = relative(assetsRoot, path);
    if (relativePath.startsWith("..") || isAbsolute(relativePath)) throw new Error(`Unsafe asset path: ${entry.path}`);
    const info = await stat(path);
    if (info.size !== entry.bytes) throw new Error(`Asset size changed: ${entry.path}`);
    const bytes = await readFile(path);
    const hash = createHash("sha256").update(bytes).digest("hex");
    if (hash !== entry.sha256) throw new Error(`Asset hash changed: ${entry.path}`);
    if (entry.kind === "svg") {
      const svg = bytes.toString("utf8");
      expectProbe(svg.includes("<svg") && (!entry.width || svg.includes(`width=\"${entry.width}\"`)) && (!entry.height || svg.includes(`height=\"${entry.height}\"`)), `${entry.path} SVG metadata`);
      expectProbe(!/<script\b|\bjavascript:|\bon\w+\s*=|<foreignObject\b/i.test(svg), `${entry.path} SVG executable content`);
      expectProbe(!/(?:href|xlink:href)\s*=\s*["'](?:https?:)?\/\//i.test(svg), `${entry.path} SVG external reference`);
      if (entry.viewBox) expectProbe(svg.includes(`viewBox=\"${entry.viewBox}\"`), `${entry.path} SVG viewBox`);
      if (entry.expectedGroups !== undefined) expectProbe((svg.match(/<g\b/gi) ?? []).length === entry.expectedGroups, `${entry.path} SVG group count`);
      if (entry.expectedPaths !== undefined) expectProbe((svg.match(/<path\b/gi) ?? []).length === entry.expectedPaths, `${entry.path} SVG path count`);
      if (entry.expectedMasks !== undefined) expectProbe((svg.match(/<mask\b/gi) ?? []).length === entry.expectedMasks, `${entry.path} SVG mask count`);
    }
    probeAsset(path, entry);
  }

  const references: Array<{ uri: string; integrity?: string }> = [];
  for (const directory of ["components", "projects", "imports"] as const) {
    const root = resolve(fixturesRoot, directory);
    for (const file of (await readdir(root)).filter((name) => name.endsWith(".json"))) {
      collectAssetReferences(await readJson(resolve(root, file)), references);
    }
  }
  for (const reference of references) {
    const relative = reference.uri.slice("assets/".length);
    const entry = manifestByPath.get(relative);
    if (!entry) throw new Error(`Fixture references an unmanifested asset: ${reference.uri}`);
    if (reference.integrity && reference.integrity !== `sha256-${entry.sha256}`) {
      throw new Error(`Fixture integrity mismatch: ${reference.uri}`);
    }
  }
  const referencedPaths = new Set(references.map((reference) => reference.uri.slice("assets/".length)));
  const unused = manifest.assets.filter((entry) => !referencedPaths.has(entry.path));
  if (unused.length > 0) throw new Error(`Manifest assets are not covered by a fixture: ${unused.map((entry) => entry.path).join(", ")}`);
  console.log(`OK assets/${manifest.assets.length} files hashed, probed and referenced safely`);
  return manifest.assets.length;
}

async function validateDirectory(
  directory: "components" | "projects",
  parse: (input: unknown) => unknown,
): Promise<number> {
  const root = resolve(fixturesRoot, directory);
  const files = (await readdir(root)).filter((file) => file.endsWith(".json")).sort();
  for (const file of files) {
    parse(await readJson(resolve(root, file)));
    console.log(`OK ${directory}/${file}`);
  }
  return files.length;
}

async function main(): Promise<void> {
  await validateAssetKit();
  const componentCount = await validateDirectory("components", parseMotionComponentV2);
  const projectCount = await validateDirectory("projects", parseMotionProjectV2);
  MotionPatchSchema.parse(await readJson(resolve(fixturesRoot, "patches", "ai-fill-big-number.json")));
  console.log(`OK patches/ai-fill-big-number.json`);

  const brokenComponent = await readJson(resolve(fixturesRoot, "components", "big-number.mvc.json")) as {
    nodes: Array<{ parentId: string | null }>;
  };
  brokenComponent.nodes[1].parentId = "missing-parent";
  let rejectedBrokenParent = false;
  try { parseMotionComponentV2(brokenComponent); } catch { rejectedBrokenParent = true; }
  if (!rejectedBrokenParent) throw new Error("Reference validator accepted a missing parent");
  console.log("OK negative/missing-parent rejected");

  const brokenProject = await readJson(resolve(fixturesRoot, "projects", "big-number-demo.mt.json")) as {
    dependencies: { components: unknown[] };
  };
  brokenProject.dependencies.components = [];
  let rejectedMissingDependency = false;
  try { parseMotionProjectV2(brokenProject); } catch { rejectedMissingDependency = true; }
  if (!rejectedMissingDependency) throw new Error("Reference validator accepted an unpinned component");
  console.log("OK negative/unpinned-component rejected");

  const componentFiles = (await readdir(resolve(fixturesRoot, "components"))).filter((file) => file.endsWith(".json"));
  const components = await Promise.all(componentFiles.map(async (file) => parseMotionComponentV2(await readJson(resolve(fixturesRoot, "components", file)))));
  const mediaProject = parseMotionProjectV2(await readJson(resolve(fixturesRoot, "projects", "media-assets.mt.json")));
  const mediaRuntime = compileMotionProject(mediaProject);
  const mediaNodeTypes = new Set(mediaRuntime.scenes.flatMap((scene) => scene.nodes.map((node) => node.type)));
  for (const type of ["camera", "image", "svg", "text", "video"] as const) {
    if (!mediaNodeTypes.has(type)) throw new Error(`Media compiler fixture lost ${type} node`);
  }
  if (mediaRuntime.assets.length !== 11) throw new Error(`Expected 11 runtime assets, got ${mediaRuntime.assets.length}`);
  const audioRoles = new Set(mediaRuntime.timeline.audioTracks.map((track) => track.role));
  for (const role of ["bgm", "voiceover", "sfx"] as const) {
    if (!audioRoles.has(role)) throw new Error(`Media compiler fixture lost ${role} audio track`);
  }
  const vietnamese = mediaRuntime.scenes[0]?.nodes.find((node) => node.id === "text.vietnamese");
  if (vietnamese?.payload?.text !== "Tiếng Việt: Đặng Thị Hồng – 49.000₫") throw new Error("Vietnamese text did not survive compilation");
  console.log("OK compiler/media assets, node types, audio roles and Vietnamese text preserved");

  const golden = parseMotionProjectV2(await readJson(resolve(fixturesRoot, "projects", "golden-product-promo.mt.json")));
  const goldenRuntime = compileMotionProject(golden, { components });
  if (goldenRuntime.scenes.some((scene) => scene.nodes.some((node) => node.type === "component"))) {
    throw new Error("Compiler leaked a Component Node into Runtime IR");
  }
  console.log("OK compiler/golden components expanded");

  const demo = await readJson(resolve(fixturesRoot, "projects", "big-number-demo.mt.json")) as Record<string, unknown>;
  const timelineComponent = components.find((component) => component.componentId === "comp.timeline-steps");
  if (!timelineComponent) throw new Error("Timeline component fixture missing");
  const repeatProject = structuredClone(demo) as {
    dependencies: { components: Array<Record<string, unknown>> };
    scenes: Array<{ nodes: Array<{ type: string; payload?: Record<string, unknown> }> }>;
    bindings: unknown[];
  };
  repeatProject.dependencies.components = [{
    componentId: timelineComponent.componentId,
    version: timelineComponent.componentVersion,
    source: "registry.main",
    integrity: "sha256-fixture-timeline-steps-1.0.0",
  }];
  const instance = repeatProject.scenes[0]!.nodes.find((node) => node.type === "component")!;
  instance.payload = { componentId: timelineComponent.componentId, componentVersion: timelineComponent.componentVersion, props: {} };
  repeatProject.bindings = [];
  const repeatRuntime = compileMotionProject(parseMotionProjectV2(repeatProject), { components });
  const repeatedTitles = repeatRuntime.scenes[0]!.nodes.filter((node) => node.id.includes("step-title::"));
  if (repeatedTitles.length !== 3) throw new Error(`Expected 3 repeated step titles, got ${repeatedTitles.length}`);
  console.log("OK compiler/repeater expanded 3 items");

  console.log(`Validated ${componentCount + projectCount + 1} Motion Format v2 fixtures.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
