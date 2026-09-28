import sharp from "sharp";
import type { PaintCommand, PaintCommandBuffer, PaintTextGlyph } from "@motionvideo/motion-runtime";
import { ExportRendererError } from "../errors";

type Affine = { a: number; b: number; c: number; d: number; e: number; f: number };

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function affine(matrix: readonly number[]): Affine {
  const isAffine = matrix.length === 16 && matrix.every(Number.isFinite) &&
    Math.abs(matrix[2] ?? 0) < 1e-9 && Math.abs(matrix[3] ?? 0) < 1e-9 &&
    Math.abs(matrix[6] ?? 0) < 1e-9 && Math.abs(matrix[7] ?? 0) < 1e-9 &&
    Math.abs((matrix[10] ?? 0) - 1) < 1e-9 && Math.abs(matrix[11] ?? 0) < 1e-9 &&
    Math.abs(matrix[14] ?? 0) < 1e-9 && Math.abs((matrix[15] ?? 0) - 1) < 1e-9;
  if (!isAffine) {
    throw new ExportRendererError(
      "Native SVG export only supports affine 2D transforms in this slice",
      "NON_AFFINE_TRANSFORM",
    );
  }
  return {
    a: matrix[0]!,
    b: matrix[1]!,
    c: matrix[4]!,
    d: matrix[5]!,
    e: matrix[12]!,
    f: matrix[13]!,
  };
}

function transform(matrix: readonly number[]): string {
  const m = affine(matrix);
  return `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`;
}

function fill(value: string | undefined, fallback = "#ffffff"): string {
  return escapeXml(value?.startsWith("#") ? value : fallback);
}

function opacity(value: number | undefined): string {
  return String(Math.max(0, Math.min(1, value ?? 1)));
}

function pathData(command: Extract<PaintCommand, { op: "drawPath" }>): string {
  return command.contours.map((contour) => {
    const parts = [`M ${contour.start.x} ${contour.start.y}`];
    for (const segment of contour.segments) {
      if (segment.kind === "line") parts.push(`L ${segment.to.x} ${segment.to.y}`);
      else if (segment.kind === "quadratic") parts.push(`Q ${segment.control.x} ${segment.control.y} ${segment.to.x} ${segment.to.y}`);
      else if (segment.kind === "cubic") parts.push(`C ${segment.control1.x} ${segment.control1.y} ${segment.control2.x} ${segment.control2.y} ${segment.to.x} ${segment.to.y}`);
      else parts.push(`A ${segment.radii.x} ${segment.radii.y} ${segment.rotation} ${segment.largeArc ? 1 : 0} ${segment.sweep ? 1 : 0} ${segment.to.x} ${segment.to.y}`);
    }
    if (contour.closed) parts.push("Z");
    return parts.join(" ");
  }).join(" ");
}

/**
 * A repeating quadratic-bezier zigzag across [x, x+width] centered on
 * centerY - the standard way to draw a CSS wavy text-decoration line.
 * Duplicated (not imported) from canvaskit-preview's identical helper:
 * these two render backends must stay decoupled from each other.
 */
function wavyDecorationPathData(x: number, centerY: number, width: number, thickness: number): string {
  const amplitude = Math.max(1, thickness * 0.9);
  const halfPeriod = Math.max(2, thickness * 2);
  let data = `M ${x} ${centerY}`;
  let cursor = x;
  let direction = 1;
  while (cursor < x + width) {
    const next = Math.min(cursor + halfPeriod, x + width);
    const controlX = (cursor + next) / 2;
    data += ` Q ${controlX} ${centerY + direction * amplitude} ${next} ${centerY}`;
    cursor = next;
    direction *= -1;
  }
  return data;
}

function decorationSvg(item: NonNullable<Extract<PaintCommand, { op: "drawText" }>["decorations"]>[number]): string {
  if (!item.style) return `<rect x="${item.x}" y="${item.y}" width="${item.width}" height="${item.height}" fill="${fill(item.fill)}" fill-opacity="${opacity(item.opacity)}"/>`;
  const centerY = item.y + item.height / 2;
  if (item.style === "wavy") {
    return `<path d="${wavyDecorationPathData(item.x, centerY, item.width, item.height)}" fill="none" stroke="${fill(item.fill)}" stroke-opacity="${opacity(item.opacity)}" stroke-width="${Math.max(1, item.height * 0.7)}" stroke-linecap="round"/>`;
  }
  // Dotted: a near-zero dash length with a round cap renders as filled
  // circles (the standard dasharray trick for "dots"). Dashed: longer
  // dashes with a butt cap for sharp rectangular segments.
  const dasharray = item.style === "dotted" ? `0.01 ${item.height * 2}` : `${item.height * 3} ${item.height * 2}`;
  const cap = item.style === "dotted" ? "round" : "butt";
  return `<line x1="${item.x}" y1="${centerY}" x2="${item.x + item.width}" y2="${centerY}" stroke="${fill(item.fill)}" stroke-opacity="${opacity(item.opacity)}" stroke-width="${item.height}" stroke-dasharray="${dasharray}" stroke-linecap="${cap}"/>`;
}

function glyphTransform(glyph: PaintTextGlyph): string {
  const rotation = glyph.rotation ? ` rotate(${glyph.rotation} ${glyph.x} ${glyph.y})` : "";
  const scaleX = glyph.scaleX ?? 1;
  // Keep the font-space origin inside the scaled coordinate system. Putting
  // the outline translation before scale would leave font units unscaled and
  // push ordinary glyphs far outside their text frame in native SVG export.
  return `translate(${glyph.x} ${glyph.y}) scale(${glyph.pathScale * scaleX} ${-glyph.pathScale}) translate(${-glyph.outline.x} ${-glyph.outline.y})${rotation}`;
}

/**
 * SVG-in-OpenType documents can be a shared sprite sheet rather than a
 * standalone SVG image. Extract the requested glyph and provide the font
 * coordinate system that an external SVG image does not get automatically.
 */
function standaloneColorGlyphSvg(document: string, glyphId: number): string {
  const svgStart = document.indexOf("<svg");
  const rootEnd = svgStart >= 0 ? document.indexOf(">", svgStart) : -1;
  const defsStart = document.indexOf("<defs", rootEnd + 1);
  const defsEnd = defsStart >= 0 ? document.indexOf("</defs>", defsStart) : -1;
  const glyphStart = document.indexOf(`<g id="glyph${glyphId}">`, rootEnd + 1);
  const glyphClose = glyphStart >= 0 ? document.indexOf("</g>", glyphStart) : -1;
  if (svgStart < 0 || rootEnd < 0 || defsStart < 0 || defsEnd < 0 || glyphStart < 0) {
    return document;
  }
  const root = document.slice(svgStart, rootEnd + 1)
    .replace("<svg ", '<svg width="1000" height="1000" viewBox="0 -1000 1000 1000" ');
  const glyph = document.slice(glyphStart, glyphClose >= 0 ? glyphClose + "</g>".length : document.length);
  return `${root}${document.slice(defsStart, defsEnd + "</defs>".length)}${glyph}${glyphClose >= 0 ? "" : "</g>"}</svg>`;
}

function colorGlyphSvg(glyph: PaintTextGlyph, fallback: string): string {
  const colorGlyph = glyph.colorGlyph;
  if (!colorGlyph) return "";
  if (colorGlyph.kind === "bitmap") {
    const source = colorGlyph.mimeType === "image/svg+xml"
      ? standaloneColorGlyphSvg(new TextDecoder().decode(colorGlyph.bytes), glyph.glyphId)
      : undefined;
    const bytes = source ? Buffer.from(source, "utf8") : Buffer.from(colorGlyph.bytes);
    const data = bytes.toString("base64");
    return `<image x="${glyph.x}" y="${glyph.y}" width="${glyph.width}" height="${glyph.height}" preserveAspectRatio="none" href="data:${colorGlyph.mimeType};base64,${data}"/>`;
  }
  if (colorGlyph.kind === "layers") {
    return colorGlyph.layers.filter((layer) => layer.path).map((layer) => {
      const transform = layer.x !== undefined && layer.y !== undefined && layer.pathScale !== undefined && layer.outline
        ? `translate(${layer.x} ${layer.y}) translate(${-layer.outline.x} ${layer.outline.y}) scale(${layer.pathScale} ${-layer.pathScale})`
        : glyphTransform(glyph);
      return `<path d="${escapeXml(layer.path!)}" transform="${transform}" fill="${fill(layer.fill, fallback)}"/>`;
    }).join("");
  }
  // A paint graph may not have a portable SVG serialization in the runtime
  // command. Keep the glyph visible in native export with its resolved
  // outline rather than silently dropping the emoji.
  return `<path d="${escapeXml(glyph.path)}" transform="${glyphTransform(glyph)}" fill="${fill(fallback)}"/>`;
}

function draw(command: Extract<PaintCommand, { op: "drawText" | "drawShape" | "drawSolid" | "drawPath" }>): string {
  if (command.op === "drawSolid") {
    return `<rect width="${command.width}" height="${command.height}" fill="${fill(command.fill)}"/>`;
  }
  if (command.op === "drawShape") {
    const common = `fill="${fill(command.fill)}" fill-opacity="${opacity(command.fillOpacity)}"`;
    const stroke = command.stroke
      ? ` stroke="${fill(command.stroke)}" stroke-opacity="${opacity(command.strokeOpacity)}" stroke-width="${command.strokeWidth ?? 1}"`
      : "";
    if (command.shape === "ellipse") {
      return `<ellipse cx="${command.width / 2}" cy="${command.height / 2}" rx="${command.width / 2}" ry="${command.height / 2}" ${common}${stroke}/>`;
    }
    if (command.shape === "polygon") {
      const points = (command.points ?? []).map((point) => `${point.x},${point.y}`).join(" ");
      return `<polygon points="${points}" ${common}${stroke}/>`;
    }
    return `<rect width="${command.width}" height="${command.height}" rx="${command.cornerRadius ?? 0}" ${common}${stroke}/>`;
  }
  if (command.op === "drawPath") {
    const stroke = command.stroke
      ? ` stroke="${fill(command.stroke)}" stroke-opacity="${opacity(command.strokeOpacity)}" stroke-width="${command.strokeWidth ?? 1}" stroke-linejoin="${command.strokeJoin ?? "miter"}" stroke-linecap="${command.strokeCap ?? "butt"}"`
      : "";
    return `<path d="${pathData(command)}" fill="${fill(command.fill, "none")}" fill-opacity="${opacity(command.fillOpacity)}" fill-rule="${command.fillRule}"${stroke}/>`;
  }
  if (command.glyphs?.length) {
    const glyphs = command.glyphs.map((glyph) => {
      if (glyph.colorGlyph) return colorGlyphSvg(glyph, glyph.fill ?? command.fill);
      const stroke = glyph.stroke
        ? ` stroke="${fill(glyph.stroke)}" stroke-width="${glyph.strokeWidth ?? 1}" stroke-opacity="${opacity(glyph.strokeOpacity)}"`
        : "";
      return `<path d="${escapeXml(glyph.path)}" transform="${glyphTransform(glyph)}" fill="${fill(glyph.fill ?? command.fill)}"${stroke}/>`;
    }).join("");
    const decorations = (command.decorations ?? []).map((item) => decorationSvg(item)).join("");
    return `${glyphs}${decorations}`;
  }
  const anchor = command.align === "center" ? "middle" : command.align === "right" ? "end" : "start";
  return `<text x="${anchor === "start" ? 0 : anchor === "middle" ? command.width / 2 : command.width}" y="${command.fontSize}" text-anchor="${anchor}" fill="${fill(command.fill)}" font-size="${command.fontSize}" font-family="sans-serif" font-weight="${command.fontWeight ?? 400}">${escapeXml(command.text)}</text>`;
}

function unsupported(command: PaintCommand): never {
  throw new ExportRendererError(
    `Native export does not support ${command.op} yet (${"layerId" in command ? command.layerId : "frame"})`,
    "UNSUPPORTED_COMMAND",
    { op: command.op },
  );
}

/** Convert one V3 paint buffer into deterministic SVG. */
export function paintCommandsToSvg(buffer: PaintCommandBuffer): string {
  const first = buffer.commands.find((command): command is Extract<PaintCommand, { op: "beginFrame" }> => command.op === "beginFrame");
  if (!first) throw new ExportRendererError("Paint buffer has no beginFrame command", "INVALID_PROJECT");

  const body: string[] = [`<rect width="${first.width}" height="${first.height}" fill="${fill(first.background, "#000000")}"/>`];
  let pending: Extract<PaintCommand, { op: "setTransform" }> | null = null;
  for (const command of buffer.commands) {
    if (command.op === "beginFrame" || command.op === "endFrame" || command.op === "beginGroup" || command.op === "endGroup") continue;
    if (command.op === "setTransform") {
      pending = command;
      continue;
    }
    if (command.op === "beginLayer" || command.op === "endLayer") {
      throw new ExportRendererError("Effects, masks and isolated layers are not certified for native export yet", "UNSUPPORTED_COMMAND", { op: command.op, key: command.key });
    }
    if (command.op === "drawImage" || command.op === "drawVideo" || command.op === "unsupported") unsupported(command);
    const drawCommand = command as Extract<PaintCommand, { op: "drawText" | "drawShape" | "drawSolid" | "drawPath" }>;
    if (!pending || pending.key !== drawCommand.key) {
      throw new ExportRendererError(`Draw command ${drawCommand.key} has no matching transform`, "INVALID_PROJECT");
    }
    if (!pending.visible || pending.alpha <= 0) {
      pending = null;
      continue;
    }
    body.push(`<g transform="${transform(pending.matrix4)}" opacity="${opacity(pending.alpha)}"${pending.blendMode && pending.blendMode !== "normal" ? ` style="mix-blend-mode:${pending.blendMode}"` : ""}>${draw(drawCommand)}</g>`);
    pending = null;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${first.width}" height="${first.height}" viewBox="0 0 ${first.width} ${first.height}">${body.join("")}</svg>`;
}

export async function rasterizeSvgToRgba(svg: string, width: number, height: number): Promise<Buffer> {
  return sharp(Buffer.from(svg))
    .resize(width, height, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer();
}

/** Encode a native-resolution RGBA frame for inspection or image export. */
export async function encodeRgbaToPng(rgba: Buffer, width: number, height: number): Promise<Buffer> {
  return sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
}
