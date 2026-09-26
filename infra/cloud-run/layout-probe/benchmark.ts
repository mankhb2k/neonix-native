import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { stampNodeIds } from "@motionvideo/html-compiler";
import { closeSharedBrowser, runLayoutProbeJob } from "./src/probe-worker";

const fixturePath = resolve(process.cwd(), "../../../apps/web/public/docs/html-compiler/fixtures/debug/neonix-motion-test-10s.html");
const html = readFileSync(fixturePath, "utf8");
const stamped = stampNodeIds(html);

console.log(`Fixture: ${fixturePath}`);
console.log(`HTML size: ${html.length} bytes, stamped: ${stamped.length} bytes`);

const runs = 5;
const timings: number[] = [];
for (let i = 0; i < runs; i++) {
  const result = await runLayoutProbeJob({ jobId: `bench-${i}`, html: stamped });
  timings.push(result.elapsedMilliseconds);
  console.log(`run ${i}: ${result.elapsedMilliseconds}ms, ${Object.keys(result.snapshot).length} elements measured`);
}
await closeSharedBrowser();

const sorted = [...timings].sort((a, b) => a - b);
console.log(`\nmin=${sorted[0]}ms max=${sorted[sorted.length - 1]}ms median=${sorted[Math.floor(sorted.length / 2)]}ms (first run includes Chromium launch: ${timings[0]}ms)`);
