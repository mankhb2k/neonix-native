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
  motionPropertyCapability,
  motionPropertyCapabilities,
  segmentTextUnits,
} from "../packages/motion-schema/src/index";
import { compileMotionProject } from "../apps/render-worker/src/compiler/index";
import { evaluateProperty } from "../packages/motion-runtime/src/index";

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
  target:
    | "component.nodes" | "component.clips" | "component.assets" | "component.variables" | "component.publicAPI" | "component.bindings"
    | "project.scenes" | "project.dependencies" | "project.audioTracks" | "project.bindings" | "project.extensionConstraints"
    | "scene.nodes" | "scene.clips" | "clip.tracks" | "track.keys"
    | "variable.listItems" | "variable.enumOptions" | "semantic.tags" | "asset.localeCoverage" | "patch.operations" | "hierarchy.depth"
    | "shape.polygonPoints" | "path.contours" | "path.segments" | "repeater.count" | "repeater.gridColumns" | "textAnimator.units" | "modifier.items"
    | "component.sourceImports" | "sourceImport.parts" | "sourcePart.elementIds" | "component.cutoutRigs" | "effects.items"
    | "cutoutRig.slots" | "variantSlot.variants" | "component.actions" | "action.clips";
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

type FixtureAssetReference = {
  uri: string;
  integrity?: string;
  declaration?: Record<string, unknown>;
};

function collectAssetReferences(value: unknown, references: FixtureAssetReference[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectAssetReferences(item, references);
    return;
  }
  if (value === null || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  for (const [key, nested] of Object.entries(record)) {
    if ((key === "uri" || key === "thumbnail") && typeof nested === "string" && nested.startsWith("assets/")) {
      references.push({
        uri: nested,
        integrity: typeof record.integrity === "string" ? record.integrity : undefined,
        declaration: typeof record.assetType === "string" ? record : undefined,
      });
    }
    collectAssetReferences(nested, references);
  }
}

function expectedMimeType(entry: AssetManifestEntry): string {
  const extension = entry.path.split(".").at(-1)?.toLowerCase();
  const byExtension: Record<string, string> = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
    svg: "image/svg+xml", mp4: "video/mp4", webm: "video/webm",
    mp3: "audio/mpeg", wav: "audio/wav", aac: "audio/aac", ogg: "audio/ogg",
    ttf: "font/ttf", otf: "font/otf", woff: "font/woff", woff2: "font/woff2",
  };
  const mime = extension ? byExtension[extension] : undefined;
  if (!mime) throw new Error(`No fixture MIME mapping for ${entry.path}`);
  return mime;
}

function pixelFormatHasAlpha(pixelFormat: string): boolean {
  return /(?:rgba|bgra|argb|abgr|yuva|graya)/i.test(pixelFormat);
}

function validateDeclaredAssetMetadata(reference: FixtureAssetReference, entry: AssetManifestEntry): void {
  const asset = reference.declaration;
  if (!asset) return;
  const fail = (field: string): never => { throw new Error(`Fixture asset metadata mismatch: ${reference.uri} ${field}`); };
  if (asset.assetType !== entry.kind) fail("assetType");
  if (asset.mimeType !== expectedMimeType(entry)) fail("mimeType");
  if (entry.width !== undefined && asset.width !== entry.width) fail("width");
  if (entry.height !== undefined && asset.height !== entry.height) fail("height");
  if (entry.duration !== undefined && (typeof asset.duration !== "number" || Math.abs(asset.duration - entry.duration) > 0.001)) fail("duration");
  if (entry.sampleRate !== undefined && asset.sampleRate !== entry.sampleRate) fail("sampleRate");
  if (entry.channels !== undefined && asset.channels !== entry.channels) fail("channels");
  if (entry.kind === "image") {
    if (asset.pixelFormat !== entry.pixelFormat) fail("pixelFormat");
    if (asset.hasAlpha !== pixelFormatHasAlpha(String(entry.pixelFormat))) fail("hasAlpha");
  }
  if (entry.kind === "svg") {
    if (entry.viewBox !== undefined && asset.viewBox !== entry.viewBox) fail("viewBox");
    if (asset.sanitized !== true) fail("sanitized");
  }
  if (entry.kind === "audio" && asset.codec !== entry.codec) fail("codec");
  if (entry.kind === "video") {
    if (asset.videoCodec !== entry.codec) fail("videoCodec");
    if (asset.pixelFormat !== entry.pixelFormat) fail("pixelFormat");
    if (asset.fps !== entry.fps) fail("fps");
    if (asset.hasAudio !== entry.hasAudio) fail("hasAudio");
    if (entry.hasAudio && asset.audioCodec !== entry.audioCodec) fail("audioCodec");
  }
  if (entry.kind === "font") {
    const expectedWeight = entry.style === "Bold" ? 700 : entry.style === "Medium" ? 500 : 400;
    const expectedStyle = entry.style?.includes("Italic") ? "italic" : "normal";
    if (asset.family !== entry.family) fail("family");
    if (asset.weight !== expectedWeight) fail("weight");
    if (asset.style !== expectedStyle) fail("style");
    if (!Array.isArray(asset.localeCoverage) || !asset.localeCoverage.includes(entry.localeCoverage)) fail("localeCoverage");
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

  const references: FixtureAssetReference[] = [];
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
    validateDeclaredAssetMetadata(reference, entry);
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
      file: "components/property-domain-over-limit.mvc.json",
      parse: parseMotionComponentV2,
      path: "clips.opacity.source.tracks.transform.opacity",
      message: "Value 1.5 exceeds maximum 1 for transform.opacity",
    },
    {
      file: "components/runtime-unsupported-property.mvc.json",
      parse: parseMotionComponentV2,
      path: "clips.zoom.source.tracks.payload.zoom",
      message: "Property is not animatable: payload.zoom",
    },
    {
      file: "components/binding-domain-over-limit.mvc.json",
      parse: parseMotionComponentV2,
      path: "bindings.opacity.target.property",
      message: "Value 2 exceeds maximum 1 for transform.opacity",
    },
    {
      file: "components/duplicate-path-contour-id.mvc.json",
      parse: parseMotionComponentV2,
      path: "nodes.path.payload.contours",
      message: "Duplicate Path contour id: duplicate",
    },
    {
      file: "components/missing-mask-source.mvc.json",
      parse: parseMotionComponentV2,
      path: "nodes.content.mask.sourceNodeId",
      message: "Unknown mask source: missing",
    },
    {
      file: "components/mask-cycle.mvc.json",
      parse: parseMotionComponentV2,
      path: "nodes.a.mask",
      message: "Mask dependency cycle detected",
    },
    {
      file: "components/missing-repeater-variable.mvc.json",
      parse: parseMotionComponentV2,
      path: "nodes.item.repeat.source.variableId",
      message: "Unknown variable: missing",
    },
    {
      file: "components/repeater-source-not-list.mvc.json",
      parse: parseMotionComponentV2,
      path: "nodes.item.repeat.source.variableId",
      message: "Repeater source must be a list variable: count",
    },
    {
      file: "components/duplicate-repeater-key.mvc.json",
      parse: parseMotionComponentV2,
      path: "nodes.item.repeat.source.keyPath",
      message: "Duplicate Repeater key: same",
    },
    {
      file: "components/missing-repeater-key.mvc.json",
      parse: parseMotionComponentV2,
      path: "nodes.item.repeat.source.keyPath",
      message: "Repeater key id is missing at item 0",
    },
    {
      file: "components/text-animator-with-child.mvc.json",
      parse: parseMotionComponentV2,
      path: "nodes.text.textAnimator",
      message: "Text Animator node cannot own child nodes",
    },
    {
      file: "components/text-animator-authored-clip.mvc.json",
      parse: parseMotionComponentV2,
      path: "clips.bad.targetId",
      message: "Text Animator node cannot be targeted by authored clips; animate its parent or animator properties",
    },
    {
      file: "components/empty-text-animator-text.mvc.json",
      parse: parseMotionComponentV2,
      path: "nodes.text.textAnimator",
      message: "Text Animator requires at least one text unit",
    },
    {
      file: "components/text-animator-timing-over-limit.mvc.json",
      parse: parseMotionComponentV2,
      path: "nodes.text.textAnimator",
      message: "Text Animator timing exceeds maximum 86400",
    },
    { file: "components/missing-motion-path-node.mvc.json", parse: parseMotionComponentV2, path: "nodes.target.modifiers.follow.pathNodeId", message: "Unknown Motion Path node: missing" },
    { file: "components/motion-path-source-wrong-type.mvc.json", parse: parseMotionComponentV2, path: "nodes.target.modifiers.follow.pathNodeId", message: "Motion Path source source has type group, expected path" },
    { file: "components/missing-motion-path-contour.mvc.json", parse: parseMotionComponentV2, path: "nodes.target.modifiers.follow.contourId", message: "Unknown Path contour: missing" },
    { file: "components/duplicate-modifier-id.mvc.json", parse: parseMotionComponentV2, path: "nodes.target.modifiers", message: "Duplicate modifier id: follow" },
    { file: "components/multiple-motion-path-modifiers.mvc.json", parse: parseMotionComponentV2, path: "nodes.target.modifiers", message: "Only one motion-path modifier is allowed per node" },
    { file: "components/motion-path-offset-order.mvc.json", parse: parseMotionComponentV2, path: "nodes.target.modifiers.follow", message: "Motion Path endOffset must be >= startOffset" },
    { file: "components/motion-path-cycle.mvc.json", parse: parseMotionComponentV2, path: "nodes.a.modifiers.ma", message: "Motion Path dependency cycle detected" },
    { file: "components/motion-path-descendant-source.mvc.json", parse: parseMotionComponentV2, path: "nodes.target.modifiers.follow.pathNodeId", message: "Motion Path source cannot be a descendant of its target" },
    { file: "components/motion-path-zero-length.mvc.json", parse: parseMotionComponentV2, path: "nodes.target.modifiers.follow.contourId", message: "Motion Path contour has zero length: route" },
    { file: "components/unknown-motion-path-property.mvc.json", parse: parseMotionComponentV2, path: "clips.bad.source.tracks.modifiers.missing.progress", message: "Unknown Motion Path modifier: missing" },
    { file: "components/motion-path-progress-over-limit.mvc.json", parse: parseMotionComponentV2, path: "clips.bad.source.tracks.modifiers.follow.progress", message: "Value 1.2 exceeds maximum 1 for modifiers.follow.progress" },
    { file: "components/effect-unknown-track-id.mvc.json", parse: parseMotionComponentV2, path: "clips.animate.source.tracks.effects.missing.radius", message: "Unknown effect: missing" },
    { file: "components/effect-unsupported-field.mvc.json", parse: parseMotionComponentV2, path: "clips.animate.source.tracks.effects.tone.radius", message: "Unsupported property for color-adjust effect: radius" },
    { file: "components/effect-duplicate-id.mvc.json", parse: parseMotionComponentV2, path: "nodes.card.effects", message: "Duplicate effect id: blur" },
    {
      file: "projects/unpinned-component.mt.json",
      parse: parseMotionProjectV2,
      path: "scenes.scene.nodes.instance.payload",
      message: "Unpinned component dependency: missing.component@1.0.0",
    },
    {
      file: "projects/active-camera-type.mt.json",
      parse: parseMotionProjectV2,
      path: "scenes.scene.activeCameraId",
      message: "Node not-a-camera has type group, expected camera",
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
  const schemaCases = [
    {
      file: "components/id-over-limit.mvc.json",
      path: "nodes.0.id",
      message: "at most 128",
    },
    {
      file: "components/unsupported-asset-type.mvc.json",
      path: "assets.0.assetType",
      code: "invalid_union_discriminator",
    },
    {
      file: "components/missing-image-metadata.mvc.json",
      path: "assets.0.hasAlpha",
      code: "invalid_type",
    },
    {
      file: "components/image-alpha-mismatch.mvc.json",
      path: "assets.0.hasAlpha",
      code: "custom",
      message: "Image hasAlpha does not match pixelFormat",
    },
    {
      file: "components/video-audio-metadata.mvc.json",
      path: "assets.0.hasAudio",
      code: "custom",
      message: "Silent video must not declare audio metadata",
    },
    {
      file: "components/video-missing-audio-metadata.mvc.json",
      path: "assets.0.hasAudio",
      code: "custom",
      message: "Video with audio requires audioCodec, sampleRate and channels",
    },
    {
      file: "components/unsupported-node-type.mvc.json",
      path: "nodes.0.type",
      code: "invalid_union_discriminator",
    },
    {
      file: "components/group-extra-payload.mvc.json",
      path: "nodes.0",
      code: "unrecognized_keys",
    },
    {
      file: "components/invalid-shape-kind.mvc.json",
      path: "nodes.0.payload.shape",
      code: "invalid_union_discriminator",
    },
    {
      file: "components/non-finite-transform.mvc.json",
      path: "nodes.0.transform.x",
      code: "not_finite",
    },
    {
      file: "components/non-finite-json.mvc.json",
      path: "metadata.badNumber",
      code: "not_finite",
    },
    {
      file: "components/node-dimension-over-limit.mvc.json",
      path: "nodes.0.transform.width",
      code: "too_big",
    },
    {
      file: "components/playback-iterations-over-limit.mvc.json",
      path: "clips.0.playback.iterations",
      code: "too_big",
    },
    {
      file: "components/polygon-too-few-points.mvc.json",
      path: "nodes.0.payload.points",
      code: "too_small",
    },
    {
      file: "components/path-empty-contours.mvc.json",
      path: "nodes.0.payload.contours",
      code: "too_small",
    },
    {
      file: "components/path-empty-segments.mvc.json",
      path: "nodes.0.payload.contours.0.segments",
      code: "too_small",
    },
    {
      file: "components/path-invalid-cubic.mvc.json",
      path: "nodes.0.payload.contours.0.segments.0.control2",
      code: "invalid_type",
    },
    {
      file: "components/path-coordinate-over-limit.mvc.json",
      path: "nodes.0.payload.contours.0.start.x",
      code: "too_big",
    },
    {
      file: "components/invalid-mask-mode.mvc.json",
      path: "nodes.1.mask.mode",
      code: "invalid_enum_value",
    },
    {
      file: "components/invalid-repeater-layout.mvc.json",
      path: "nodes.0.repeat.layout.kind",
      code: "invalid_union_discriminator",
    },
    {
      file: "components/negative-repeater-stagger.mvc.json",
      path: "nodes.0.repeat.timeStagger",
      code: "too_small",
    },
    {
      file: "components/effect-radius-over-limit.mvc.json",
      path: "nodes.0.effects.0.radius",
      code: "too_big",
      message: "less than or equal to 512",
    },
    {
      file: "components/invalid-text-selector.mvc.json",
      path: "nodes.0.textAnimator.selector.end",
      code: "custom",
      message: "Text Animator selector end must be >= start",
    },
    {
      file: "components/empty-text-animator-properties.mvc.json",
      path: "nodes.0.textAnimator.properties",
      code: "custom",
      message: "Text Animator requires at least one property",
    },
    {
      file: "components/invalid-text-animator-unit.mvc.json",
      path: "nodes.0.textAnimator.unit",
      code: "invalid_enum_value",
    },
    {
      file: "components/invalid-text-animator-locale.mvc.json",
      path: "nodes.0.textAnimator.locale",
      code: "custom",
      message: "Invalid locale identifier",
    },
  ] as const;
  for (const fixture of schemaCases) {
    let error: unknown;
    try {
      parseMotionComponentV2(await readJson(resolve(fixturesRoot, "negative", fixture.file)));
    } catch (caught) {
      error = caught;
    }
    const issues = error && typeof error === "object" && "issues" in error
      ? (error as { issues: Array<{ path: Array<string | number>; code?: string; message: string }> }).issues
      : [];
    const matches = issues.some((issue) =>
      issue.path.join(".") === fixture.path
      && (!("code" in fixture) || issue.code === fixture.code)
      && (!("message" in fixture) || issue.message.includes(fixture.message)),
    );
    if (!matches) throw new Error(`Negative fixture changed schema contract: ${fixture.file}`);
    console.log(`OK negative/${fixture.file}`);
  }
  return cases.length + schemaCases.length;
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
  if (testCase.target === "effects.items") {
    const component = baseLimitComponent();
    component.nodes = [{ ...fixtureNode("root"), effects: Array.from({ length: count }, (_, index) => ({ id: `effect-${index}`, type: "blur", radius: 1 })) }];
    return { artifact: component, parse: parseMotionComponentV2 };
  }
  if (["component.sourceImports", "sourceImport.parts", "sourcePart.elementIds", "component.cutoutRigs", "cutoutRig.slots", "variantSlot.variants", "component.actions", "action.clips"].includes(testCase.target)) {
    const component = baseLimitComponent();
    const part = (index: number, elementCount = 1) => ({
      id: `part-${index}`,
      sourceElementIds: Array.from({ length: elementCount }, (_, elementIndex) => `element-${index}-${elementIndex}`),
      structuralFingerprint: `fingerprint-${index}`,
      nodeId: "root",
      outputAssetId: "asset",
    });
    const sourceImport = (index: number, partCount = 1, elementCount = 1) => ({
      id: `import-${index}`, kind: "svg", sourceAssetId: "source", sourceIntegrity: "sha256-source",
      parts: Array.from({ length: partCount }, (_, partIndex) => part(partIndex, elementCount)),
    });
    const variant = (index: number) => ({ id: `variant-${index}`, assetId: "asset" });
    const slot = (index: number, variantCount = 1) => ({
      id: `slot-${index}`, nodeId: "root", semanticRole: "mouth", defaultVariantId: "variant-0",
      variants: Array.from({ length: variantCount }, (_, variantIndex) => variant(variantIndex)),
    });
    const rig = (index: number, slotCount = 1, variantCount = 1) => ({
      id: `rig-${index}`, kind: "cutout", rootNodeId: "root",
      slots: Array.from({ length: slotCount }, (_, slotIndex) => slot(slotIndex, variantCount)),
    });
    const action = (index: number, clipCount = 1) => ({
      id: `action-${index}`, name: `Action ${index}`, duration: 1, loop: false,
      clips: Array.from({ length: clipCount }, (_, clipIndex) => fixtureClip(`action-clip-${clipIndex}`)),
    });
    if (testCase.target === "component.sourceImports") component.sourceImports = Array.from({ length: count }, (_, index) => sourceImport(index));
    else if (testCase.target === "sourceImport.parts") component.sourceImports = [sourceImport(0, count)];
    else if (testCase.target === "sourcePart.elementIds") component.sourceImports = [sourceImport(0, 1, count)];
    else if (testCase.target === "component.cutoutRigs") component.cutoutRigs = Array.from({ length: count }, (_, index) => rig(index));
    else if (testCase.target === "cutoutRig.slots") component.cutoutRigs = [rig(0, count)];
    else if (testCase.target === "variantSlot.variants") component.cutoutRigs = [rig(0, 1, count)];
    else if (testCase.target === "component.actions") component.actions = Array.from({ length: count }, (_, index) => action(index));
    else component.actions = [action(0, count)];
    return { artifact: component, parse: parseMotionComponentV2 };
  }
  if (testCase.target.startsWith("component.")) {
    const component = baseLimitComponent();
    if (testCase.target === "component.nodes") component.nodes = Array.from({ length: count }, (_, index) => fixtureNode(`node-${index}`));
    else if (testCase.target === "component.clips") component.clips = Array.from({ length: count }, (_, index) => fixtureClip(`clip-${index}`));
    else if (testCase.target === "component.assets") component.assets = Array.from({ length: count }, (_, index) => ({
      id: `asset-${index}`, assetType: "image", uri: `asset-${index}.png`, mimeType: "image/png",
      width: 1, height: 1, pixelFormat: "rgb24", hasAlpha: false,
    }));
    else if (testCase.target === "component.variables") component.variables = Array.from({ length: count }, (_, index) => ({ id: `variable-${index}`, name: `Variable ${index}`, type: "string", value: "" }));
    else if (testCase.target === "component.publicAPI") component.publicAPI = Array.from({ length: count }, (_, index) => ({ id: `param-${index}`, type: "string", variableId: `variable-${index}` }));
    else component.bindings = Array.from({ length: count }, (_, index) => ({
      id: `binding-${index}`, source: { kind: "variable", variableId: `variable-${index}` }, target: { nodeId: "root", property: "transform.x" },
    }));
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
  if (testCase.target === "variable.enumOptions") {
    const component = baseLimitComponent();
    component.variables = [{ id: "choice", name: "Choice", type: "enum", value: "option-0", options: Array.from({ length: count }, (_, index) => `option-${index}`) }];
    return { artifact: component, parse: parseMotionComponentV2 };
  }
  if (testCase.target === "semantic.tags") {
    const component = baseLimitComponent();
    (component.nodes as Array<Record<string, unknown>>)[0]!.semantic = { role: "root", tags: Array.from({ length: count }, (_, index) => `tag-${index}`) };
    return { artifact: component, parse: parseMotionComponentV2 };
  }
  if (testCase.target === "asset.localeCoverage") {
    const component = baseLimitComponent();
    component.assets = [{
      id: "font", assetType: "font", uri: "font.ttf", mimeType: "font/ttf", family: "Fixture", weight: 400, style: "normal",
      localeCoverage: Array.from({ length: count }, (_, index) => `locale-${index}`),
    }];
    return { artifact: component, parse: parseMotionComponentV2 };
  }
  if (testCase.target === "patch.operations") {
    return {
      artifact: {
        format: "motion-patch", formatVersion: 1, baseRevision: 0,
        operations: Array.from({ length: count }, (_, index) => ({ op: "set", target: { variableId: `variable-${index}` }, value: index })),
      },
      parse: (input: unknown) => MotionPatchSchema.parse(input),
    };
  }
  if (testCase.target === "hierarchy.depth") {
    const component = baseLimitComponent();
    component.nodes = Array.from({ length: count + 1 }, (_, index) => fixtureNode(`node-${index}`, index === 0 ? null : `node-${index - 1}`));
    return { artifact: component, parse: parseMotionComponentV2 };
  }
  if (testCase.target === "shape.polygonPoints") {
    const component = baseLimitComponent();
    component.nodes = [{
      id: "polygon", type: "shape", parentId: null, transform: fixtureTransform(),
      payload: { shape: "polygon", points: Array.from({ length: count }, (_, index) => ({ x: index, y: index % 2 })) },
      style: { fill: "#ffffff" },
    }];
    return { artifact: component, parse: parseMotionComponentV2 };
  }
  if (testCase.target === "path.contours" || testCase.target === "path.segments") {
    const component = baseLimitComponent();
    const line = (index: number) => ({ kind: "line", to: { x: index + 1, y: 0 } });
    const contour = (index: number, segmentCount = 1) => ({
      id: `contour-${index}`, start: { x: 0, y: index }, closed: false,
      segments: Array.from({ length: segmentCount }, (_, segmentIndex) => line(segmentIndex)),
    });
    component.nodes = [{
      id: "path", type: "path", parentId: null, transform: fixtureTransform(),
      payload: {
        fillRule: "nonzero",
        contours: testCase.target === "path.contours"
          ? Array.from({ length: count }, (_, index) => contour(index))
          : [contour(0, count)],
      },
      style: { stroke: "#ffffff", strokeWidth: 1 },
    }];
    return { artifact: component, parse: parseMotionComponentV2 };
  }
  if (testCase.target === "repeater.count" || testCase.target === "repeater.gridColumns") {
    const component = baseLimitComponent();
    (component.nodes as Array<Record<string, unknown>>)[0]!.repeat = {
      source: { kind: "count", count: testCase.target === "repeater.count" ? count : 1, keyPrefix: "item" },
      layout: testCase.target === "repeater.gridColumns" ? { kind: "grid", columns: count, gapX: 1, gapY: 1 } : { kind: "none" },
      timeStagger: 0,
    };
    return { artifact: component, parse: parseMotionComponentV2 };
  }
  if (testCase.target === "textAnimator.units") {
    const component = baseLimitComponent();
    component.nodes = [{
      id: "text", type: "text", parentId: null, transform: fixtureTransform(),
      payload: { text: "a".repeat(count), fontSize: 10 }, style: { fill: "#ffffff" },
      textAnimator: { id: "letters", unit: "grapheme", selector: { start: 0, end: 1 }, startTime: 0, duration: 1, stagger: 0, properties: { opacity: 0 } },
    }];
    return { artifact: component, parse: parseMotionComponentV2 };
  }
  if (testCase.target === "modifier.items") {
    const component = baseLimitComponent();
    (component.nodes as Array<Record<string, unknown>>)[0]!.modifiers = Array.from({ length: count }, (_, index) => ({
      id: `modifier-${index}`, type: "motion-path", pathNodeId: "path", contourId: "route", progress: 0,
      orientToPath: false, rotationOffset: 0, startOffset: 0, endOffset: 1,
    }));
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
  } else if (testCase.target === "project.dependencies") {
    (project.dependencies as Record<string, unknown>).components = Array.from({ length: count }, (_, index) => ({ componentId: `component-${index}`, version: "1.0.0", source: "registry", integrity: `sha256-${index}` }));
  } else if (testCase.target === "project.audioTracks") {
    (project.timeline as Record<string, unknown>).audioTracks = Array.from({ length: count }, (_, index) => ({ id: `audio-${index}`, role: "sfx", assetId: `asset-${index}`, start: 0 }));
  } else if (testCase.target === "project.bindings") {
    project.bindings = Array.from({ length: count }, (_, index) => ({ id: `binding-${index}`, source: { kind: "variable", variableId: `variable-${index}` }, target: { sceneId: "scene-0", nodeId: "root", property: "transform.x" } }));
  } else if (testCase.target === "project.extensionConstraints") {
    (project.extensions as Record<string, unknown>).constraints = Array.from({ length: count }, (_, index) => ({ id: `constraint-${index}` }));
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
    if (testCase.target === "hierarchy.depth" || testCase.target === "textAnimator.units") {
      const expectedMessage = testCase.target === "hierarchy.depth"
        ? `Hierarchy exceeds depth limit ${MOTION_V2_LIMITS.hierarchyDepth}`
        : `Text Animator exceeds unit limit ${MOTION_V2_LIMITS.textAnimatorUnits}`;
      if (!(error instanceof MotionV2ReferenceError) || !error.issues.some((issue) => issue.path === testCase.expectedPath && issue.message === expectedMessage)) {
        throw new Error(`Reference limit contract changed: ${testCase.id}`);
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
  const textCapability = motionPropertyCapability("text", "payload.text");
  const shapeFillCapability = motionPropertyCapability("shape", "style.fill");
  if (!textCapability?.public || textCapability.runtimeSupport !== "evaluated" || textCapability.valueKind !== "string") {
    throw new Error("Text capability metadata contract changed");
  }
  const pathStrokeCapability = motionPropertyCapability("path", "style.strokeWidth");
  if (shapeFillCapability?.runtimeSupport !== "evaluated" || !shapeFillCapability.animatable || pathStrokeCapability?.runtimeSupport !== "evaluated") {
    throw new Error("Shape/Path evaluated paint capability contract changed");
  }
  const aiTextProperties = motionPropertyCapabilities("text").filter((capability) => capability.public).map((capability) => capability.property);
  for (const property of ["transform.x", "payload.text", "payload.fontSize", "style.fill"]) {
    if (!aiTextProperties.includes(property)) throw new Error(`AI property vocabulary lost ${property}`);
  }
  if (!motionPropertyCapabilities("shape", ["follow"]).some((capability) => capability.property === "modifiers.follow.progress" && capability.max === 1)) {
    throw new Error("AI Motion Path modifier property vocabulary changed");
  }
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

  const propertyProject = parseMotionProjectV2(await readJson(resolve(fixturesRoot, "projects", "property-capabilities.mt.json")));
  const propertyRuntime = compileMotionProject(propertyProject);
  const propertyScene = propertyRuntime.scenes[0]!;
  const propertyNode = propertyScene.nodes[0]!;
  if (evaluateProperty(propertyScene, propertyNode, "payload.text", 0.5, "") !== "A") throw new Error("Discrete text property evaluation changed");
  if (evaluateProperty(propertyScene, propertyNode, "payload.text", 1, "") !== "B") throw new Error("Text property end key evaluation changed");
  if (evaluateProperty(propertyScene, propertyNode, "payload.fontSize", 0.5, 0) !== 60) throw new Error("Numeric font-size interpolation changed");
  if (evaluateProperty(propertyScene, propertyNode, "style.fill", 0.5, "") !== "#ff0000") throw new Error("Discrete color property evaluation changed");
  console.log("OK runtime/property capability text, number and color evaluation");

  const playbackProject = parseMotionProjectV2(await readJson(resolve(fixturesRoot, "projects", "schedule-playback.mt.json")));
  const playbackRuntime = compileMotionProject(playbackProject);
  const playbackScene = playbackRuntime.scenes[0]!;
  const playbackTrack = (targetId: string) => playbackScene.tracks.find((track) => track.targetId === targetId && track.property === "transform.x");
  deepStrictEqual(playbackTrack("normal")?.keys.map((key) => key.t), [0, 0.5, 1], "Normal repeated playback keys changed");
  deepStrictEqual(playbackTrack("reverse")?.keys.map((key) => key.v), [100, 0], "Reverse playback direction changed");
  deepStrictEqual(playbackTrack("alternate")?.keys.map((key) => key.v), [0, 100, 0, 100], "Alternate playback direction changed");
  deepStrictEqual(playbackTrack("infinite")?.keys.map((key) => key.t), [2.5], "Infinite playback must clip to scene duration");
  const playbackNodes = new Map(playbackScene.nodes.map((node) => [node.id, node]));
  const normal = playbackNodes.get("normal")!;
  const alternate = playbackNodes.get("alternate")!;
  if (evaluateProperty(playbackScene, normal, "transform.x", -0.1, -1) !== 0) throw new Error("Playback before-start clamp changed");
  if (evaluateProperty(playbackScene, normal, "transform.x", 0.75, -1) !== 50) throw new Error("Playback middle interpolation changed");
  if (evaluateProperty(playbackScene, normal, "transform.x", 2, -1) !== 100) throw new Error("Playback after-end clamp changed");
  if (Math.abs(Number(evaluateProperty(playbackScene, alternate, "transform.x", 1.5, -1)) - 25) > 1e-6) throw new Error("Alternate playback interpolation changed");
  console.log("OK compiler/evaluator playback iterations, reverse, alternate, infinite and schedule timing");

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

  const repeaterProject = parseMotionProjectV2(await readJson(resolve(fixturesRoot, "projects", "repeater-layouts.mt.json")));
  const repeaterRuntime = compileMotionProject(repeaterProject, { components });
  const repeaterScene = repeaterRuntime.scenes[0]!;
  if (JSON.stringify(repeaterRuntime).includes('"repeat"')) throw new Error("Compiler leaked Repeater authoring directives into Runtime IR");
  const family = (name: string) => repeaterScene.nodes.filter((node) => node.id.includes(`::${name}::`));
  const listNodes = family("list-item");
  const gridNodes = family("grid-item");
  const radialNodes = family("radial-item");
  const noneNodes = family("none-item");
  deepStrictEqual([listNodes.length, gridNodes.length, radialNodes.length, noneNodes.length], [3, 6, 5, 2], "Repeater family counts changed");
  deepStrictEqual(listNodes.map((node) => node.id.split("::").at(-1)), ["alpha", "beta", "gamma"], "List Repeater stable keys changed");
  deepStrictEqual(listNodes.map((node) => node.style?.fill), ["#ef4444", "#f97316", "#facc15"], "List context bindings changed");
  deepStrictEqual(gridNodes.map((node) => [node.transform.x, node.transform.y]), [[110, 300], [220, 300], [330, 300], [110, 400], [220, 400], [330, 400]], "Grid Repeater layout changed");
  deepStrictEqual(noneNodes.map((node) => [node.transform.x, node.transform.y]), [[220, 650], [220, 650]], "None Repeater layout changed");
  deepStrictEqual(radialNodes.map((node) => node.transform.rotation), [0, 72, 144, 216, 288], "Radial orientation changed");
  deepStrictEqual(repeaterScene.tracks.map((track) => track.keys[0]!.t), [0, 0.1, 0.2, 0.3, 0.4, 0.5], "Repeater time stagger changed");
  console.log("OK compiler/repeater vNext list/count/none/linear/grid/radial/stagger expansion");

  const textAnimatorProject = parseMotionProjectV2(await readJson(resolve(fixturesRoot, "projects", "text-animator-unicode.mt.json")));
  const textAnimatorRuntime = compileMotionProject(textAnimatorProject);
  const textScene = textAnimatorRuntime.scenes[0]!;
  if (JSON.stringify(textAnimatorRuntime).includes('"textAnimator"')) throw new Error("Compiler leaked Text Animator authoring metadata into Runtime IR");
  const textFamily = (name: string) => textScene.nodes.filter((node) => node.id.startsWith(`text.${name}::`));
  const graphemeRuns = textFamily("grapheme");
  const wordRuns = textFamily("word");
  const lineRuns = textFamily("line");
  deepStrictEqual([graphemeRuns.length, wordRuns.length, lineRuns.length], [8, 7, 3], "Text Animator run counts changed");
  deepStrictEqual(graphemeRuns.map((node) => node.type === "text" ? node.payload.text : ""), segmentTextUnits("Á 👨‍👩‍👧‍👦 Việt", "grapheme", "vi"), "Grapheme run text changed");
  deepStrictEqual(wordRuns.map((node) => node.type === "text" ? node.payload.text : ""), ["Xin", "chào", ",", "Việt", "Nam", "!", "👋🏽"], "Word run text changed");
  deepStrictEqual(lineRuns.map((node) => node.type === "text" ? node.payload.text : ""), ["Dòng một", "Dòng hai", "🎬 Kết"], "Line run text changed");
  if (textScene.nodes.some((node) => ["text.grapheme", "text.word", "text.line"].includes(node.id))) throw new Error("Compiler retained original Text Animator source nodes");
  deepStrictEqual(textScene.tracks.filter((track) => track.property === "transform.x").map((track) => track.keys[0]!.t), [0.2, 0.28, 0.36, 0.44, 0.52], "Word selector/stagger changed");
  console.log("OK compiler/Text Animator Unicode grapheme/word/line selector and stagger expansion");

  const motionPathProject = parseMotionProjectV2(await readJson(resolve(fixturesRoot, "projects", "motion-path.mt.json")));
  const motionPathRuntime = compileMotionProject(motionPathProject);
  const motionPathScene = motionPathRuntime.scenes[0]!;
  const rocket = motionPathScene.nodes.find((node) => node.id === "follower.rocket");
  if (!rocket?.modifiers?.some((modifier) => modifier.id === "follow" && modifier.type === "motion-path" && modifier.pathNodeId === "guide.curve")) throw new Error("Compiler lost literal Motion Path modifier");
  const progressTrack = motionPathScene.tracks.find((track) => track.targetId === "follower.rocket" && track.property === "modifiers.follow.progress");
  if (!progressTrack) throw new Error("Compiler lost Motion Path progress track");
  deepStrictEqual([0, 1, 2].map((time) => evaluateProperty(motionPathScene, rocket, "modifiers.follow.progress", time, -1)), [0, 0.5, 1], "Motion Path progress evaluation changed");
  console.log("OK compiler/runtime Motion Path modifier reference and progress track");

  console.log(`Validated ${componentCount + projectCount + 1} positive, ${negativeCount} negative artifacts, ${limitCount} limit cases and ${goldenCount} Runtime golden Motion Format v2 fixtures.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
