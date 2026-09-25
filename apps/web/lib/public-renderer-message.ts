/**
 * Renderer implementation names are private implementation details. Never
 * send them to the browser UI or expose them through user-facing diagnostics.
 */
export function publicRendererMessage(message: string): string {
  return stripInternalDiagnostics(message)
    .replace(/CanvasKit/gi, "preview renderer")
    .replace(/Skia/gi, "native renderer")
    .replace(/WASM/gi, "browser runtime");
}

/**
 * A renderer crash (e.g. an unhandled stream error) can print Node's raw
 * uncaught-exception dump - a full stack trace, absolute filesystem paths and
 * a trailing "Node.js vX.Y.Z" banner - straight into a captured stderr blob,
 * which then flows into this same message unless it's stripped here first.
 * This is a generic last line of defense; fixing a crash at its source (see
 * ffmpeg.ts / benchmark-native-skia-command-cpu.ts) should mean it rarely
 * fires, but any other internal error must still never leak these details.
 */
function stripInternalDiagnostics(message: string): string {
  return message
    .split(/\r?\n/)
    .filter((line) => !/^\s*at\s/.test(line) && !/^Node\.js v\d+\.\d+\.\d+\s*$/.test(line.trim()))
    .join("\n")
    .replace(/[A-Za-z]:\\(?:[^\s\\]+\\)*[^\s\\]+|\/(?:[^\s/]+\/)*[^\s/]+\.(?:ts|tsx|js|jsx|mjs|cjs|node|cpp)\b/g, "<path>")
    .trim();
}

export function publicDiagnosticCode(code: string): string {
  return code
    .replace(/canvaskit/gi, "preview")
    .replace(/skia/gi, "renderer");
}
