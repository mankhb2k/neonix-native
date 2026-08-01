/**
 * Capture / generate parity baseline PNGs at 1280×720 and 1920×1080.
 * Without Playwright, writes solid-color fixture PNGs so the baselines folder
 * contains real image files (replace with headed screenshots when wired).
 */

import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const outDir = join(root, "docs/migration/vite-ui/baselines");
mkdirSync(outDir, { recursive: true });

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
    }
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

/** Minimal RGB PNG (solid color) — real PNG bytes for baseline slots. */
function solidPng(width, height, rgb = [0x18, 0x18, 0x1a]) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const i = row + 1 + x * 3;
      raw[i] = rgb[0];
      raw[i + 1] = rgb[1];
      raw[i + 2] = rgb[2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const surfaces = [
  "hub-empty",
  "hub-recent",
  "editor-shell",
  "sidebar-layers",
  "timeline-empty",
];
const sizes = [
  { w: 1280, h: 720, tag: "1280" },
  { w: 1920, h: 1080, tag: "1920" },
];

const files = [];
for (const surface of surfaces) {
  for (const { w, h, tag } of sizes) {
    const name = `${surface}-${tag}.png`;
    const buf = solidPng(w, h);
    writeFileSync(join(outDir, name), buf);
    files.push({
      name,
      width: w,
      height: h,
      sha256: createHash("sha256").update(buf).digest("hex"),
      kind: "fixture-solid",
    });
  }
}

const manifest = {
  status: "partial-fixtures",
  note: "Solid PNG fixtures at target dimensions. Replace with Playwright captures of Vite desktop for true parity.",
  tolerance: { maxPixelDiffRatio: 0.02 },
  generatedAt: new Date().toISOString(),
  files,
};

writeFileSync(
  join(outDir, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

console.log(
  `[capture-parity-baselines] Wrote ${files.length} PNG fixtures + manifest.json under ${outDir}`,
);
