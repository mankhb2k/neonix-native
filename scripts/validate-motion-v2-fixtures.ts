import { createHash } from "node:crypto";
import { deepStrictEqual } from "node:assert";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { GlobalFonts } from "@napi-rs/canvas";

import {
  parseMotionComponentV2,
  parseMotionProjectV2,
  MOTION_V2_LIMITS,
  MotionPatchSchema,
  MotionV2ReferenceError,
} from "../packages/motion-schema/src/index";
import { compileMotionProject } from "../apps/render-worker/src/compiler/index";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixturesRoot = resolve(repoRoot, "docs", "fixtures", "v2");
const assetsRoot = resolve(fixturesRoot, "assets");

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

type LimitCase = {
  id: string;
  target: "component.nodes" | "component.clips" | "project.scenes" | "scene.nodes" | "scene.clips" | "clip.tracks" | "track.keys" | "variable.listItems" | "hierarchy.depth";
  limit: keyof typeof MOTION_V2_LIMITS;
  expectedPath: string;
};

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
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

  const result = spawnSync("ffprobe", [
    "-v", "error",
    "-show_entries", "stream=codec_name,codec_type,width,height,duration,sample_rate,channels,pix_fmt,r_frame_rate:format=duration",
    "-of", "json",
    path,
  ], { encoding: "utf8" });
  expectProbe(result.status === 0, `${entry.path} ffprobe (${result.stderr?.trim() || "not available"})`);
  const probe = JSON.parse(result.stdout) as {
    streams: Array<Record<string, string | number>>;
    format?: { duration?: string };
  };
  const primaryKind = entry.kind === "audio" ? "audio" : "video";
  const primary = probe.streams.find((stream) => stream.codec_type === primaryKind);
  const audio = probe.streams.find((stream) => stream.codec_type === "audio");
  expectProbe(primary?.codec_name === entry.codec, `${entry.path} codec ${entry.codec}`);
  if (entry.pixelFormat) expectProbe(primary?.pix_fmt === entry.pixelFormat, `${entry.path} pixel format ${entry.pixelFormat}`);
  if (entry.width && entry.height) expectProbe(primary?.width === entry.width && primary.height === entry.height, `${entry.path} dimensions ${entry.width}x${entry.height}`);
  if (entry.duration !== undefined) {
    const duration = Number(primary?.duration ?? probe.format?.duration);
    expectProbe(duration !== undefined && Math.abs(duration - entry.duration) <= 0.06, `${entry.path} duration ${entry.duration}`);
  }
  if (entry.fps) {
    const [numerator, denominator = "1"] = String(primary?.r_frame_rate ?? "0/1").split("/");
    expectProbe(Math.abs(Number(numerator) / Number(denominator) - entry.fps) < 0.01, `${entry.path} fps ${entry.fps}`);
  }
  if (entry.sampleRate) expectProbe(Number(audio?.sample_rate) === entry.sampleRate, `${entry.path} sample rate ${entry.sampleRate}`);
  if (entry.channels) expectProbe(audio?.channels === entry.channels, `${entry.path} channels ${entry.channels}`);
  if (entry.hasAudio !== undefined) expectProbe(Boolean(audio) === entry.hasAudio, `${entry.path} hasAudio=${entry.hasAudio}`);
  if (entry.audioCodec) expectProbe(audio?.codec_name === entry.audioCodec, `${entry.path} audio codec ${entry.audioCodec}`);
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

async function validateNegativeFixtures(): Promise<number> {
  const cases = [
    {
      file: "components/missing-parent.mvc.json",
      parse: parseMotionComponentV2,
      path: "nodes.child.parentId",
      message: "Unknown parent: missing-parent",
    },
    {
      file: "components/unsupported-property.mvc.json",
      parse: parseMotionComponentV2,
      path: "clips.bad-track.source.tracks.payload.magic",
      message: "Unsupported property for text: payload.magic",
    },
    {
      file: "components/duplicate-key-time.mvc.json",
      parse: parseMotionComponentV2,
      path: "clips.duplicate-keys.source.tracks.transform.opacity",
      message: "Key times must be strictly increasing",
    },
    {
      file: "components/invalid-property-value.mvc.json",
      parse: parseMotionComponentV2,
      path: "clips.invalid-value.source.tracks.transform.opacity",
      message: "Expected number value for transform.opacity",
    },
    {
      file: "components/schedule-cycle.mvc.json",
      parse: parseMotionComponentV2,
      path: "clips.a.schedule",
      message: "Clip schedule cycle detected",
    },
    {
      file: "components/duplicate-node-id.mvc.json",
      parse: parseMotionComponentV2,
      path: "nodes",
      message: "Duplicate node id: duplicate",
    },
    {
      file: "components/asset-type-mismatch.mvc.json",
      parse: parseMotionComponentV2,
      path: "nodes.image.payload.assetId",
      message: "Asset asset.font has type font, expected image",
    },
    {
      file: "projects/unpinned-component.mt.json",
      parse: parseMotionProjectV2,
      path: "scenes.scene.nodes.instance.payload",
      message: "Unpinned component dependency: missing.component@1.0.0",
    },
  ] as const;
  for (const fixture of cases) {
    let error: unknown;
    try {
      fixture.parse(await readJson(resolve(fixturesRoot, "negative", fixture.file)));
    } catch (caught) {
      error = caught;
    }
    if (!(error instanceof MotionV2ReferenceError)) throw new Error(`Negative fixture did not fail with a reference error: ${fixture.file}`);
    if (!error.issues.some((issue) => issue.path === fixture.path && issue.message === fixture.message)) {
      throw new Error(`Negative fixture changed error contract: ${fixture.file}\n${error.message}`);
    }
    console.log(`OK negative/${fixture.file}`);
  }
  const schemaLimitFile = "components/id-over-limit.mvc.json";
  let schemaError: unknown;
  try {
    parseMotionComponentV2(await readJson(resolve(fixturesRoot, "negative", schemaLimitFile)));
  } catch (caught) {
    schemaError = caught;
  }
  const schemaIssues = schemaError && typeof schemaError === "object" && "issues" in schemaError
    ? (schemaError as { issues: Array<{ path: Array<string | number>; message: string }> }).issues
    : [];
  if (!schemaIssues.some((issue) => issue.path.join(".") === "nodes.0.id" && issue.message.includes("at most 128"))) {
    throw new Error(`Negative fixture changed schema limit contract: ${schemaLimitFile}`);
  }
  console.log(`OK negative/${schemaLimitFile}`);
  const unsupportedAssetFile = "components/unsupported-asset-type.mvc.json";
  let assetSchemaError: unknown;
  try {
    parseMotionComponentV2(await readJson(resolve(fixturesRoot, "negative", unsupportedAssetFile)));
  } catch (caught) {
    assetSchemaError = caught;
  }
  const assetSchemaIssues = assetSchemaError && typeof assetSchemaError === "object" && "issues" in assetSchemaError
    ? (assetSchemaError as { issues: Array<{ path: Array<string | number>; code?: string }> }).issues
    : [];
  if (!assetSchemaIssues.some((issue) => issue.path.join(".") === "assets.0.assetType" && issue.code === "invalid_union_discriminator")) {
    throw new Error(`Negative fixture changed asset discriminator contract: ${unsupportedAssetFile}`);
  }
  console.log(`OK negative/${unsupportedAssetFile}`);
  return cases.length + 2;
}

function fixtureTransform(): Record<string, unknown> {
  return {
    x: 0, y: 0, width: 0, height: 0, rotation: 0,
    scaleX: 1, scaleY: 1, anchorX: 0, anchorY: 0,
    opacity: 1, visible: true, flipX: false, flipY: false,
  };
}

function fixtureNode(id: string, parentId: string | null = null): Record<string, unknown> {
  return { id, type: "group", parentId, transform: fixtureTransform() };
}

function fixtureClip(id: string): Record<string, unknown> {
  return {
    id,
    targetId: "root",
    schedule: { kind: "absolute", at: 0 },
    duration: 1,
    playback: { iterations: 1, direction: "normal", rate: 1 },
    source: { kind: "preset", presetId: "fade-in" },
  };
}

function baseLimitComponent(): Record<string, unknown> {
  return {
    format: "motion-component",
    formatVersion: 2,
    componentId: "negative.limit",
    componentVersion: "1.0.0",
    metadata: { name: "Limit fixture" },
    assets: [], variables: [], publicAPI: [],
    nodes: [fixtureNode("root")], bindings: [], clips: [],
  };
}

function baseLimitProject(): Record<string, unknown> {
  return {
    format: "motion-project",
    formatVersion: 2,
    metadata: {
      id: "negative.limit", name: "Limit fixture", aspectRatio: "9:16", fps: 30, locale: "vi-VN",
      brand: { name: "Limit fixture" },
    },
    dependencies: { components: [] }, assets: [], variables: [],
    timeline: { sceneOrder: ["scene-0"], audioTracks: [] },
    scenes: [{ id: "scene-0", duration: 1, nodes: [fixtureNode("root")], clips: [] }],
    bindings: [], extensions: { constraints: [], events: [] },
  };
}

function buildLimitArtifact(testCase: LimitCase): { artifact: Record<string, unknown>; parse: (input: unknown) => unknown } {
  const count = MOTION_V2_LIMITS[testCase.limit] + 1;
  if (testCase.target.startsWith("component.")) {
    const component = baseLimitComponent();
    if (testCase.target === "component.nodes") component.nodes = Array.from({ length: count }, (_, index) => fixtureNode(`node-${index}`));
    else component.clips = Array.from({ length: count }, (_, index) => fixtureClip(`clip-${index}`));
    return { artifact: component, parse: parseMotionComponentV2 };
  }
  if (testCase.target === "variable.listItems") {
    const component = baseLimitComponent();
    component.variables = [{
      id: "items", name: "Items", type: "list",
      itemSchema: { type: "object", fields: { label: { type: "string" } } },
      value: Array.from({ length: count }, (_, index) => ({ label: `Item ${index}` })),
    }];
    return { artifact: component, parse: parseMotionComponentV2 };
  }
  if (testCase.target === "hierarchy.depth") {
    const component = baseLimitComponent();
    component.nodes = Array.from({ length: count + 1 }, (_, index) => fixtureNode(`node-${index}`, index === 0 ? null : `node-${index - 1}`));
    return { artifact: component, parse: parseMotionComponentV2 };
  }
  const project = baseLimitProject();
  const scenes = project.scenes as Array<Record<string, unknown>>;
  const scene = scenes[0]!;
  if (testCase.target === "project.scenes") {
    project.scenes = Array.from({ length: count }, (_, index) => ({ id: `scene-${index}`, duration: 1, nodes: [], clips: [] }));
    (project.timeline as Record<string, unknown>).sceneOrder = Array.from({ length: count }, (_, index) => `scene-${index}`);
  } else if (testCase.target === "scene.nodes") {
    scene.nodes = Array.from({ length: count }, (_, index) => fixtureNode(`node-${index}`));
  } else if (testCase.target === "scene.clips") {
    scene.clips = Array.from({ length: count }, (_, index) => fixtureClip(`clip-${index}`));
  } else {
    const trackCount = testCase.target === "clip.tracks" ? count : 1;
    const keyCount = testCase.target === "track.keys" ? count : 1;
    scene.duration = Math.max(1, keyCount);
    scene.clips = [{
      id: "tracks", schedule: { kind: "absolute", at: 0 }, duration: Math.max(1, keyCount),
      playback: { iterations: 1, direction: "normal", rate: 1 },
      source: {
        kind: "tracks",
        tracks: Array.from({ length: trackCount }, () => ({
          targetId: "root", property: "transform.opacity",
          keys: Array.from({ length: keyCount }, (_, index) => ({ t: index, v: 1 })),
        })),
      },
    }];
  }
  return { artifact: project, parse: parseMotionProjectV2 };
}

async function validateLimitCases(): Promise<number> {
  const descriptor = await readJson(resolve(fixturesRoot, "negative", "limits", "cases.json")) as {
    format?: unknown;
    formatVersion?: unknown;
    cases?: unknown;
  };
  if (descriptor.format !== "motion-negative-limit-cases" || descriptor.formatVersion !== 1 || !Array.isArray(descriptor.cases)) {
    throw new Error("Invalid negative limit descriptor");
  }
  const cases = descriptor.cases as LimitCase[];
  for (const testCase of cases) {
    if (!(testCase.limit in MOTION_V2_LIMITS)) throw new Error(`Unknown limit key: ${testCase.limit}`);
    const { artifact, parse } = buildLimitArtifact(testCase);
    let error: unknown;
    try { parse(artifact); } catch (caught) { error = caught; }
    if (testCase.target === "hierarchy.depth") {
      if (!(error instanceof MotionV2ReferenceError) || !error.issues.some((issue) => issue.path === testCase.expectedPath && issue.message === `Hierarchy exceeds depth limit ${MOTION_V2_LIMITS.hierarchyDepth}`)) {
        throw new Error(`Hierarchy limit contract changed: ${testCase.id}`);
      }
    } else {
      const issues = error && typeof error === "object" && "issues" in error
        ? (error as { issues: Array<{ path: Array<string | number>; code?: string; maximum?: number }> }).issues
        : [];
      if (!issues.some((issue) => issue.path.join(".") === testCase.expectedPath && issue.code === "too_big" && issue.maximum === MOTION_V2_LIMITS[testCase.limit])) {
        throw new Error(`Array limit contract changed: ${testCase.id}`);
      }
    }
    console.log(`OK negative/limits/${testCase.id}`);
  }
  return cases.length;
}

async function validateCompilerGoldens(components: ReturnType<typeof parseMotionComponentV2>[]): Promise<number> {
  const projectRoot = resolve(fixturesRoot, "projects");
  const goldenRoot = resolve(fixturesRoot, "expected-runtime");
  const projectFiles = (await readdir(projectRoot)).filter((file) => file.endsWith(".json")).sort();
  const goldenFiles = (await readdir(goldenRoot)).filter((file) => file.endsWith(".json")).sort();
  const expectedNames = projectFiles.map((file) => file.replace(/\.mt\.json$/, ".runtime.json"));
  deepStrictEqual(goldenFiles, expectedNames, "Runtime golden set must exactly match project fixtures");
  for (let index = 0; index < projectFiles.length; index += 1) {
    const projectFile = projectFiles[index]!;
    const goldenFile = expectedNames[index]!;
    const project = parseMotionProjectV2(await readJson(resolve(projectRoot, projectFile)));
    const first = compileMotionProject(project, { components });
    const second = compileMotionProject(project, { components });
    deepStrictEqual(second, first, `Compiler output is not deterministic: ${projectFile}`);
    deepStrictEqual(first, await readJson(resolve(goldenRoot, goldenFile)), `Runtime golden changed: ${projectFile}`);
    console.log(`OK expected-runtime/${goldenFile}`);
  }
  return projectFiles.length;
}

async function main(): Promise<void> {
  await validateAssetKit();
  const componentCount = await validateDirectory("components", parseMotionComponentV2);
  const projectCount = await validateDirectory("projects", parseMotionProjectV2);
  MotionPatchSchema.parse(await readJson(resolve(fixturesRoot, "patches", "ai-fill-big-number.json")));
  console.log(`OK patches/ai-fill-big-number.json`);
  const negativeCount = await validateNegativeFixtures();
  const limitCount = await validateLimitCases();

  const componentFiles = (await readdir(resolve(fixturesRoot, "components"))).filter((file) => file.endsWith(".json"));
  const components = await Promise.all(componentFiles.map(async (file) => parseMotionComponentV2(await readJson(resolve(fixturesRoot, "components", file)))));
  const goldenCount = await validateCompilerGoldens(components);
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

  console.log(`Validated ${componentCount + projectCount + 1} positive, ${negativeCount} negative artifacts, ${limitCount} limit cases and ${goldenCount} Runtime golden Motion Format v2 fixtures.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
