/**
 * Electron helper: sharp-free PNG pixel-diff via nativeImage (UI-0).
 * Invoked by compare-baselines.mjs.
 *
 * Args via env:
 *   COMPARE_JOB_JSON = { maxRatio, pairs: [{ name, cand, ref, width?, height? }] }
 * Writes COMPARE_RESULT_JSON path.
 */

const { app, nativeImage } = require("electron");
const { readFileSync, writeFileSync } = require("node:fs");

const jobPath = process.env.COMPARE_JOB_JSON;
const outPath = process.env.COMPARE_RESULT_JSON;
if (!jobPath || !outPath) {
  console.error("COMPARE_JOB_JSON / COMPARE_RESULT_JSON required");
  process.exit(1);
}

const job = JSON.parse(readFileSync(jobPath, "utf8"));
const maxRatio = Number(job.maxRatio ?? 0.02) || 0.02;

function diffRatio(a, b) {
  if (a.length !== b.length) return 1;
  let diff = 0;
  const pixels = a.length / 4;
  for (let i = 0; i < a.length; i += 4) {
    if (
      a[i] !== b[i] ||
      a[i + 1] !== b[i + 1] ||
      a[i + 2] !== b[i + 2] ||
      a[i + 3] !== b[i + 3]
    ) {
      diff += 1;
    }
  }
  return diff / pixels;
}

app.whenReady().then(() => {
  const results = [];
  for (const pair of job.pairs ?? []) {
    try {
      const cand = nativeImage.createFromPath(pair.cand);
      const ref = nativeImage.createFromPath(pair.ref);
      if (cand.isEmpty() || ref.isEmpty()) {
        results.push({
          name: pair.name,
          ok: false,
          reason: "empty-image",
        });
        continue;
      }
      const cs = cand.getSize();
      const rs = ref.getSize();
      if (cs.width !== rs.width || cs.height !== rs.height) {
        results.push({
          name: pair.name,
          ok: false,
          reason: "size-mismatch",
          cand: cs,
          ref: rs,
        });
        continue;
      }
      if (pair.width && pair.height) {
        if (cs.width !== pair.width || cs.height !== pair.height) {
          results.push({
            name: pair.name,
            ok: false,
            reason: "manifest-size",
            actual: cs,
            expected: { width: pair.width, height: pair.height },
          });
          continue;
        }
      }
      const ratio = diffRatio(cand.toBitmap(), ref.toBitmap());
      results.push({
        name: pair.name,
        ok: ratio <= maxRatio,
        ratio,
        maxRatio,
        width: cs.width,
        height: cs.height,
      });
    } catch (err) {
      results.push({
        name: pair.name,
        ok: false,
        reason: String(err),
      });
    }
  }
  writeFileSync(outPath, `${JSON.stringify({ results }, null, 2)}\n`);
  app.exit(0);
});

app.on("window-all-closed", (e) => e.preventDefault());
