/**
 * P6 paint-path gate: shared evaluateFrame → paint-canvas must produce a valid PNG
 * and be deterministic. Legacy draw.ts remains the default export path until goldens migrate.
 *
 * Usage: pnpm validate:paint-parity
 */

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateFrame, type RuntimeScene } from "@motionvideo/motion-runtime";
import { drawSceneFrame } from "../apps/render-worker/src/runtime/draw";
import { drawSceneFramePaint } from "../apps/render-worker/src/runtime/paint-canvas";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function fixtureScene(): RuntimeScene {
  return {
    id: "scene.paint_parity",
    duration: 1,
    nodes: [
      {
        id: "bg",
        type: "shape",
        parentLayerId: null,
        zIndex: 0,
        transform: {
          x: 0,
          y: 0,
          width: 320,
          height: 180,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          opacity: 1,
          visible: true,
          anchorX: 0,
          anchorY: 0,
          flipX: false,
          flipY: false,
        },
        payload: { shape: "rectangle" },
        style: { fill: "#1877F2" },
      },
      {
        id: "title",
        type: "text",
        parentLayerId: null,
        zIndex: 1,
        transform: {
          x: 24,
          y: 64,
          width: 272,
          height: 48,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          opacity: 1,
          visible: true,
          anchorX: 0,
          anchorY: 0,
          flipX: false,
          flipY: false,
        },
        payload: { text: "Paint", fontSize: 32, fontWeight: 700, align: "left" },
        style: { fill: "#ffffff" },
      },
      {
        id: "curve",
        type: "path",
        parentLayerId: null,
        zIndex: 2,
        transform: {
          x: 0,
          y: 0,
          width: 320,
          height: 180,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          opacity: 1,
          visible: true,
          anchorX: 0,
          anchorY: 0,
          flipX: false,
          flipY: false,
        },
        payload: {
          contours: [
            {
              id: "c1",
              start: { x: 40, y: 140 },
              closed: false,
              segments: [{ kind: "line", to: { x: 280, y: 140 } }],
            },
          ],
          fillRule: "nonzero",
        },
        style: { stroke: "#ffffff", strokeWidth: 3 },
      },
    ],
    tracks: [],
  } as unknown as RuntimeScene;
}

async function main(): Promise<void> {
  const scene = fixtureScene();
  const width = 320;
  const height = 180;
  const time = 0;
  const metadata = {
    id: "paint_parity",
    title: "Paint parity",
    aspectRatio: "16:9" as const,
    fps: 24,
    brand: { name: "MotiClip", primaryColor: "#0f172a" },
  };

  const evaluated = evaluateFrame({
    scene,
    frame: 0,
    time,
    width,
    height,
    background: "#0f172a",
  });
  const ops = evaluated.paint.commands.map((c) => c.op);
  if (!ops.includes("drawShape") || !ops.includes("drawText") || !ops.includes("drawPath")) {
    throw new Error(`Missing paint ops: ${ops.join(",")}`);
  }

  const paintPng = await drawSceneFramePaint(
    scene,
    metadata,
    [],
    time,
    width,
    height,
    repoRoot,
  );
  const paintPng2 = await drawSceneFramePaint(
    scene,
    metadata,
    [],
    time,
    width,
    height,
    repoRoot,
  );

  if (paintPng.length < 100 || paintPng[0] !== 0x89) {
    throw new Error("Paint PNG invalid");
  }

  const hash = createHash("sha256").update(paintPng).digest("hex");
  const hash2 = createHash("sha256").update(paintPng2).digest("hex");
  if (hash !== hash2) {
    throw new Error("Paint path is not deterministic across two runs");
  }

  const legacyPng = await drawSceneFrame(
    scene,
    metadata,
    [],
    time,
    width,
    height,
    repoRoot,
  );
  if (legacyPng.length < 100) {
    throw new Error("Legacy PNG invalid");
  }

  const outDir = path.join(repoRoot, "tmp", "paint-parity");
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "paint.png"), paintPng);
  await writeFile(path.join(outDir, "legacy.png"), legacyPng);

  console.log(
    JSON.stringify({
      ok: true,
      deterministic: true,
      paintBytes: paintPng.length,
      paintSha16: hash.slice(0, 16),
      ops: ops.filter((op) => op.startsWith("draw")),
    }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
