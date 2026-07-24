import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, loadImage } from "@napi-rs/canvas";

import { compileMotionProject } from "../apps/render-worker/src/compiler/index";
import { drawSceneFrame } from "../apps/render-worker/src/runtime/draw";
import {
  applyMatrix,
  cubicBezierBounds,
  evaluateProperty,
  evaluateScene,
  deterministicRandom,
  frameIndexAtTime,
  frameTimestamp,
  hitTestScene,
  invertMatrix,
  planOffscreenSurface,
  subtreeBounds,
} from "../packages/motion-runtime/src/index";
import { parseMotionProjectV2 } from "../packages/motion-schema/src/index";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixturesRoot = resolve(repoRoot, "docs", "fixtures", "v2");
const outputRoot = resolve(repoRoot, "tmp", "primitive-previews");
const expectedFrameRoot = resolve(fixturesRoot, "expected-frames");
const frameGoldens = [
  { project: "hierarchy", time: 0, file: "hierarchy-transform-t0.png", width: 270, height: 480 },
  { project: "hierarchy", time: 1, file: "hierarchy-transform-t1.png", width: 270, height: 480 },
  { project: "hierarchy", time: 1.5, file: "hierarchy-transform-t1_5.png", width: 270, height: 480 },
  { project: "geometry", time: 1, file: "geometry-paths-t1.png", width: 540, height: 540 },
] as const;

function close(actual: number, expected: number, label: string, tolerance = 0.02): void {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, received ${actual}`);
}

function pointAt(evaluated: ReturnType<typeof evaluateScene>, nodeId: string): { x: number; y: number } {
  const item = evaluated.find(({ node }) => node.id === nodeId);
  assert.ok(item, `Evaluated node missing: ${nodeId}`);
  return applyMatrix(item.worldMatrix, 0, 0);
}

async function countColor(png: Buffer, expected: [number, number, number], tolerance = 8): Promise<number> {
  const image = await loadImage(png);
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, image.width, image.height).data;
  let count = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    if (
      Math.abs(pixels[index]! - expected[0]) <= tolerance
      && Math.abs(pixels[index + 1]! - expected[1]) <= tolerance
      && Math.abs(pixels[index + 2]! - expected[2]) <= tolerance
      && pixels[index + 3]! > 0
    ) count += 1;
  }
  return count;
}

async function pixelAt(png: Buffer, x: number, y: number): Promise<[number, number, number, number]> {
  const image = await loadImage(png);
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  const pixel = context.getImageData(x, y, 1, 1).data;
  return [pixel[0]!, pixel[1]!, pixel[2]!, pixel[3]!];
}

async function assertFrameGolden(actual: Buffer, file: string, tolerance = 2): Promise<void> {
  const expected = await readFile(resolve(expectedFrameRoot, file));
  const [actualImage, expectedImage] = await Promise.all([loadImage(actual), loadImage(expected)]);
  assert.equal(actualImage.width, expectedImage.width, `${file} width changed`);
  assert.equal(actualImage.height, expectedImage.height, `${file} height changed`);
  const actualCanvas = createCanvas(actualImage.width, actualImage.height);
  const expectedCanvas = createCanvas(expectedImage.width, expectedImage.height);
  const actualContext = actualCanvas.getContext("2d");
  const expectedContext = expectedCanvas.getContext("2d");
  actualContext.drawImage(actualImage, 0, 0);
  expectedContext.drawImage(expectedImage, 0, 0);
  const actualPixels = actualContext.getImageData(0, 0, actualImage.width, actualImage.height).data;
  const expectedPixels = expectedContext.getImageData(0, 0, expectedImage.width, expectedImage.height).data;
  const diffCanvas = createCanvas(actualImage.width, actualImage.height);
  const diffContext = diffCanvas.getContext("2d");
  const diff = diffContext.createImageData(actualImage.width, actualImage.height);
  let changedPixels = 0;
  for (let index = 0; index < actualPixels.length; index += 4) {
    const changed = [0, 1, 2, 3].some((channel) => Math.abs(actualPixels[index + channel]! - expectedPixels[index + channel]!) > tolerance);
    if (changed) {
      changedPixels += 1;
      diff.data[index] = 255;
      diff.data[index + 3] = 255;
    }
  }
  if (changedPixels > 0) {
    diffContext.putImageData(diff, 0, 0);
    const diffFile = resolve(outputRoot, file.replace(/\.png$/, ".diff.png"));
    await writeFile(diffFile, diffCanvas.toBuffer("image/png"));
    throw new Error(`${file} differs by ${changedPixels} pixels (tolerance ${tolerance}); diff: ${diffFile}`);
  }
}

async function main(): Promise<void> {
  assert.deepEqual(frameTimestamp(30, 30), { frameIndex: 30, fps: 30, time: 1 });
  assert.equal(frameIndexAtTime(0.999, 30), 29);
  assert.throws(() => frameTimestamp(-1, 30), /Frame index/);
  const randomSample = deterministicRandom("fixture-seed", "secondary-motion", 42);
  assert.equal(randomSample, deterministicRandom("fixture-seed", "secondary-motion", 42), "seeded random sample must repeat exactly");
  assert.notEqual(randomSample, deterministicRandom("fixture-seed", "secondary-motion", 41), "sample index must create an independent random-access value");
  assert.ok(randomSample >= 0 && randomSample < 1);

  const source = parseMotionProjectV2(JSON.parse(await readFile(
    resolve(fixturesRoot, "projects", "hierarchy-transform.mt.json"),
    "utf8",
  )));
  const runtime = compileMotionProject(source);
  const scene = runtime.scenes[0]!;

  const frame0 = evaluateScene(scene, 0);
  const shoulder0 = pointAt(frame0, "bone.shoulder");
  const elbow0 = pointAt(frame0, "bone.elbow");
  const wrist0 = pointAt(frame0, "bone.wrist");
  close(shoulder0.x, 605, "shoulder x at t=0");
  close(shoulder0.y, 720, "shoulder y at t=0");
  close(elbow0.x, 715, "elbow x at t=0");
  close(elbow0.y, 720, "elbow y at t=0");
  close(wrist0.x, 805, "wrist x at t=0");
  close(wrist0.y, 720, "wrist y at t=0");

  const torso0 = frame0.find(({ node }) => node.id === "part.torso");
  assert.ok(torso0);
  close(torso0.worldBounds.x, 450, "torso bounds x at t=0");
  close(torso0.worldBounds.y, 650, "torso bounds y at t=0");
  close(torso0.worldBounds.width, 180, "torso bounds width at t=0");
  close(torso0.worldBounds.height, 300, "torso bounds height at t=0");

  const overlapHits = hitTestScene(scene, 0, { x: 620, y: 720 });
  assert.equal(overlapHits[0]?.node.id, "part.upper-arm", "hit-test must return the highest draw-order node first");
  assert.ok(overlapHits.some(({ node }) => node.id === "part.torso"), "hit-test must retain lower overlapping drawables");
  const hiddenScene = structuredClone(scene);
  const hiddenArm = hiddenScene.nodes.find((node) => node.id === "part.upper-arm");
  assert.ok(hiddenArm);
  hiddenArm.transform.visible = false;
  assert.equal(hitTestScene(hiddenScene, 0, { x: 620, y: 720 })[0]?.node.id, "part.torso", "hidden nodes must not capture hit-tests");

  const torsoInverse = invertMatrix(torso0.worldMatrix);
  assert.ok(torsoInverse);
  const torsoWorldCenter = applyMatrix(torso0.worldMatrix, 90, 150);
  const torsoLocalCenter = applyMatrix(torsoInverse, torsoWorldCenter.x, torsoWorldCenter.y);
  close(torsoLocalCenter.x, 90, "inverse matrix local x", 0.0001);
  close(torsoLocalCenter.y, 150, "inverse matrix local y", 0.0001);

  const rigBounds = subtreeBounds(frame0, "rig.root");
  assert.ok(rigBounds && rigBounds.width > torso0.worldBounds.width && rigBounds.height >= torso0.worldBounds.height, "subtree bounds must union drawable descendants");
  const surface = planOffscreenSurface({ x: 0.25, y: 1.5, width: 10.2, height: 20.2 }, 2);
  assert.deepEqual(surface, { originX: -2, originY: -1, width: 15, height: 25, pixelCount: 375 });
  assert.throws(
    () => planOffscreenSurface({ x: 0, y: 0, width: 9_000, height: 1 }),
    /exceeds dimension limit/,
    "offscreen surfaces must reject dimension explosions",
  );

  const frame1 = evaluateScene(scene, 1);
  const elbow1 = pointAt(frame1, "bone.elbow");
  const wrist1 = pointAt(frame1, "bone.wrist");
  close(elbow1.x, 682.7817, "elbow x at t=1");
  close(elbow1.y, 797.7817, "elbow y at t=1");
  close(wrist1.x, 756.5054, "wrist x at t=1");
  close(wrist1.y, 746.1598, "wrist y at t=1");
  const prop1 = frame1.find(({ node }) => node.id === "part.prop");
  assert.ok(prop1);
  close(prop1.worldOpacity, 0.65, "prop inherited opacity at t=1");

  const inheritanceScene = structuredClone(scene);
  const independentForearm = inheritanceScene.nodes.find((node) => node.id === "part.forearm");
  const independentProp = inheritanceScene.nodes.find((node) => node.id === "part.prop");
  assert.ok(independentForearm && independentProp);
  independentForearm.inheritRotation = false;
  independentProp.inheritOpacity = false;
  const independentFrame = evaluateScene(inheritanceScene, 1);
  const independentForearmResult = independentFrame.find(({ node }) => node.id === "part.forearm");
  const independentPropResult = independentFrame.find(({ node }) => node.id === "part.prop");
  assert.ok(independentForearmResult && independentPropResult);
  close(independentForearmResult.worldMatrix.b, 0, "inheritRotation=false orientation", 0.0001);
  close(independentPropResult.worldOpacity, 1, "inheritOpacity=false isolation");

  const frame15 = evaluateScene(scene, 1.5);
  const root15 = frame15.find(({ node }) => node.id === "rig.root");
  assert.ok(root15);
  assert.ok(root15.transform.flipX, "discrete flip track must switch at its exact key time");
  assert.ok(root15.worldMatrix.a < 0, "flipX must produce a reflected root matrix");

  const geometrySource = parseMotionProjectV2(JSON.parse(await readFile(
    resolve(fixturesRoot, "projects", "geometry-paths.mt.json"),
    "utf8",
  )));
  const geometryRuntime = compileMotionProject(geometrySource);
  const geometryScene = geometryRuntime.scenes[0]!;
  const geometryFrame = evaluateScene(geometryScene, 1);
  const rounded = geometryScene.nodes.find((node) => node.id === "shape.rounded-rectangle");
  const openPath = geometryFrame.find(({ node }) => node.id === "path.open-cubic");
  const polygon = geometryFrame.find(({ node }) => node.id === "shape.polygon");
  assert.ok(rounded && openPath && polygon);
  close(Number(evaluateProperty(geometryScene, rounded, "payload.cornerRadius", 1, 0)), 62, "animated corner radius", 0.0001);
  assert.equal(evaluateProperty(geometryScene, rounded, "style.fill", 1, ""), "#fb7185", "discrete Shape fill animation");
  close(Number(evaluateProperty(geometryScene, openPath.node, "style.strokeWidth", 1, 0)), 22.25, "animated Path stroke width", 0.0001);
  close(polygon.worldBounds.x, 104, "polygon stroke-inflated bounds x");
  close(polygon.worldBounds.y, 504, "polygon stroke-inflated bounds y");
  close(polygon.worldBounds.width, 332, "polygon stroke-inflated bounds width");
  close(polygon.worldBounds.height, 282, "polygon stroke-inflated bounds height");
  assert.ok(openPath.worldBounds.x < 500 && openPath.worldBounds.x + openPath.worldBounds.width > 920, "open Path bounds must include animated stroke");
  const curveBounds = cubicBezierBounds(
    { x: 0, y: 170 },
    { x: 90, y: -80 },
    { x: 180, y: 300 },
    { x: 280, y: 80 },
  );
  assert.ok(curveBounds.y > -80 && curveBounds.y <= 80, "cubic bounds must use the true minimum, not the control hull");
  assert.ok(curveBounds.y + curveBounds.height < 300, "cubic bounds must use the true maximum, not the control hull");

  await mkdir(outputRoot, { recursive: true });
  assert.deepEqual((await readdir(expectedFrameRoot)).filter((file) => file.endsWith(".png")).sort(), frameGoldens.map(({ file }) => file).sort(), "Stored frame golden set changed");
  const hashes = new Set<string>();
  for (const golden of frameGoldens) {
    const targetRuntime = golden.project === "geometry" ? geometryRuntime : runtime;
    const png = drawSceneFrame(targetRuntime.scenes[0]!, targetRuntime.metadata, targetRuntime.assets, golden.time, golden.width, golden.height, fixturesRoot);
    hashes.add(createHash("sha256").update(png).digest("hex"));
    await writeFile(resolve(outputRoot, golden.file), png);
    await assertFrameGolden(png, golden.file);
    if (golden.project === "hierarchy" && golden.time === 0) {
      for (const [name, color] of [
        ["torso", [231, 76, 60]],
        ["upper arm", [52, 152, 219]],
        ["forearm", [46, 204, 113]],
        ["hand", [244, 208, 63]],
        ["prop", [155, 89, 182]],
      ] as const) {
        assert.ok(await countColor(png, color) >= 3, `${name} SVG pixels missing from rendered fixture`);
      }
    }
    if (golden.project === "geometry") {
      assert.ok(await countColor(png, [251, 113, 133]) >= 100, "animated rounded-rectangle fill pixels missing");
      assert.ok(await countColor(png, [250, 204, 21]) >= 100, "polygon fill pixels missing");
      assert.ok(await countColor(png, [168, 85, 247]) >= 100, "evenodd Path fill pixels missing");
      assert.deepEqual(await pixelAt(png, 410, 430), [16, 24, 40, 255], "evenodd inner contour must leave a transparent hole over the scene background");
    }
  }
  assert.equal(hashes.size, 4, "All primitive preview frames must be visually distinct");

  console.log("OK world transforms, pivot chain, inherit flags and discrete flip");
  console.log("OK world bounds, inverse transforms, draw-order hit-test and offscreen budgets");
  console.log("OK deterministic frame clock, random-access seed and stored PNG pixel goldens");
  console.log("OK SVG torso, limb, hand and attached prop pixels rendered");
  console.log("OK Shape/Path geometry, cubic bounds, animated paint and evenodd holes rendered");
  console.log(`Preview frames: ${outputRoot}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
