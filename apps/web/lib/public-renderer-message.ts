/**
 * Renderer implementation names are private implementation details. Never
 * send them to the browser UI or expose them through user-facing diagnostics.
 */
export function publicRendererMessage(message: string): string {
  return message
    .replace(/CanvasKit/gi, "preview renderer")
    .replace(/Skia/gi, "native renderer")
    .replace(/WASM/gi, "browser runtime");
}

export function publicDiagnosticCode(code: string): string {
  return code
    .replace(/canvaskit/gi, "preview")
    .replace(/skia/gi, "renderer");
}
