import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, loadImage } from "@napi-rs/canvas";

import { compileMotionProject } from "../apps/render-worker/src/compiler/index";
import {
  drawProjectFrame,
  drawSceneFrame,
} from "../apps/render-worker/src/runtime/draw";
import {
  buildFramePlan,
  projectDuration,
  projectFrameLayers,
} from "../apps/render-worker/src/runtime/frame-plan";
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
  samplePathContour,
  subtreeBounds,
  pathMorphContours,
} from "../packages/motion-runtime/src/index";
import { segmentTextUnits } from "../packages/motion-protocol/src/index";
import {
  parseMotionComponentV2,
  parseMotionProjectV2,
} from "../packages/motion-protocol/src/compat/parse-v2";
import { MotionRuntimeProjectSchema } from "../packages/motion-protocol/src/runtime/project";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixturesRoot = resolve(repoRoot, "docs", "fixtures", "v2");
const outputRoot = resolve(repoRoot, "tmp", "primitive-previews");
const expectedFrameRoot = resolve(fixturesRoot, "expected-frames");
const frameGoldens = [
  {
    project: "hierarchy",
    time: 0,
    file: "hierarchy-transform-t0.png",
    width: 270,
    height: 480,
  },
  {
    project: "hierarchy",
    time: 1,
    file: "hierarchy-transform-t1.png",
    width: 270,
    height: 480,
  },
  {
    project: "hierarchy",
    time: 1.5,
    file: "hierarchy-transform-t1_5.png",
    width: 270,
    height: 480,
  },
  {
    project: "geometry",
    time: 1,
    file: "geometry-paths-t1.png",
    width: 540,
    height: 540,
  },
  {
    project: "mask",
    time: 0,
    file: "mask-compositing-t0.png",
    width: 540,
    height: 540,
  },
  {
    project: "repeater",
    time: 1,
    file: "repeater-layouts-t1.png",
    width: 540,
    height: 540,
  },
  {
    project: "text-animator",
    time: 1.5,
    file: "text-animator-unicode-t1_5.png",
    width: 540,
    height: 540,
  },
  {
    project: "motion-path",
    time: 0,
    file: "motion-path-t0.png",
    width: 540,
    height: 540,
  },
  {
    project: "motion-path",
    time: 1,
    file: "motion-path-t1.png",
    width: 540,
    height: 540,
  },
  {
    project: "motion-path",
    time: 2,
    file: "motion-path-t2.png",
    width: 540,
    height: 540,
  },
  {
    project: "effects",
    time: 0.5,
    file: "effects-stack-t0_5.png",
    width: 540,
    height: 540,
  },
  {
    project: "path-morph",
    time: 0,
    file: "path-morph-t0.png",
    width: 540,
    height: 540,
  },
  {
    project: "path-morph",
    time: 1,
    file: "path-morph-t1.png",
    width: 540,
    height: 540,
  },
  {
    project: "path-morph",
    time: 2,
    file: "path-morph-t2.png",
    width: 540,
    height: 540,
  },
  {
    project: "secondary-motion",
    time: 0.5,
    file: "bone-secondary-motion-t0_5.png",
    width: 540,
    height: 540,
  },
  {
    project: "secondary-motion",
    time: 1.5,
    file: "bone-secondary-motion-t1_5.png",
    width: 540,
    height: 540,
  },
  {
    project: "camera-transition",
    time: 0,
    file: "camera-transition-t0.png",
    width: 540,
    height: 540,
  },
  {
    project: "camera-transition",
    time: 1.5,
    file: "camera-transition-t1_5.png",
    width: 540,
    height: 540,
  },
  {
    project: "trim-path",
    time: 1,
    file: "trim-path-reveal-t1.png",
    width: 540,
    height: 540,
  },
  {
    project: "blend-mode",
    time: 1,
    file: "blend-mode-glow-t1.png",
    width: 540,
    height: 540,
  },
  {
    project: "path-bend",
    time: 1,
    file: "path-bend-ribbon-t1.png",
    width: 540,
    height: 540,
  },
  {
    project: "accept-process-trim",
    time: 1,
    file: "accept-process-trim-t1.png",
    width: 540,
    height: 540,
  },
  {
    project: "accept-bignumber-paint",
    time: 1,
    file: "accept-bignumber-paint-t1.png",
    width: 540,
    height: 540,
  },
  {
    project: "accept-compare-blend",
    time: 1,
    file: "accept-compare-blend-t1.png",
    width: 540,
    height: 540,
  },
  {
    project: "accept-tvc-hook",
    time: 1,
    file: "accept-tvc-hook-t1.png",
    width: 270,
    height: 480,
  },
  {
    project: "accept-showcase-lookat",
    time: 1,
    file: "accept-showcase-lookat-t1.png",
    width: 540,
    height: 540,
  },
  {
    project: "accept-ribbon-promo",
    time: 1,
    file: "accept-ribbon-promo-t1.png",
    width: 540,
    height: 540,
  },
  {
    project: "accept-cutout-talk",
    time: 1,
    file: "accept-cutout-talk-t1.png",
    width: 540,
    height: 540,
  },
  {
    project: "accept-prop-mask",
    time: 1,
    file: "accept-prop-mask-t1.png",
    width: 270,
    height: 480,
  },
  {
    project: "accept-look-at",
    time: 1,
    file: "accept-look-at-t1.png",
    width: 540,
    height: 540,
  },
  {
    project: "accept-secondary-wave",
    time: 1,
    file: "accept-secondary-wave-t1.png",
    width: 540,
    height: 540,
  },
  {
    project: "accept-path-morph",
    time: 1,
    file: "accept-path-morph-t1.png",
    width: 540,
    height: 540,
  },
  {
    project: "accept-action-loop",
    time: 1,
    file: "accept-action-loop-t1.png",
    width: 540,
    height: 540,
  },
] as const;

function close(
  actual: number,
  expected: number,
  label: string,
  tolerance = 0.02,
): void {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected}, received ${actual}`,
  );
}

function pointAt(
  evaluated: ReturnType<typeof evaluateScene>,
  nodeId: string,
): { x: number; y: number } {
  const item = evaluated.find(({ node }) => node.id === nodeId);
  assert.ok(item, `Evaluated node missing: ${nodeId}`);
  return applyMatrix(item.worldMatrix, 0, 0);
}

async function countColor(
  png: Buffer,
  expected: [number, number, number],
  tolerance = 8,
): Promise<number> {
  const image = await loadImage(png);
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, image.width, image.height).data;
  let count = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    if (
      Math.abs(pixels[index]! - expected[0]) <= tolerance &&
      Math.abs(pixels[index + 1]! - expected[1]) <= tolerance &&
      Math.abs(pixels[index + 2]! - expected[2]) <= tolerance &&
      pixels[index + 3]! > 0
    )
      count += 1;
  }
  return count;
}

async function pixelAt(
  png: Buffer,
  x: number,
  y: number,
): Promise<[number, number, number, number]> {
  const image = await loadImage(png);
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  const pixel = context.getImageData(x, y, 1, 1).data;
  return [pixel[0]!, pixel[1]!, pixel[2]!, pixel[3]!];
}

async function assertFrameGolden(
  actual: Buffer,
  file: string,
  tolerance = 2,
): Promise<void> {
  const expected = await readFile(resolve(expectedFrameRoot, file));
  const [actualImage, expectedImage] = await Promise.all([
    loadImage(actual),
    loadImage(expected),
  ]);
  assert.equal(actualImage.width, expectedImage.width, `${file} width changed`);
  assert.equal(
    actualImage.height,
    expectedImage.height,
    `${file} height changed`,
  );
  const actualCanvas = createCanvas(actualImage.width, actualImage.height);
  const expectedCanvas = createCanvas(
    expectedImage.width,
    expectedImage.height,
  );
  const actualContext = actualCanvas.getContext("2d");
  const expectedContext = expectedCanvas.getContext("2d");
  actualContext.drawImage(actualImage, 0, 0);
  expectedContext.drawImage(expectedImage, 0, 0);
  const actualPixels = actualContext.getImageData(
    0,
    0,
    actualImage.width,
    actualImage.height,
  ).data;
  const expectedPixels = expectedContext.getImageData(
    0,
    0,
    expectedImage.width,
    expectedImage.height,
  ).data;
  const diffCanvas = createCanvas(actualImage.width, actualImage.height);
  const diffContext = diffCanvas.getContext("2d");
  const diff = diffContext.createImageData(
    actualImage.width,
    actualImage.height,
  );
  let changedPixels = 0;
  for (let index = 0; index < actualPixels.length; index += 4) {
    const changed = [0, 1, 2, 3].some(
      (channel) =>
        Math.abs(
          actualPixels[index + channel]! - expectedPixels[index + channel]!,
        ) > tolerance,
    );
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
    throw new Error(
      `${file} differs by ${changedPixels} pixels (tolerance ${tolerance}); diff: ${diffFile}`,
    );
  }
}

async function main(): Promise<void> {
  assert.deepEqual(frameTimestamp(30, 30), {
    frameIndex: 30,
    fps: 30,
    time: 1,
  });
  assert.equal(frameIndexAtTime(0.999, 30), 29);
  assert.throws(() => frameTimestamp(-1, 30), /Frame index/);
  const randomSample = deterministicRandom(
    "fixture-seed",
    "secondary-motion",
    42,
  );
  assert.equal(
    randomSample,
    deterministicRandom("fixture-seed", "secondary-motion", 42),
    "seeded random sample must repeat exactly",
  );
  assert.notEqual(
    randomSample,
    deterministicRandom("fixture-seed", "secondary-motion", 41),
    "sample index must create an independent random-access value",
  );
  assert.ok(randomSample >= 0 && randomSample < 1);

  const source = parseMotionProjectV2(
    JSON.parse(
      await readFile(
        resolve(fixturesRoot, "projects", "hierarchy-transform.mt.json"),
        "utf8",
      ),
    ),
  );
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
  assert.equal(
    overlapHits[0]?.node.id,
    "part.upper-arm",
    "hit-test must return the highest draw-order node first",
  );
  assert.ok(
    overlapHits.some(({ node }) => node.id === "part.torso"),
    "hit-test must retain lower overlapping drawables",
  );
  const hiddenScene = structuredClone(scene);
  const hiddenArm = hiddenScene.nodes.find(
    (node) => node.id === "part.upper-arm",
  );
  assert.ok(hiddenArm);
  hiddenArm.transform.visible = false;
  assert.equal(
    hitTestScene(hiddenScene, 0, { x: 620, y: 720 })[0]?.node.id,
    "part.torso",
    "hidden nodes must not capture hit-tests",
  );

  const torsoInverse = invertMatrix(torso0.worldMatrix);
  assert.ok(torsoInverse);
  const torsoWorldCenter = applyMatrix(torso0.worldMatrix, 90, 150);
  const torsoLocalCenter = applyMatrix(
    torsoInverse,
    torsoWorldCenter.x,
    torsoWorldCenter.y,
  );
  close(torsoLocalCenter.x, 90, "inverse matrix local x", 0.0001);
  close(torsoLocalCenter.y, 150, "inverse matrix local y", 0.0001);

  const rigBounds = subtreeBounds(frame0, "rig.root");
  assert.ok(
    rigBounds &&
      rigBounds.width > torso0.worldBounds.width &&
      rigBounds.height >= torso0.worldBounds.height,
    "subtree bounds must union drawable descendants",
  );
  const surface = planOffscreenSurface(
    { x: 0.25, y: 1.5, width: 10.2, height: 20.2 },
    2,
  );
  assert.deepEqual(surface, {
    originX: -2,
    originY: -1,
    width: 15,
    height: 25,
    pixelCount: 375,
  });
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
  const independentForearm = inheritanceScene.nodes.find(
    (node) => node.id === "part.forearm",
  );
  const independentProp = inheritanceScene.nodes.find(
    (node) => node.id === "part.prop",
  );
  assert.ok(independentForearm && independentProp);
  independentForearm.inheritRotation = false;
  independentProp.inheritOpacity = false;
  const independentFrame = evaluateScene(inheritanceScene, 1);
  const independentForearmResult = independentFrame.find(
    ({ node }) => node.id === "part.forearm",
  );
  const independentPropResult = independentFrame.find(
    ({ node }) => node.id === "part.prop",
  );
  assert.ok(independentForearmResult && independentPropResult);
  close(
    independentForearmResult.worldMatrix.b,
    0,
    "inheritRotation=false orientation",
    0.0001,
  );
  close(
    independentPropResult.worldOpacity,
    1,
    "inheritOpacity=false isolation",
  );

  const frame15 = evaluateScene(scene, 1.5);
  const root15 = frame15.find(({ node }) => node.id === "rig.root");
  assert.ok(root15);
  assert.ok(
    root15.transform.flipX,
    "discrete flip track must switch at its exact key time",
  );
  assert.ok(
    root15.worldMatrix.a < 0,
    "flipX must produce a reflected root matrix",
  );

  const geometrySource = parseMotionProjectV2(
    JSON.parse(
      await readFile(
        resolve(fixturesRoot, "projects", "geometry-paths.mt.json"),
        "utf8",
      ),
    ),
  );
  const geometryRuntime = compileMotionProject(geometrySource);
  const geometryScene = geometryRuntime.scenes[0]!;
  const geometryFrame = evaluateScene(geometryScene, 1);
  const rounded = geometryScene.nodes.find(
    (node) => node.id === "shape.rounded-rectangle",
  );
  const openPath = geometryFrame.find(
    ({ node }) => node.id === "path.open-cubic",
  );
  const polygon = geometryFrame.find(({ node }) => node.id === "shape.polygon");
  assert.ok(rounded && openPath && polygon);
  close(
    Number(
      evaluateProperty(geometryScene, rounded, "payload.cornerRadius", 1, 0),
    ),
    62,
    "animated corner radius",
    0.0001,
  );
  assert.equal(
    evaluateProperty(geometryScene, rounded, "style.fill", 1, ""),
    "#fb7185",
    "discrete Shape fill animation",
  );
  close(
    Number(
      evaluateProperty(geometryScene, openPath.node, "style.strokeWidth", 1, 0),
    ),
    22.25,
    "animated Path stroke width",
    0.0001,
  );
  close(polygon.worldBounds.x, 104, "polygon stroke-inflated bounds x");
  close(polygon.worldBounds.y, 504, "polygon stroke-inflated bounds y");
  close(polygon.worldBounds.width, 332, "polygon stroke-inflated bounds width");
  close(
    polygon.worldBounds.height,
    282,
    "polygon stroke-inflated bounds height",
  );
  assert.ok(
    openPath.worldBounds.x < 500 &&
      openPath.worldBounds.x + openPath.worldBounds.width > 920,
    "open Path bounds must include animated stroke",
  );
  const curveBounds = cubicBezierBounds(
    { x: 0, y: 170 },
    { x: 90, y: -80 },
    { x: 180, y: 300 },
    { x: 280, y: 80 },
  );
  assert.ok(
    curveBounds.y > -80 && curveBounds.y <= 80,
    "cubic bounds must use the true minimum, not the control hull",
  );
  assert.ok(
    curveBounds.y + curveBounds.height < 300,
    "cubic bounds must use the true maximum, not the control hull",
  );

  const maskSource = parseMotionProjectV2(
    JSON.parse(
      await readFile(
        resolve(fixturesRoot, "projects", "mask-compositing.mt.json"),
        "utf8",
      ),
    ),
  );
  const maskRuntime = compileMotionProject(maskSource);
  const maskScene = maskRuntime.scenes[0]!;
  const alphaHitsOutside = hitTestScene(maskScene, 0, { x: 80, y: 80 });
  assert.ok(
    !alphaHitsOutside.some(({ node }) => node.id === "content.alpha"),
    "alpha-masked content must not hit outside mask bounds",
  );
  const alphaHitsInside = hitTestScene(maskScene, 0, { x: 200, y: 200 });
  assert.ok(
    alphaHitsInside.some(({ node }) => node.id === "content.alpha"),
    "alpha-masked content must hit inside mask bounds",
  );
  assert.ok(
    !alphaHitsInside.some(({ node }) => node.id === "mask.alpha"),
    "mask-only source must not capture hit-tests",
  );

  const repeaterComponent = parseMotionComponentV2(
    JSON.parse(
      await readFile(
        resolve(fixturesRoot, "components", "repeater-layouts.mvc.json"),
        "utf8",
      ),
    ),
  );
  const repeaterSource = parseMotionProjectV2(
    JSON.parse(
      await readFile(
        resolve(fixturesRoot, "projects", "repeater-layouts.mt.json"),
        "utf8",
      ),
    ),
  );
  const repeaterRuntime = compileMotionProject(repeaterSource, {
    components: [repeaterComponent],
  });
  const graphemes = segmentTextUnits("Á 👨‍👩‍👧‍👦 Việt", "grapheme", "vi");
  assert.equal(
    graphemes[0],
    "Á",
    "combining-mark grapheme must remain one unit",
  );
  assert.equal(
    graphemes[2],
    "👨‍👩‍👧‍👦",
    "ZWJ family emoji must remain one grapheme unit",
  );
  assert.deepEqual(
    segmentTextUnits("Xin chào, Việt Nam! 👋🏽", "word", "vi"),
    ["Xin", "chào", ",", "Việt", "Nam", "!", "👋🏽"],
    "word segmentation changed",
  );
  const textAnimatorSource = parseMotionProjectV2(
    JSON.parse(
      await readFile(
        resolve(fixturesRoot, "projects", "text-animator-unicode.mt.json"),
        "utf8",
      ),
    ),
  );
  const textAnimatorRuntime = compileMotionProject(textAnimatorSource);
  const motionPathSource = parseMotionProjectV2(
    JSON.parse(
      await readFile(
        resolve(fixturesRoot, "projects", "motion-path.mt.json"),
        "utf8",
      ),
    ),
  );
  const motionPathRuntime = compileMotionProject(motionPathSource);
  const motionPathScene = motionPathRuntime.scenes[0]!;
  const guide = motionPathScene.nodes.find((node) => node.id === "guide.curve");
  assert.ok(guide?.type === "path");
  const startSample = samplePathContour(guide, "flight", 0);
  const middleSample = samplePathContour(guide, "flight", 0.5);
  const endSample = samplePathContour(guide, "flight", 1);
  assert.deepEqual(startSample.point, { x: 0, y: 280 });
  close(middleSample.point.x, 369.2367, "arc-length midpoint x", 0.02);
  close(middleSample.point.y, 205.519, "arc-length midpoint y", 0.02);
  assert.deepEqual(endSample.point, { x: 760, y: 80 });
  const rocketStates = [0, 1, 2].map(
    (time) =>
      evaluateScene(motionPathScene, time).find(
        ({ node }) => node.id === "follower.rocket",
      )!,
  );
  const rocketAnchors = rocketStates.map((state) =>
    applyMatrix(state.worldMatrix, 50, 22),
  );
  close(rocketAnchors[0]!.x, 67.6063, "Motion Path start world x");
  close(rocketAnchors[1]!.x, 460.7695, "Motion Path midpoint world x");
  close(rocketAnchors[2]!.x, 885.5921, "Motion Path end world x");
  close(
    rocketStates[1]!.transform.rotation,
    34.1693,
    "Motion Path hierarchy-relative orientation",
  );
  const duplicateModifierRuntime = structuredClone(motionPathRuntime);
  const duplicateModifierNode = duplicateModifierRuntime.scenes[0]!.nodes.find(
    (node) => node.id === "follower.rocket",
  );
  assert.ok(duplicateModifierNode?.modifiers?.[0]);
  duplicateModifierNode.modifiers.push({
    ...duplicateModifierNode.modifiers[0],
  });
  const duplicateModifierResult = MotionRuntimeProjectSchema.safeParse(
    duplicateModifierRuntime,
  );
  assert.equal(
    duplicateModifierResult.success,
    false,
    "Runtime IR must reject duplicate Motion Path modifiers",
  );
  assert.ok(
    !duplicateModifierResult.success &&
      duplicateModifierResult.error.issues.some(({ message }) =>
        message.includes("Duplicate runtime modifier id"),
      ),
  );
  const cyclicModifierRuntime = structuredClone(motionPathRuntime);
  const cyclicGuide = cyclicModifierRuntime.scenes[0]!.nodes.find(
    (node) => node.id === "guide.curve",
  );
  assert.ok(cyclicGuide?.type === "path");
  cyclicGuide.modifiers = [
    {
      id: "cycle",
      type: "motion-path",
      pathNodeId: "follower.rocket",
      contourId: "flight",
      progress: 0,
      orientToPath: false,
      rotationOffset: 0,
      startOffset: 0,
      endOffset: 1,
    },
  ];
  const cyclicModifierResult = MotionRuntimeProjectSchema.safeParse(
    cyclicModifierRuntime,
  );
  assert.equal(
    cyclicModifierResult.success,
    false,
    "Runtime IR must reject Motion Path dependency cycles",
  );
  assert.ok(
    !cyclicModifierResult.success &&
      cyclicModifierResult.error.issues.some(({ message }) =>
        message.includes("dependency cycle"),
      ),
  );

  const pathMorphSource = parseMotionProjectV2(
    JSON.parse(
      await readFile(
        resolve(fixturesRoot, "projects", "path-morph.mt.json"),
        "utf8",
      ),
    ),
  );
  const pathMorphRuntime = compileMotionProject(pathMorphSource);
  const pathMorphScene = pathMorphRuntime.scenes[0]!;
  const morphPath = pathMorphScene.nodes.find(
    (node) => node.id === "path.square-to-diamond",
  );
  assert.ok(morphPath?.type === "path");
  const morphAt = (progress: number) => pathMorphContours(morphPath, progress);
  assert.deepEqual(
    morphAt(0)[0]!.start,
    { x: 40, y: 40 },
    "Path Morph progress 0 must equal base geometry",
  );
  assert.deepEqual(
    morphAt(1)[0]!.start,
    { x: 150, y: 20 },
    "Path Morph progress 1 must equal target geometry",
  );
  assert.deepEqual(
    morphAt(0.5)[0]!.start,
    { x: 95, y: 30 },
    "Path Morph midpoint must lerp start points",
  );
  const morphProgress = [0, 1, 2].map((time) =>
    evaluateProperty(
      pathMorphScene,
      morphPath,
      "modifiers.morph.progress",
      time,
      morphPath.modifiers!.find((modifier) => modifier.type === "path-morph")!
        .progress,
    ),
  );
  assert.deepEqual(
    morphProgress,
    [0, 0.5, 1],
    "Path Morph progress track must hit 0/0.5/1",
  );

  const secondaryMotionSource = parseMotionProjectV2(
    JSON.parse(
      await readFile(
        resolve(fixturesRoot, "projects", "bone-secondary-motion.mt.json"),
        "utf8",
      ),
    ),
  );
  const secondaryMotionRuntime = compileMotionProject(secondaryMotionSource);
  const secondaryMotionScene = secondaryMotionRuntime.scenes[0]!;
  const secondaryMid = evaluateScene(secondaryMotionScene, 0.5);
  const secondaryMidAgain = evaluateScene(secondaryMotionScene, 0.5);
  const secondaryDriver = secondaryMid.find(
    ({ node }) => node.id === "bone.driver",
  );
  const secondaryChain = ["bone.a", "bone.b", "bone.c"].map((id) =>
    secondaryMid.find(({ node }) => node.id === id),
  );
  assert.ok(
    secondaryDriver && secondaryChain.every(Boolean),
    "Secondary Motion fixture bones must evaluate",
  );
  assert.ok(
    secondaryChain.some(
      (node) =>
        Math.abs(
          node!.transform.rotation - secondaryDriver!.transform.rotation,
        ) > 0.01,
    ),
    "Secondary Motion chain rotations must differ from driver",
  );
  assert.deepEqual(
    secondaryMid.map(({ transform }) => transform.rotation),
    secondaryMidAgain.map(({ transform }) => transform.rotation),
    "Secondary Motion must be random-access deterministic",
  );

  const cameraTransitionSource = parseMotionProjectV2(
    JSON.parse(
      await readFile(
        resolve(fixturesRoot, "projects", "camera-transition.mt.json"),
        "utf8",
      ),
    ),
  );
  const cameraTransitionRuntime = compileMotionProject(cameraTransitionSource);
  const cameraScene = cameraTransitionRuntime.scenes[0]!;
  const camera = cameraScene.nodes.find((node) => node.id === "camera.main");
  assert.ok(
    camera?.type === "camera",
    "Camera fixture must retain its active camera",
  );
  assert.equal(
    cameraScene.activeCameraId,
    "camera.main",
    "Runtime IR must retain active camera selection",
  );
  close(
    Number(evaluateProperty(cameraScene, camera, "payload.zoom", 1.5, 0)),
    1.225,
    "camera zoom track",
  );
  assert.equal(
    projectDuration(cameraTransitionRuntime),
    4,
    "crossfade must overlap authored durations",
  );
  assert.deepEqual(
    projectFrameLayers(cameraTransitionRuntime, 2.5).map(
      ({ sceneIndex, localTime, opacity }) => [sceneIndex, localTime, opacity],
    ),
    [
      [0, 2.5, 0.5],
      [1, 0.5, 0.5],
    ],
    "crossfade midpoint layer timing",
  );
  assert.equal(
    buildFramePlan(cameraTransitionRuntime, 30).length,
    120,
    "crossfade frame plan duration",
  );
  const cameraFrame0 = await drawSceneFrame(
    cameraScene,
    cameraTransitionRuntime.metadata,
    cameraTransitionRuntime.assets,
    0,
    540,
    540,
    fixturesRoot,
  );
  const cameraFrameMid = await drawSceneFrame(
    cameraScene,
    cameraTransitionRuntime.metadata,
    cameraTransitionRuntime.assets,
    1.5,
    540,
    540,
    fixturesRoot,
  );
  assert.notEqual(
    createHash("sha256").update(cameraFrame0).digest("hex"),
    createHash("sha256").update(cameraFrameMid).digest("hex"),
    "camera transform must change framing",
  );
  const transitionFrame = await drawProjectFrame(
    cameraTransitionRuntime,
    2.5,
    540,
    540,
    fixturesRoot,
  );
  const transitionPixel = await pixelAt(transitionFrame, 20, 20);
  assert.ok(
    transitionPixel[0] > 25 && transitionPixel[2] > 70,
    "crossfade midpoint must blend Scene A and Scene B backgrounds",
  );

  const mediaSource = parseMotionProjectV2(
    JSON.parse(
      await readFile(
        resolve(fixturesRoot, "projects", "media-assets.mt.json"),
        "utf8",
      ),
    ),
  );
  const mediaRuntime = compileMotionProject(mediaSource);
  const videoScene = structuredClone(mediaRuntime.scenes[0]!);
  const silentVideo = videoScene.nodes.find(
    (node) => node.id === "video.silent",
  );
  assert.ok(
    silentVideo?.type === "video",
    "Media fixture must include a silent video node",
  );
  silentVideo.transform = {
    ...silentVideo.transform,
    x: 540,
    y: 960,
    width: 1080,
    height: 1920,
    anchorX: 0.5,
    anchorY: 0.5,
  };
  videoScene.nodes = [silentVideo];
  videoScene.activeCameraId = undefined;
  const mediaFrame0 = await drawSceneFrame(
    videoScene,
    mediaRuntime.metadata,
    mediaRuntime.assets,
    0,
    270,
    480,
    fixturesRoot,
  );
  const mediaFrame1 = await drawSceneFrame(
    videoScene,
    mediaRuntime.metadata,
    mediaRuntime.assets,
    1,
    270,
    480,
    fixturesRoot,
  );
  const mediaFrameAfterEnd = await drawSceneFrame(
    videoScene,
    mediaRuntime.metadata,
    mediaRuntime.assets,
    3.8,
    270,
    480,
    fixturesRoot,
  );
  assert.notEqual(
    createHash("sha256").update(mediaFrame0).digest("hex"),
    createHash("sha256").update(mediaFrame1).digest("hex"),
    "video frame sampling must advance at deterministic timestamps",
  );
  assert.notEqual(
    createHash("sha256").update(mediaFrame1).digest("hex"),
    createHash("sha256").update(mediaFrameAfterEnd).digest("hex"),
    "video trim hold frame must differ from an in-range frame",
  );

  await mkdir(outputRoot, { recursive: true });
  assert.deepEqual(
    (await readdir(expectedFrameRoot))
      .filter((file) => file.endsWith(".png"))
      .sort(),
    frameGoldens.map(({ file }) => file).sort(),
    "Stored frame golden set changed",
  );
  const componentRoot = resolve(fixturesRoot, "components");
  const acceptanceComponents = await Promise.all(
    (await readdir(componentRoot))
      .filter((file) => file.endsWith(".json"))
      .map(async (file) =>
        parseMotionComponentV2(
          JSON.parse(await readFile(resolve(componentRoot, file), "utf8")),
        ),
      ),
  );
  const acceptanceRuntimes = new Map<
    string,
    ReturnType<typeof compileMotionProject>
  >();
  async function runtimeForAccept(stem: string) {
    let compiled = acceptanceRuntimes.get(stem);
    if (!compiled) {
      const source = parseMotionProjectV2(
        JSON.parse(
          await readFile(
            resolve(fixturesRoot, "projects", `${stem}.mt.json`),
            "utf8",
          ),
        ),
      );
      compiled = compileMotionProject(source, {
        components: acceptanceComponents,
      });
      acceptanceRuntimes.set(stem, compiled);
    }
    return compiled;
  }
  const hashes = new Set<string>();
  for (const golden of frameGoldens) {
    const targetRuntime =
      golden.project === "geometry"
        ? geometryRuntime
        : golden.project === "mask"
          ? maskRuntime
          : golden.project === "repeater"
            ? repeaterRuntime
            : golden.project === "text-animator"
              ? textAnimatorRuntime
              : golden.project === "motion-path"
                ? motionPathRuntime
                : golden.project === "effects"
                  ? compileMotionProject(
                      parseMotionProjectV2(
                        JSON.parse(
                          await readFile(
                            resolve(
                              fixturesRoot,
                              "projects",
                              "effects-stack.mt.json",
                            ),
                            "utf8",
                          ),
                        ),
                      ),
                    )
                  : golden.project === "path-morph"
                    ? pathMorphRuntime
                    : golden.project === "secondary-motion"
                      ? secondaryMotionRuntime
                      : golden.project === "camera-transition"
                        ? cameraTransitionRuntime
                        : golden.project === "trim-path"
                          ? compileMotionProject(
                              parseMotionProjectV2(
                                JSON.parse(
                                  await readFile(
                                    resolve(
                                      fixturesRoot,
                                      "projects",
                                      "trim-path-reveal.mt.json",
                                    ),
                                    "utf8",
                                  ),
                                ),
                              ),
                            )
                          : golden.project === "blend-mode"
                            ? compileMotionProject(
                                parseMotionProjectV2(
                                  JSON.parse(
                                    await readFile(
                                      resolve(
                                        fixturesRoot,
                                        "projects",
                                        "blend-mode-glow.mt.json",
                                      ),
                                      "utf8",
                                    ),
                                  ),
                                ),
                              )
                            : golden.project === "path-bend"
                              ? compileMotionProject(
                                  parseMotionProjectV2(
                                    JSON.parse(
                                      await readFile(
                                        resolve(
                                          fixturesRoot,
                                          "projects",
                                          "path-bend-ribbon.mt.json",
                                        ),
                                        "utf8",
                                      ),
                                    ),
                                  ),
                                )
                              : golden.project.startsWith("accept-")
                                ? await runtimeForAccept(golden.project)
                                : runtime;
    const png = await drawSceneFrame(
      targetRuntime.scenes[0]!,
      targetRuntime.metadata,
      targetRuntime.assets,
      golden.time,
      golden.width,
      golden.height,
      fixturesRoot,
    );
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
        assert.ok(
          (await countColor(png, color)) >= 3,
          `${name} SVG pixels missing from rendered fixture`,
        );
      }
    }
    if (golden.project === "geometry") {
      assert.ok(
        (await countColor(png, [251, 113, 133])) >= 100,
        "animated rounded-rectangle fill pixels missing",
      );
      assert.ok(
        (await countColor(png, [250, 204, 21])) >= 100,
        "polygon fill pixels missing",
      );
      assert.ok(
        (await countColor(png, [168, 85, 247])) >= 100,
        "evenodd Path fill pixels missing",
      );
      assert.deepEqual(
        await pixelAt(png, 410, 430),
        [16, 24, 40, 255],
        "evenodd inner contour must leave a transparent hole over the scene background",
      );
    }
    if (golden.project === "mask") {
      assert.ok(
        (await countColor(png, [250, 204, 21])) >= 100,
        "clip mask content pixels missing",
      );
      assert.ok(
        (await countColor(png, [168, 85, 247])) >= 100,
        "nested mask content pixels missing",
      );
      assert.deepEqual(
        await pixelAt(png, 365, 110),
        [16, 24, 40, 255],
        "inverse-alpha center must cut a hole to the scene background",
      );
      const alphaPixel = await pixelAt(png, 110, 110);
      assert.ok(
        alphaPixel[0] > 100 && alphaPixel[0] < 239,
        "alpha mask must preserve source opacity instead of acting as binary clip",
      );
    }
    if (golden.project === "repeater") {
      assert.ok(
        (await countColor(png, [20, 184, 166])) >= 100,
        "grid Repeater pixels missing",
      );
      assert.ok(
        (await countColor(png, [168, 85, 247])) >= 100,
        "radial Repeater pixels missing",
      );
      assert.ok(
        (await countColor(png, [249, 115, 22])) >= 100,
        "list context-bound Repeater pixels missing",
      );
    }
    if (golden.project === "text-animator") {
      assert.ok(
        (await countColor(png, [248, 250, 252])) >= 20,
        "grapheme Text Animator pixels missing",
      );
      assert.ok(
        (await countColor(png, [96, 165, 250])) >= 20,
        "word Text Animator pixels missing",
      );
      assert.ok(
        (await countColor(png, [250, 204, 21])) >= 20,
        "line Text Animator pixels missing",
      );
    }
    if (golden.project === "motion-path") {
      assert.ok(
        (await countColor(png, [249, 115, 22])) >= 20,
        "Motion Path follower pixels missing",
      );
      assert.ok(
        (await countColor(png, [168, 85, 247])) >= 20,
        "Motion Path offset follower pixels missing",
      );
    }
    if (golden.project === "effects") {
      assert.ok(
        (await countColor(png, [239, 68, 68], 32)) >= 100,
        "Effects source pixels missing",
      );
      assert.ok(
        (await countColor(png, [59, 130, 246], 32)) >= 100,
        "Effects reordered pixels missing",
      );
      assert.ok(
        (await countColor(png, [168, 85, 247], 32)) >= 100,
        "Masked effects pixels missing",
      );
    }
    if (golden.project === "path-morph") {
      assert.ok(
        (await countColor(png, [239, 68, 68])) >= 100,
        "Path Morph filled silhouette pixels missing",
      );
      assert.ok(
        (await countColor(png, [56, 189, 248])) >= 20,
        "Path Morph stroke silhouette pixels missing",
      );
    }
  }
  assert.equal(
    hashes.size,
    frameGoldens.length,
    "All primitive preview frames must be visually distinct",
  );

  console.log(
    "OK world transforms, pivot chain, inherit flags and discrete flip",
  );
  console.log(
    "OK world bounds, inverse transforms, draw-order hit-test and offscreen budgets",
  );
  console.log(
    "OK deterministic frame clock, random-access seed and stored PNG pixel goldens",
  );
  console.log("OK SVG torso, limb, hand and attached prop pixels rendered");
  console.log(
    "OK Shape/Path geometry, cubic bounds, animated paint and evenodd holes rendered",
  );
  console.log(
    "OK clip/alpha/inverse-alpha masks, nested masks and mask-aware hit testing",
  );
  console.log(
    "OK Repeater vNext list/count/linear/grid/radial visual expansion",
  );
  console.log(
    "OK Unicode Text Animator grapheme/word/line expansion and visual runs",
  );
  console.log(
    "OK Motion Path arc length, offsets, cross-hierarchy position and orientation",
  );
  console.log(
    "OK ordered effects stack, animated properties and mask-before-effects rendering",
  );
  console.log("OK Path Morph topology interpolation at progress 0/0.5/1");
  console.log(
    "OK Secondary Motion chain follow-through and random-access evaluation",
  );
  console.log(
    "OK camera projection tracks, overlap timing and crossfade compositing",
  );
  console.log(
    "OK video trim/hold frame sampling and silent/audio pixel decoding",
  );
  console.log(`Preview frames: ${outputRoot}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
