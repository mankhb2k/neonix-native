import type { Page } from "@playwright/test";

export type SkiaDiff = {
  width: number;
  height: number;
  changedPixels: number;
  changedRatio: number;
  meanAbsoluteDelta: number;
  maxChannelDelta: number;
  paintedPixels: number;
};

export async function readSkiaDiff(page: Page): Promise<SkiaDiff> {
  return page.evaluate(async () => {
    const iframe = document.querySelector("iframe[data-testid='skia-svg-reference']");
    const skia = document.querySelector("canvas[data-testid='skia-runtime-stage']");
    if (!(iframe instanceof HTMLIFrameElement) || !(skia instanceof HTMLCanvasElement)) {
      throw new Error("Skia reference/canvas is missing");
    }
    const svg = iframe.contentDocument?.querySelector("svg")?.outerHTML;
    if (!svg) throw new Error("Skia SVG reference has not loaded");
    // The serialized SVG is rendered from a blob URL below. Resolve external
    // Runtime image resources against the app origin first; otherwise a
    // relative href such as /preview/image/photo-landscape.jpg resolves
    // against the blob URL and silently disappears from the reference.
    const parsedSvg = new DOMParser().parseFromString(svg, "image/svg+xml");
    for (const element of parsedSvg.querySelectorAll("[href], [xlink\\:href]")) {
      for (const attribute of ["href", "xlink:href"]) {
        const value = element.getAttribute(attribute);
        if (value && !value.startsWith("data:") && !value.startsWith("#")) {
          const response = await fetch(new URL(value, window.location.href).href);
          if (!response.ok) throw new Error(`SVG reference resource failed: ${response.status}`);
          const resource = await response.blob();
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error ?? new Error("SVG reference resource could not be encoded"));
            reader.readAsDataURL(resource);
          });
          element.setAttribute(attribute, dataUrl);
        }
      }
    }
    const resolvedSvg = parsedSvg.documentElement.outerHTML;
    const image = new Image();
    const imageUrl = URL.createObjectURL(new Blob([resolvedSvg], { type: "image/svg+xml" }));
    image.src = imageUrl;
    await image.decode();
    const reference = document.createElement("canvas");
    reference.width = skia.width;
    reference.height = skia.height;
    const referenceContext = reference.getContext("2d");
    const skiaContext = skia.getContext("2d");
    if (!referenceContext || !skiaContext) throw new Error("Skia 2D readback context is missing");
    referenceContext.drawImage(image, 0, 0, reference.width, reference.height);
    const expected = referenceContext.getImageData(0, 0, reference.width, reference.height).data;
    const actual = skiaContext.getImageData(0, 0, skia.width, skia.height).data;
    URL.revokeObjectURL(imageUrl);

    let changedPixels = 0;
    let totalDelta = 0;
    let maxChannelDelta = 0;
    let paintedPixels = 0;
    for (let index = 0; index < actual.length; index += 4) {
      if (actual[index + 3] > 0) paintedPixels++;
      const delta = Math.max(
        Math.abs(actual[index]! - expected[index]!),
        Math.abs(actual[index + 1]! - expected[index + 1]!),
        Math.abs(actual[index + 2]! - expected[index + 2]!),
        Math.abs(actual[index + 3]! - expected[index + 3]!),
      );
      totalDelta += delta;
      maxChannelDelta = Math.max(maxChannelDelta, delta);
      if (delta > 8) changedPixels++;
    }
    const pixelCount = actual.length / 4;
    return {
      width: skia.width,
      height: skia.height,
      changedPixels,
      changedRatio: changedPixels / pixelCount,
      meanAbsoluteDelta: totalDelta / pixelCount,
      maxChannelDelta,
      paintedPixels,
    };
  });
}
