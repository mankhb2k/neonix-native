import type { PaintCommand, PaintCommandBuffer, PaintFill, RuntimeEffectOp, RuntimeEffectProgram } from "@motionvideo/motion-runtime";

/**
 * Wire-format encoder for the versioned binary protocol
 * (`NXSKIA02` magic) consumed by `native/protocol.cpp`'s `Reader`. This is a
 * positional binary protocol, not a self-describing one:
 * every writer here must match its C++ reader counterpart byte-for-byte
 * (`read_matrix`/`read_color`/`read_paint`/`read_path`/`read_effect_op`/the
 * `main()` opcode switch) or the native process will reject the stream with
 * a `protocol` error.
 *
 * Used by both the production render path (`native-command.ts`, which spawns
 * the native binary directly) and the benchmark harness
 * (`benchmark-native-skia-command-cpu.ts`, which exercises additional
 * transports/modes for local profiling) so the two can never drift apart.
 */
export class BinaryWriter {
  private readonly chunks: Buffer[] = [];

  u8(value: number): void {
    const buffer = Buffer.allocUnsafe(1);
    buffer.writeUInt8(value, 0);
    this.chunks.push(buffer);
  }

  u32(value: number): void {
    const buffer = Buffer.allocUnsafe(4);
    buffer.writeUInt32LE(value >>> 0, 0);
    this.chunks.push(buffer);
  }

  f64(value: number): void {
    const buffer = Buffer.allocUnsafe(8);
    buffer.writeDoubleLE(value, 0);
    this.chunks.push(buffer);
  }

  bytes(value: Uint8Array): void {
    this.chunks.push(Buffer.from(value));
  }

  string(value: string): void {
    const encoded = Buffer.from(value, "utf8");
    this.u32(encoded.byteLength);
    this.bytes(encoded);
  }

  finish(): Buffer {
    return Buffer.concat(this.chunks);
  }
}

function color(value: string): [number, number, number, number] {
  const hex = value.trim().replace(/^#/, "");
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return [
      Number.parseInt(hex.slice(0, 2), 16) / 255,
      Number.parseInt(hex.slice(2, 4), 16) / 255,
      Number.parseInt(hex.slice(4, 6), 16) / 255,
      1,
    ];
  }
  if (/^[0-9a-f]{8}$/i.test(hex)) {
    return [
      Number.parseInt(hex.slice(0, 2), 16) / 255,
      Number.parseInt(hex.slice(2, 4), 16) / 255,
      Number.parseInt(hex.slice(4, 6), 16) / 255,
      Number.parseInt(hex.slice(6, 8), 16) / 255,
    ];
  }
  throw new Error(`Native command protocol only supports hex colors: ${value}`);
}

function writeColor(writer: BinaryWriter, value: string): void {
  for (const channel of color(value)) writer.f64(channel);
}

/** Versioned native subset for text paints. Solid/none are represented by the
 * existing color field; gradients carry their geometry and stops explicitly. */
function writePaint(writer: BinaryWriter, paint: PaintFill | undefined): void {
  if (!paint || paint.type === "none" || paint.type === "solid") {
    writer.u8(0);
    return;
  }
  if (paint.type === "pattern") {
    throw new Error("Native text export does not support pattern paints yet");
  }
  writer.u8(paint.type === "linear-gradient" ? 1 : paint.type === "radial-gradient" ? 2 : 3);
  const values = [paint.x1, paint.y1, paint.x2, paint.y2, paint.angle, paint.from, paint.cx, paint.cy, paint.radius, paint.radiusX, paint.radiusY, paint.fx, paint.fy, paint.fr];
  for (const value of values) writer.f64(value ?? Number.NaN);
  writer.u8(paint.spreadMethod === "reflect" ? 1 : paint.spreadMethod === "repeat" ? 2 : 0);
  writer.u8(paint.gradientUnits === "userSpaceOnUse" ? 1 : 0);
  const transform = paint.gradientTransform;
  writer.u8(transform ? 1 : 0);
  if (transform) for (const value of [transform.a, transform.b, transform.c, transform.d, transform.e, transform.f]) writer.f64(value);
  writer.u32(paint.stops.length);
  for (const stop of paint.stops) {
    writer.f64(stop.offset);
    writeColor(writer, stop.color);
    writer.f64(stop.stopOpacity ?? 1);
  }
}

/**
 * Wire order for `beginLayer.blendMode`. Must match `kBlendModes` in
 * `native/main.cpp` exactly — this is a positional binary protocol, not a
 * self-describing one, so the two tables can only be kept in sync by hand.
 */
const NATIVE_BLEND_MODES = [
  "normal", "darken", "multiply", "color-burn",
  "lighten", "screen", "color-dodge", "overlay",
  "soft-light", "hard-light", "difference", "exclusion",
  "hue", "saturation", "color", "luminosity",
] as const;

function blendModeCode(mode: string | undefined): number {
  const index = NATIVE_BLEND_MODES.indexOf((mode ?? "normal") as (typeof NATIVE_BLEND_MODES)[number]);
  if (index === -1) throw new Error(`Native command protocol does not support blend mode: ${mode}`);
  return index;
}

/**
 * Wire opcode for one `RuntimeEffectOp.kind`. Must match the `switch` in
 * `read_effect_op` in `native/protocol.cpp` exactly.
 */
function effectOpCode(kind: RuntimeEffectOp["kind"]): number {
  switch (kind) {
    case "color-adjust": return 1;
    case "color-matrix": return 2;
    case "alpha": return 3;
    case "blur": return 4;
    case "alpha-mask": return 5;
    case "morphology": return 6;
    case "inner-alpha": return 7;
    case "tint": return 8;
    case "offset": return 9;
    case "noise": return 10;
    case "composite": return 11;
  }
}

function writeEffectOp(writer: BinaryWriter, op: RuntimeEffectOp): void {
  writer.u8(effectOpCode(op.kind));
  writer.string(op.output);
  if (op.kind === "color-adjust") {
    writer.string(op.input);
    writer.f64(op.brightness);
    writer.f64(op.contrast);
    writer.f64(op.saturation);
    writer.f64(op.hueRotate);
  } else if (op.kind === "color-matrix") {
    writer.string(op.input);
    if (op.matrix.length !== 20) throw new Error(`Native command protocol requires a 20-value color-matrix: ${op.id}`);
    for (const value of op.matrix) writer.f64(value);
  } else if (op.kind === "alpha") {
    writer.string(op.input);
    writer.f64(op.amount);
  } else if (op.kind === "blur") {
    writer.string(op.input);
    writer.f64(op.radius);
  } else if (op.kind === "alpha-mask") {
    writer.string(op.input);
    writer.u8(op.source === "alpha" ? 1 : op.source === "box" ? 2 : 0);
  } else if (op.kind === "morphology") {
    writer.string(op.input);
    writer.u8(op.operator === "dilate" ? 1 : 0);
    writer.f64(op.radius);
  } else if (op.kind === "inner-alpha") {
    writer.string(op.source);
    writer.string(op.blurred);
  } else if (op.kind === "tint") {
    writer.string(op.input);
    writeColor(writer, op.color);
    writer.f64(op.opacity);
  } else if (op.kind === "offset") {
    writer.string(op.input);
    writer.f64(op.x);
    writer.f64(op.y);
  } else if (op.kind === "noise") {
    writer.string(op.input);
    writer.f64(op.scale);
    writer.f64(op.amount);
    writer.f64(op.opacity);
    writer.u32(op.seed);
  } else if (op.kind === "composite") {
    writer.string(op.backdrop);
    writer.string(op.source);
  }
}

function writeEffectProgram(writer: BinaryWriter, program: RuntimeEffectProgram | undefined): void {
  if (!program) {
    writer.u8(0);
    return;
  }
  writer.u8(1);
  writer.u32(program.ops.length);
  for (const op of program.ops) writeEffectOp(writer, op);
  writer.string(program.output);
}

function writeEffectBox(
  writer: BinaryWriter,
  box: Extract<PaintCommand, { op: "beginLayer" }>["effectBox"],
): void {
  if (!box) {
    writer.u8(0);
    return;
  }
  writer.u8(1);
  writer.f64(box.width);
  writer.f64(box.height);
  writer.u8(box.cornerRadius !== undefined ? 1 : 0);
  if (box.cornerRadius !== undefined) writer.f64(box.cornerRadius);
  writeMatrix(writer, box.matrix4);
}

function writeMatrix(writer: BinaryWriter, matrix: readonly number[]): void {
  if (matrix.length !== 16 || matrix.some((value) => !Number.isFinite(value))) {
    throw new Error("Native command protocol requires a finite Matrix4");
  }
  for (const value of matrix) writer.f64(value);
}

function writePath(writer: BinaryWriter, contours: Extract<PaintCommand, { op: "drawPath" }>["contours"]): void {
  writer.u32(contours.length);
  for (const contour of contours) {
    writer.f64(contour.start.x);
    writer.f64(contour.start.y);
    writer.u32(contour.segments.length);
    writer.u8(contour.closed ? 1 : 0);
    for (const segment of contour.segments) {
      if (segment.kind === "line") {
        writer.u8(1); writer.f64(segment.to.x); writer.f64(segment.to.y);
      } else if (segment.kind === "quadratic") {
        writer.u8(2); writer.f64(segment.control.x); writer.f64(segment.control.y); writer.f64(segment.to.x); writer.f64(segment.to.y);
      } else if (segment.kind === "cubic") {
        writer.u8(3); writer.f64(segment.control1.x); writer.f64(segment.control1.y); writer.f64(segment.control2.x); writer.f64(segment.control2.y); writer.f64(segment.to.x); writer.f64(segment.to.y);
      } else {
        writer.u8(4); writer.f64(segment.radii.x); writer.f64(segment.radii.y); writer.f64(segment.rotation);
        writer.u8(segment.largeArc ? 1 : 0); writer.u8(segment.sweep ? 1 : 0);
        writer.f64(segment.to.x); writer.f64(segment.to.y);
      }
    }
  }
}

function writeCommand(writer: BinaryWriter, command: PaintCommand): void {
  if (command.op === "beginFrame") {
    writer.u8(1);
    writer.u32(command.width);
    writer.u32(command.height);
    writer.u8(command.background === undefined ? 0 : 1);
    if (command.background !== undefined) writeColor(writer, command.background);
    writeMatrix(writer, command.projection.worldToClipMatrix);
    return;
  }
  if (command.op === "setTransform") {
    writer.u8(2);
    writeMatrix(writer, command.matrix4);
    writer.f64(command.alpha);
    writer.u8(command.visible ? 1 : 0);
    return;
  }
  if (command.op === "drawShape") {
    writer.u8(3);
    writer.u8(command.shape === "rectangle" ? 1 : command.shape === "ellipse" ? 2 : 3);
    writer.f64(command.width);
    writer.f64(command.height);
    writer.u8(1);
    writeColor(writer, command.fill);
    writer.f64(command.fillOpacity ?? 1);
    writePaint(writer, command.fillPaint);
    writer.u8(command.cornerRadius === undefined ? 0 : 1);
    if (command.cornerRadius !== undefined) writer.f64(command.cornerRadius);
    writer.u8(command.stroke === undefined ? 0 : 1);
    if (command.stroke !== undefined) writeColor(writer, command.stroke);
    writer.f64(command.strokeWidth ?? 0);
    writer.f64(command.strokeOpacity ?? 1);
    writePaint(writer, command.strokePaint);
    writer.u32(command.points?.length ?? 0);
    for (const point of command.points ?? []) { writer.f64(point.x); writer.f64(point.y); }
    return;
  }
  if (command.op === "drawSolid") {
    writer.u8(10);
    writeColor(writer, command.fill);
    writer.f64(command.width);
    writer.f64(command.height);
    return;
  }
  if (command.op === "drawPath") {
    writer.u8(5);
    writePath(writer, command.contours);
    writer.u8(command.fill === undefined ? 0 : 1);
    if (command.fill !== undefined) writeColor(writer, command.fill);
    writer.f64(command.fillOpacity ?? 1);
    writePaint(writer, command.fillPaint);
    writer.u8(command.stroke === undefined ? 0 : 1);
    if (command.stroke !== undefined) writeColor(writer, command.stroke);
    writer.f64(command.strokeWidth ?? 0);
    writer.f64(command.strokeOpacity ?? 1);
    writePaint(writer, command.strokePaint);
    writer.u8(command.fillRule === "evenodd" ? 1 : 0);
    // Local frame used to resolve objectBoundingBox-relative gradient
    // coordinates; mirrors CanvasKit's own `command.width ?? 1` fallback
    // (see replay.ts) so both backends agree when a path omits it.
    writer.f64(command.width ?? 1);
    writer.f64(command.height ?? 1);
    return;
  }
  if (command.op === "drawText") {
    writer.u8(7);
    writer.u32(command.glyphs?.length ?? 0);
    writeColor(writer, command.fill);
    writePaint(writer, command.fillPaint);
    for (const glyph of command.glyphs ?? []) {
      writer.string(glyph.path);
      writer.f64(glyph.x); writer.f64(glyph.y); writer.f64(glyph.pathScale);
      writer.f64(glyph.outline.x); writer.f64(glyph.outline.y);
      writer.f64(glyph.rotation ?? 0); writer.f64(glyph.scaleX ?? 1);
      writer.u8(glyph.fill === undefined ? 0 : 1);
      if (glyph.fill !== undefined) writeColor(writer, glyph.fill);
      writePaint(writer, glyph.fillPaint);
      writer.u8(glyph.stroke === undefined ? 0 : 1);
      if (glyph.stroke !== undefined) writeColor(writer, glyph.stroke);
      writer.f64(glyph.strokeWidth ?? 0); writer.f64(glyph.strokeOpacity ?? 1);
    }
    return;
  }
  if (command.op === "beginGroup") { writer.u8(4); return; }
  if (command.op === "endGroup") { writer.u8(6); return; }
  if (command.op === "beginLayer") {
    writer.u8(8);
    writer.u8(command.offscreen || command.isolation ? 1 : 0);
    writer.f64(command.compositeAlpha ?? 1);
    writer.u8(blendModeCode(command.blendMode));
    writeEffectProgram(writer, command.effectProgram);
    writeEffectProgram(writer, command.backdropEffectProgram);
    writeEffectBox(writer, command.effectBox);
    return;
  }
  if (command.op === "endLayer") {
    writer.u8(9);
    return;
  }
  if (command.op === "endFrame") {
    writer.u8(0xff);
    return;
  }
  throw new Error(`Native command protocol does not support ${command.op}`);
}

/** One `NXSKIA02` stream header: magic + composition dimensions + frame count. */
export function encodeProtocolHeader(width: number, height: number, frameCount: number): Buffer {
  const writer = new BinaryWriter();
  // NXSKIA02 adds versioned text fill-paint payloads after command/glyph fill colors.
  writer.bytes(Buffer.from("NXSKIA02", "ascii"));
  writer.u32(width);
  writer.u32(height);
  writer.u32(frameCount);
  return writer.finish();
}

/** One encoded frame: `0xF1` marker + frame index + command count + commands. */
export function encodeFrame(frame: number, buffer: PaintCommandBuffer): Buffer {
  const writer = new BinaryWriter();
  writer.u8(0xf1);
  writer.u32(frame);
  writer.u32(buffer.commands.length);
  for (const command of buffer.commands) writeCommand(writer, command);
  return writer.finish();
}

/** Terminates the frame stream (frame marker `0x00`, read by the C++ loop as `ended = true`). */
export function encodeEndOfStream(): Buffer {
  const writer = new BinaryWriter();
  writer.u8(0);
  return writer.finish();
}
