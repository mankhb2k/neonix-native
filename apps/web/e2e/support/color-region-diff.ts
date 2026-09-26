import { type Locator, type Page } from "@playwright/test";

// Shared by layout-geometry-diff.spec.ts and layout-geometry-diff-probes.spec.ts:
// measures rendered element geometry by flood-filling connected regions of a
// known color in a screenshot, instead of reaching into html-compiler's
// internal layer JSON. See layout-geometry-diff.spec.ts's file comment for
// why (no id plumbing needed, works for repeated colors, validates the full
// paint pipeline end to end).
export const WIDTH = 1920;
export const HEIGHT = 1080;

export type Box = { x: number; y: number; width: number; height: number; area: number };

function dataUrl(buffer: Buffer): string {
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

/**
 * Extracts background colors from `#id { ... background: #hex; ... }` blocks
 * only - class selectors (caption/label text) and non-background
 * declarations are skipped, so this only probes real layout elements.
 */
export function parseLayoutProbeColors(html: string): string[] {
  const colors = new Set<string>();
  const blockPattern = /#[A-Za-z][\w-]*\s*\{([^}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = blockPattern.exec(html))) {
    const colorMatch = /background(?:-color)?:\s*(#[0-9a-fA-F]{3,8})\s*;/.exec(match[1]!);
    if (colorMatch) colors.add(colorMatch[1]!.toLowerCase());
  }
  return [...colors];
}

export async function captureNativeSurface(page: Page, surface: Locator): Promise<Buffer> {
  await surface.scrollIntoViewIfNeeded();
  const box = await surface.boundingBox();
  if (!box) throw new Error("Native surface bounds are unavailable");
  return page.screenshot({ type: "png", clip: { x: box.x, y: box.y, width: WIDTH, height: HEIGHT } });
}

/**
 * Runs in-page: decodes both screenshots once, then for each probe color
 * finds every connected solid-fill region of that color (flood fill over an
 * RGB-tolerance mask), sorted in reading order (top-to-bottom, left-to-right)
 * independently on each side. Comparing occurrence-by-occurrence (rather than
 * requiring a JSON-level element identity join back to html-compiler's layer
 * tree) is what lets a color reused by more than one element still get
 * compared correctly without any new id plumbing in the compiler.
 */
export async function measureColorBoxes(page: Page, browserPng: Buffer, skiaPng: Buffer, colors: string[]): Promise<Record<string, { browser: Box[]; skia: Box[] }>> {
  return page.evaluate(
    async ({ browserUrl, skiaUrl, colors: probeColors }) => {
      const decode = async (url: string) => {
        const response = await fetch(url);
        const bitmap = await createImageBitmap(await response.blob());
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
        bitmap.close();
        return canvas.getContext("2d")?.getImageData(0, 0, canvas.width, canvas.height);
      };
      const [browserImage, skiaImage] = await Promise.all([decode(browserUrl), decode(skiaUrl)]);
      if (!browserImage || !skiaImage) throw new Error("Layout geometry decode failed");

      const TOLERANCE = 30;
      const MIN_AREA = 100;

      function findComponents(image: ImageData, hex: string): Array<{ x: number; y: number; width: number; height: number; area: number }> {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const w = image.width;
        const h = image.height;
        const data = image.data;
        const visited = new Uint8Array(w * h);
        const matches = (i: number) => {
          const o = i * 4;
          return Math.abs(data[o]! - r) <= TOLERANCE && Math.abs(data[o + 1]! - g) <= TOLERANCE && Math.abs(data[o + 2]! - b) <= TOLERANCE;
        };
        const boxes: Array<{ x: number; y: number; width: number; height: number; area: number }> = [];
        const stack: number[] = [];
        for (let start = 0; start < w * h; start++) {
          if (visited[start] || !matches(start)) continue;
          let minX = w, minY = h, maxX = 0, maxY = 0, area = 0;
          stack.push(start);
          visited[start] = 1;
          while (stack.length) {
            const i = stack.pop()!;
            const x = i % w;
            const y = (i - x) / w;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            area++;
            const neighbors = [i - 1, i + 1, i - w, i + w];
            for (const n of neighbors) {
              if (n < 0 || n >= w * h || visited[n]) continue;
              if ((n === i - 1 || n === i + 1) && Math.floor(n / w) !== y) continue;
              if (!matches(n)) continue;
              visited[n] = 1;
              stack.push(n);
            }
          }
          if (area >= MIN_AREA) boxes.push({ x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1, area });
        }
        return boxes.sort((left, right) => left.y - right.y || left.x - right.x);
      }

      const result: Record<string, { browser: ReturnType<typeof findComponents>; skia: ReturnType<typeof findComponents> }> = {};
      for (const color of probeColors) {
        result[color] = { browser: findComponents(browserImage, color), skia: findComponents(skiaImage, color) };
      }
      return result;
    },
    { browserUrl: dataUrl(browserPng), skiaUrl: dataUrl(skiaPng), colors },
  );
}
