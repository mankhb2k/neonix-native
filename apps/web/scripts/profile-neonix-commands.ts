import { readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { prepareRuntimeProjectV3, evaluatePreparedRuntimeProjectV3, type PaintCommand } from "@motionvideo/motion-runtime";

async function main(): Promise<void> {
  const cwd = resolve(process.cwd());
  const root = basename(cwd).toLowerCase() === "web" ? resolve(cwd, "../..") : cwd;
  const runtime = JSON.parse(await readFile(join(root, "tmp", "neonix-overview-60s.runtime.json"), "utf8"));
  const prepared = prepareRuntimeProjectV3(runtime);
  const pathSignatures = new Map<string, Set<string>>();
  for (let frame = 0; frame < 300; frame += 1) {
    const buffer = evaluatePreparedRuntimeProjectV3(prepared, frame);
    for (const command of buffer.commands as PaintCommand[]) {
      if (command.op !== "drawPath") continue;
      const signatures = pathSignatures.get(command.key) ?? new Set<string>();
      signatures.add(JSON.stringify(command.contours));
      pathSignatures.set(command.key, signatures);
    }
  }
  console.log(JSON.stringify({ pathSignatureCounts: Object.fromEntries([...pathSignatures].map(([key, signatures]) => [key, signatures.size])) }));
  for (const frame of [0, 300, 900, 1500, 1799]) {
    const buffer = evaluatePreparedRuntimeProjectV3(prepared, frame);
    const counts = new Map<string, number>();
    let glyphs = 0;
    let pathBytes = 0;
    let effectOps = 0;
    let nativeEligibleGlyphs = 0;
    let drawPathBytes = 0;
    const fillPaintTypes = new Map<string, number>();
    const layerFlags: Array<Record<string, unknown>> = [];
    for (const command of buffer.commands as PaintCommand[]) {
      counts.set(command.op, (counts.get(command.op) ?? 0) + 1);
      if (command.op === "drawText") {
        glyphs += command.glyphs?.length ?? 0;
        pathBytes += (command.glyphs ?? []).reduce((sum, glyph) => sum + glyph.path.length, 0);
        nativeEligibleGlyphs += (command.glyphs ?? []).filter((glyph) => Number.isInteger(glyph.glyphId) && glyph.glyphId >= 0 && glyph.glyphId <= 0xffff && !glyph.colorGlyph && !glyph.variationKey && (glyph.rotation ?? 0) === 0 && (glyph.scaleX ?? 1) === 1).length;
      }
      if (command.op === "beginLayer") effectOps += command.effectProgram?.ops.length ?? 0;
      if (command.op === "beginLayer") layerFlags.push({ key: command.key, isolation: command.isolation, offscreen: command.offscreen, compositeAlpha: command.compositeAlpha, blendMode: command.blendMode, effectOps: command.effectProgram?.ops.length ?? 0 });
      if (command.op === "drawPath") drawPathBytes += JSON.stringify(command.contours).length;
      if ("fillPaint" in command && command.fillPaint) fillPaintTypes.set(command.fillPaint.type, (fillPaintTypes.get(command.fillPaint.type) ?? 0) + 1);
    }
    console.log(JSON.stringify({ frame, commands: buffer.commands.length, counts: Object.fromEntries(counts), glyphs, nativeEligibleGlyphs, pathBytes, drawPathBytes, fillPaintTypes: Object.fromEntries(fillPaintTypes), effectOps, layerFlags, bufferBytes: JSON.stringify(buffer).length }));
  }
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
