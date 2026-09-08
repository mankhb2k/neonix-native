import { textCommandFor, transformTextPoint } from "./text-glyph-hit-test";
import type { TextEditSession } from "@motionvideo/editor-core";
import type { V2TextLayer } from "@motionvideo/motion-protocol/v2";
import type { RuntimeFrameV3 } from "@motionvideo/motion-runtime";

type RenderInput = {
  context: CanvasRenderingContext2D;
  root: HTMLDivElement;
  frame: RuntimeFrameV3 | null;
  layer: V2TextLayer;
  session: TextEditSession;
  compositionWidth: number;
  compositionHeight: number;
  width: number;
  height: number;
  devicePixelRatio: number;
  caretVisible: boolean;
};

function drawPolygon(
  context: CanvasRenderingContext2D,
  points: readonly { x: number; y: number }[],
  compositionWidth: number,
  compositionHeight: number,
  width: number,
  height: number,
): void {
  const scaleX = width / Math.max(1, compositionWidth);
  const scaleY = height / Math.max(1, compositionHeight);
  context.beginPath();
  points.forEach((point, index) => {
    const x = point.x * scaleX;
    const y = point.y * scaleY;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.closePath();
}

/** Paints only the DOM editing chrome; rendered text remains owned by Skia. */
export function renderTextCaretAndSelection({
  context,
  root,
  frame,
  layer,
  session,
  compositionWidth,
  compositionHeight,
  width,
  height,
  devicePixelRatio,
  caretVisible,
}: RenderInput): void {
  const renderRoot = root;
  const renderContext = context;
  renderRoot.dataset.caretVisible = "false";
  const command = textCommandFor(frame, layer.id);
  const glyphs = command?.glyphs ?? [];
  const selection = session.selection;
  const scaleX = width / Math.max(1, compositionWidth);
  const scaleY = height / Math.max(1, compositionHeight);

  if (selection.start !== selection.end) {
    renderContext.fillStyle = "rgba(41, 171, 226, 0.32)";
    for (const glyph of glyphs.filter((item) => item.clusterEnd > selection.start && item.cluster < selection.end)) {
      drawPolygon(renderContext, [
        transformTextPoint(layer, { x: glyph.x - 1, y: glyph.y }),
        transformTextPoint(layer, { x: glyph.x + glyph.width + 1, y: glyph.y }),
        transformTextPoint(layer, { x: glyph.x + glyph.width + 1, y: glyph.y + glyph.height }),
        transformTextPoint(layer, { x: glyph.x - 1, y: glyph.y + glyph.height }),
      ], compositionWidth, compositionHeight, width, height);
      renderContext.fill();
    }
    return;
  }

  if (!caretVisible || !command || command.text !== session.draftText.normalize("NFC")) return;
  renderRoot.dataset.caretVisible = "true";
  const caretIndex = selection.end;
  const nextGlyph = glyphs.find((glyph) => glyph.cluster >= caretIndex);
  const previousGlyph = [...glyphs].reverse().find((glyph) => glyph.clusterEnd <= caretIndex);
  const glyph = nextGlyph ?? previousGlyph;
  if (!glyph && session.draftText.length > 0) return;
  const caretHeight = Math.max(1, command.lineHeight ?? command.fontSize ?? glyph?.height ?? layer.frame.height);
  const caretX = nextGlyph
    ? nextGlyph.advanceStart ?? nextGlyph.x
    : previousGlyph
      ? (previousGlyph.advanceStart ?? previousGlyph.x) + (previousGlyph.advanceX ?? previousGlyph.width)
      : 0;
  const caretY = glyph ? glyph.y + glyph.height / 2 - caretHeight / 2 : 0;
  const top = transformTextPoint(layer, { x: caretX, y: caretY });
  const bottom = transformTextPoint(layer, { x: caretX, y: caretY + caretHeight });
  renderContext.strokeStyle = "#4b5563";
  renderContext.lineWidth = Math.max(2, 2 * devicePixelRatio);
  renderContext.beginPath();
  renderContext.moveTo(top.x * scaleX, top.y * scaleY);
  renderContext.lineTo(bottom.x * scaleX, bottom.y * scaleY);
  renderContext.stroke();
}
