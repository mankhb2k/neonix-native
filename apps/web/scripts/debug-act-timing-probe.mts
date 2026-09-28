// Digs into per-act animation timing for the neonix_*_showcase debug
// fixtures: for one or more target elements (matched by class name) and a
// list of times, prints REAL Chrome's computed opacity/transform/box next to
// what our own compiled+evaluated RuntimeProjectV3 produces at the exact
// same time, so a mismatch (wrong easing, wrong percentage offset, wrong
// steps() edge, wrong fill-mode) shows up directly instead of being guessed
// at from a screenshot. Local Playwright/CDP only - no Cloud Run involved
// (see infra/cloud-run/layout-probe for the deployable version of the same
// real-browser-measurement idea, currently unused/undeployed).
//
// Usage: pnpm --filter @motionvideo/web exec tsx scripts/debug-act-timing-probe.mts <fixtureId> <times-ms-csv> <classNames-csv>
// Example:
//   pnpm --filter @motionvideo/web exec tsx scripts/debug-act-timing-probe.mts \
//     neonix-ui-transform-showcase 5000,5350,5700,6000,10000 act0-box,act2-box
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { compileDocument, type HtmlCompilerFontAsset } from "@motionvideo/html-compiler";
import { evaluateRuntimeProjectV3, type PaintCommand } from "@motionvideo/motion-runtime";
import { HTML_COMPILER_PREVIEW_FONT_ASSETS } from "../lib/docs/html-compiler-preview";
import { HTML_PLAYGROUND_CASES } from "../lib/playground/html-playground-cases";
import { compileAndPrepareRuntimeProjectV3 } from "../lib/server/render/project-runtime";

const [fixtureId, timesArg, classesArg] = process.argv.slice(2);
if (!fixtureId || !timesArg || !classesArg) {
  console.error("Usage: debug-act-timing-probe.mts <fixtureId> <times-ms-csv> <classNames-csv>");
  process.exit(1);
}
const times = timesArg.split(",").map((value) => Number(value.trim()));
const classNames = classesArg.split(",").map((value) => value.trim());

const item = HTML_PLAYGROUND_CASES.find((candidate) => candidate.id === fixtureId);
if (!item) throw new Error(`Unknown playground fixture: ${fixtureId}`);
const fixturePath = resolve(process.cwd(), "public", item.url.replace(/^\//, ""));
const sourceHtml = readFileSync(fixturePath, "utf8");

// Inject a stable `id="<class>"` onto the FIRST element carrying each target
// class - real-side lookup (getElementById) and our-side atomicId both key
// off this same id, so nothing needs the compiler's own structuralPath
// scheme reproduced here. In-memory only; the fixture file itself is never
// touched.
function withProbeIds(html: string, names: readonly string[]): string {
  let out = html;
  for (const name of names) {
    const pattern = new RegExp(`(<[a-zA-Z][\\w-]*\\s[^>]*class="[^"]*\\b${name}\\b[^"]*"[^>]*)(/?>)`);
    out = out.replace(pattern, (match, head: string, tail: string) => (/\bid="/.test(head) ? match : `${head} id="${name}"${tail}`));
  }
  return out;
}
const probedHtml = withProbeIds(sourceHtml, classNames);

function fontFaceCss(fontAssets: readonly HtmlCompilerFontAsset[]): string {
  return fontAssets
    .map((asset) => `@font-face { font-family: "${asset.family}"; src: url("http://127.0.0.1:__PORT__${asset.uri}") format("truetype"); font-style: ${asset.style}; font-weight: ${asset.weight}; }`)
    .join("\n");
}

async function main() {
  const compiled = compileDocument({ html: probedHtml }, { fontAssets: HTML_COMPILER_PREVIEW_FONT_ASSETS });
  if (!compiled.protocol) throw new Error(`Compile failed: ${JSON.stringify(compiled.diagnostics)}`);
  const runtime = await compileAndPrepareRuntimeProjectV3(compiled.protocol);
  const fps = compiled.protocol.composition.fps;
  // evaluateRuntimeProjectV3 snaps `options.time` to the nearest exact frame
  // of the composition's own fps (frameIndexAtTime/roundTimeToFrame) - by
  // design, matching a real exported video's discrete frames, not a bug.
  // Comparing that against the real browser's CONTINUOUS Web Animations
  // sample at an arbitrary millisecond (e.g. "250ms" at 30fps rounds to
  // frame 7 = 233.3ms) silently compares two DIFFERENT instants and reports
  // the frame-quantization gap as if it were an easing/timing bug - this bit
  // this exact tool once already (see debt-technical.md). Snap every
  // requested time to the same frame grid up front so both sides sample the
  // identical instant.
  const frameMs = 1000 / fps;
  const snappedTimes = times.map((ms) => Math.round(ms / frameMs) * frameMs);
  for (let index = 0; index < times.length; index += 1) {
    if (snappedTimes[index] !== times[index]) {
      console.log(`note: t=${times[index]}ms is not on the ${fps}fps frame grid - snapped to ${snappedTimes[index]!.toFixed(3)}ms for a fair comparison`);
      times[index] = snappedTimes[index]!;
    }
  }

  // Serve /preview/font/... locally so @font-face src URLs resolve without
  // needing a running Next.js dev server.
  const { createServer } = await import("node:http");
  const publicDir = resolve(process.cwd(), "public");
  const server = createServer((req, res) => {
    try {
      const filePath = resolve(publicDir, `.${req.url}`);
      res.end(readFileSync(filePath));
    } catch {
      res.statusCode = 404; res.end();
    }
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const port = (server.address() as { port: number }).port;
  const styleTag = `<style data-timing-probe-fonts>${fontFaceCss(HTML_COMPILER_PREVIEW_FONT_ASSETS).replaceAll("__PORT__", String(port))}</style>`;
  const stagedHtml = /<\/head\s*>/i.test(probedHtml)
    ? probedHtml.replace(/<\/head\s*>/i, `${styleTag}</head>`)
    : probedHtml.replace(/<body[^>]*>/i, (match) => `${styleTag}${match}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: compiled.protocol.composition.width, height: compiled.protocol.composition.height } });
  const page = await context.newPage();
  await page.setContent(stagedHtml, { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ content: `html, body { width: ${compiled.protocol.composition.width}px !important; height: ${compiled.protocol.composition.height}px !important; margin: 0 !important; overflow: hidden !important; }` });
  await page.evaluate(() => document.fonts.ready);

  type RealSample = { id: string; opacity: number; transform: string; x: number; y: number; width: number; height: number } | null;
  const realByTime = new Map<number, RealSample[]>();
  for (const ms of times) {
    const samples = await page.evaluate(
      ({ ms: timeMs, ids }) => {
        for (const animation of document.getAnimations()) {
          try { animation.pause(); animation.currentTime = timeMs; } catch { /* not seekable */ }
        }
        return ids.map((id) => {
          const el = document.getElementById(id);
          if (!el) return null;
          const rect = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          return { id, opacity: Number(style.opacity), transform: style.transform, x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        });
      },
      { ms, ids: classNames },
    );
    realByTime.set(ms, samples);
  }
  await browser.close();
  server.close();

  function decompose(a: number, b: number, c: number, d: number, e: number, f: number) {
    const scaleX = Math.hypot(a, b);
    const rotation = (Math.atan2(b, a) * 180) / Math.PI;
    const determinant = a * d - b * c;
    const scaleY = scaleX === 0 ? 0 : determinant / scaleX;
    return { translateX: e, translateY: f, scaleX, scaleY, rotationDeg: rotation };
  }
  function parseCssMatrix(value: string): { a: number; b: number; c: number; d: number; e: number; f: number } | undefined {
    const match = /matrix\(([^)]+)\)/.exec(value);
    if (!match) return undefined;
    const [a, b, c, d, e, f] = match[1]!.split(",").map((part) => Number(part.trim()));
    return { a: a!, b: b!, c: c!, d: d!, e: e!, f: f! };
  }
  function findCommand(commands: readonly PaintCommand[], id: string, op: PaintCommand["op"]): PaintCommand | undefined {
    return commands.find((command) => command.op === op && "key" in command && command.key === id);
  }

  console.log(`fixture: ${fixtureId}  fps: ${fps}\n`);
  if (process.env.DUMP_COMMANDS) {
    const frame0 = evaluateRuntimeProjectV3(runtime, 0, { time: times[0]! / 1000 });
    for (const c of frame0.commands) {
      if ("key" in c && classNames.some((name) => c.key.includes(name))) console.log(JSON.stringify(c).slice(0, 300));
    }
  }
  for (const ms of times) {
    console.log(`=== t = ${ms}ms ===`);
    const frame = evaluateRuntimeProjectV3(runtime, 0, { time: ms / 1000 });
    const realSamples = realByTime.get(ms) ?? [];
    for (let i = 0; i < classNames.length; i += 1) {
      const id = classNames[i]!;
      const real = realSamples[i];
      // A shape/group node with any per-instant opacity or effect (box-shadow
      // etc) compiles into a `beginLayer` carrying `compositeAlpha`, with its
      // OWN geometry/transform living on a separate `<id>::paint` key - the
      // same split PreviewStage/canvaskit-preview's own replay relies on
      // (beginLayer composites the whole layer once; setTransform positions
      // the drawable inside it). Fall back to the bare id for a leaf with
      // neither (e.g. no opacity/effect at all, so no beginLayer is needed).
      const beginLayer = findCommand(frame.commands, id, "beginLayer") as Extract<PaintCommand, { op: "beginLayer" }> | undefined;
      const paintKey = beginLayer ? `${id}::paint` : id;
      const setTransform = (findCommand(frame.commands, paintKey, "setTransform") ?? findCommand(frame.commands, id, "setTransform")) as Extract<PaintCommand, { op: "setTransform" }> | undefined;
      const draw = frame.commands.find((command) => "key" in command && (command.key === paintKey || command.key === id) && command.op.startsWith("draw")) as (Extract<PaintCommand, { op: "drawSolid" }> | Extract<PaintCommand, { op: "drawShape" }>) | undefined;
      const alpha = beginLayer?.compositeAlpha ?? setTransform?.alpha;
      if (!real && !setTransform && !beginLayer) { console.log(`  ${id}: not found on either side (check the class name / probe id injection)`); continue; }
      console.log(`  ${id}:`);
      if (real) {
        const parsed = real.transform && real.transform !== "none" ? parseCssMatrix(real.transform) : undefined;
        const decomposed = parsed ? decompose(parsed.a, parsed.b, parsed.c, parsed.d, parsed.e, parsed.f) : undefined;
        console.log(`    real   opacity=${real.opacity.toFixed(3)} rect=(${real.x.toFixed(1)},${real.y.toFixed(1)},${real.width.toFixed(1)}x${real.height.toFixed(1)})${decomposed ? ` transform2d=${JSON.stringify({ ...decomposed, translateX: +decomposed.translateX.toFixed(2), translateY: +decomposed.translateY.toFixed(2), scaleX: +decomposed.scaleX.toFixed(4), scaleY: +decomposed.scaleY.toFixed(4), rotationDeg: +decomposed.rotationDeg.toFixed(2) })}` : ` transform=${real.transform}`}`);
      } else {
        console.log("    real   (element not found in DOM)");
      }
      if (setTransform) {
        const m = setTransform.matrix4;
        const decomposed = decompose(m[0]!, m[1]!, m[4]!, m[5]!, m[12]!, m[13]!);
        console.log(`    ours   alpha=${(alpha ?? 1).toFixed(3)} width/height=${draw ? `${draw.width}x${draw.height}` : "n/a"} transform2d=${JSON.stringify({ translateX: +decomposed.translateX.toFixed(2), translateY: +decomposed.translateY.toFixed(2), scaleX: +decomposed.scaleX.toFixed(4), scaleY: +decomposed.scaleY.toFixed(4), rotationDeg: +decomposed.rotationDeg.toFixed(2) })}`);
      } else if (beginLayer) {
        console.log(`    ours   alpha=${(alpha ?? 1).toFixed(3)} (no setTransform for "${paintKey}" - element may be a group with no direct drawable)`);
      } else {
        console.log("    ours   (no beginLayer/setTransform command for this id - check atomicId/id injection)");
      }
    }
    console.log("");
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.stack ?? error.message : String(error)); process.exit(1); });

// TEMP diagnostic: dump every command whose key contains one of the target
// class names, regardless of op, to see the real command shape.
