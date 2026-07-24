import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, loadImage } from "@napi-rs/canvas";

import { compileMotionProject } from "../apps/render-worker/src/compiler/index";
import { drawSceneFrame } from "../apps/render-worker/src/runtime/draw";
import { applyMatrix, evaluateScene } from "../packages/motion-runtime/src/index";
import { parseMotionProjectV2 } from "../packages/motion-schema/src/index";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixturesRoot = resolve(repoRoot, "docs", "fixtures", "v2");
const outputRoot = resolve(repoRoot, "tmp", "primitive-previews");

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

async function main(): Promise<void> {
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

  await mkdir(outputRoot, { recursive: true });
  const hashes = new Set<string>();
  for (const time of [0, 1, 1.5]) {
    const png = drawSceneFrame(scene, runtime.metadata, runtime.assets, time, 270, 480, fixturesRoot);
    hashes.add(createHash("sha256").update(png).digest("hex"));
    await writeFile(resolve(outputRoot, `hierarchy-transform-t${String(time).replace(".", "_")}.png`), png);
    if (time === 0) {
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
  }
  assert.equal(hashes.size, 3, "The three primitive preview frames must be visually distinct");

  console.log("OK world transforms, pivot chain, inherit flags and discrete flip");
  console.log("OK SVG torso, limb, hand and attached prop pixels rendered");
  console.log(`Preview frames: ${outputRoot}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
