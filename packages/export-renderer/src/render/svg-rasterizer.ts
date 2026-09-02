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

function glyphTransform(glyph: PaintTextGlyph): string {
  const rotation = glyph.rotation ? ` rotate(${glyph.rotation} ${glyph.x} ${glyph.y})` : "";
  const scaleX = glyph.scaleX ?? 1;
  return `translate(${glyph.x} ${glyph.y}) translate(${-glyph.outline.x} ${glyph.outline.y}) scale(${glyph.pathScale * scaleX} ${-glyph.pathScale})${rotation}`;
}

function colorGlyphSvg(glyph: PaintTextGlyph, fallback: string): string {
  const colorGlyph = glyph.colorGlyph;
  if (!colorGlyph) return "";
  if (colorGlyph.kind === "bitmap") {
    const data = Buffer.from(colorGlyph.bytes).toString("base64");
    return `<image x="${glyph.x}" y="${glyph.y - glyph.height}" width="${glyph.width}" height="${glyph.height}" preserveAspectRatio="none" href="data:${colorGlyph.mimeType};base64,${data}"/>`;
  }
  if (colorGlyph.kind === "layers") {
    return colorGlyph.layers.filter((layer) => layer.path).map((layer) => {
      const transform = layer.x !== undefined && layer.y !== undefined && layer.pathScale !== undefined && layer.outline
        ? `translate(${layer.x} ${layer.y}) translate(${-layer.outline.x} ${layer.outline.y}) scale(${layer.pathScale} ${-layer.pathScale})`
        : glyphTransform(glyph);
      return `<path d="${escapeXml(layer.path!)}" transform="${transform}" fill="${fill(layer.fill, fallback)}"/>`;
    }).join("");
  }
  return "";
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
    const decorations = (command.decorations ?? []).map((item) => `<rect x="${item.x}" y="${item.y}" width="${item.width}" height="${item.height}" fill="${fill(item.fill)}" fill-opacity="${opacity(item.opacity)}"/>`).join("");
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
