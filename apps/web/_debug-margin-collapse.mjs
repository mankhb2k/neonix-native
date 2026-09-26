import { compileDocument } from "@motionvideo/html-compiler";
import { compileProtocolToPaintCommands } from "@motionvideo/motion-compiler";
import { readFileSync } from "node:fs";
import {
  HTML_COMPILER_PREVIEW_FONT_ASSETS,
  HTML_COMPILER_PREVIEW_MEDIA_ASSETS,
} from "./lib/docs/html-compiler-preview.ts";

const html = readFileSync(
  "public/docs/html-compiler/fixtures/layout/block-flow-margin-collapsing.html",
  "utf8",
);

const result = compileDocument(
  { html },
  { fontAssets: HTML_COMPILER_PREVIEW_FONT_ASSETS, mediaAssets: HTML_COMPILER_PREVIEW_MEDIA_ASSETS },
);

console.log("status:", result.status);
if (result.diagnostics?.length) console.log("diagnostics:", JSON.stringify(result.diagnostics, null, 2));

const layers = result.protocol?.layers;
const byId = new Map(layers.map((l) => [l.id, l]));

function absPos(layer) {
  let x = layer.transform?.translate?.x ?? 0;
  let y = layer.transform?.translate?.y ?? 0;
  let p = layer.parentLayerId ? byId.get(layer.parentLayerId) : null;
  while (p) {
    x += p.transform?.translate?.x ?? 0;
    y += p.transform?.translate?.y ?? 0;
    p = p.parentLayerId ? byId.get(p.parentLayerId) : null;
  }
  return { x, y };
}

const interesting = layers.filter((l) =>
  /anchor|margin-case|child-c|child-d/.test(l.id) && /case-c|case-d|margin-case-c|margin-case-d|child-c|child-d/.test(l.id)
);
for (const l of layers) {
  if (!/case-c|case-d/.test(l.parentLayerId ?? "") && !/margin-case-c|margin-case-d/.test(l.id) && !/case-c|case-d/.test(l.id)) continue;
  const abs = absPos(l);
  console.log(
    `${l.id} parent=${l.parentLayerId ?? "-"} frame=${l.frame.width}x${l.frame.height} translate=(${l.transform?.translate?.x},${l.transform?.translate?.y}) abs=(${abs.x},${abs.y})`,
  );
}

console.log("\n--- paint commands (frame 0) for case-c/case-d ---");
const buffer = compileProtocolToPaintCommands(result.protocol, { frame: 0 });
for (const cmd of buffer.commands) {
  const key = cmd.key ?? "";
  if (/case-c|case-d/.test(key) === false) continue;
  console.log(cmd.op, key, JSON.stringify(cmd).slice(0, 220));
}
