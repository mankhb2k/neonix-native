import { expect, test } from "@playwright/test";

const cases: Array<{ id: string; distances: string[]; painted?: boolean }> = [
  { id: "nested-distance", distances: ['"distance": 900', '"distance": 420'] },
  { id: "nested-origins", distances: ['"distance": 820', '"distance": 460'] },
  { id: "nested-flat-boundary", distances: ['"distance": 760', '"distance": 400'] },
  { id: "nested-preserve-depth", distances: ['"distance": 860', '"distance": 520'] },
  { id: "nested-near-plane", distances: ['"distance": 900', '"distance": 170'] },
  { id: "nested-overflow-clip", distances: ['"distance": 880', '"distance": 360'] },
  { id: "nested-backface", distances: ['"distance": 820', '"distance": 440'], painted: false },
  { id: "nested-same-origin", distances: ['"distance": 900', '"distance": 440'] },
  { id: "nested-between-boundaries", distances: ['"distance": 880', '"distance": 380'] },
  { id: "nested-clip-path", distances: ['"distance": 860', '"distance": 360'] },
] as const;

test.describe("HTML compiler nested perspective cases", () => {
  for (const fixture of cases) {
    test(`${fixture.id} keeps nested perspective contexts through Skia`, async ({ page }) => {
      await page.goto(`/docs/preview/html-compiler?case=html-compiler.perspective.${fixture.id}`, { waitUntil: "domcontentloaded" });

      const canvas = page.getByTestId("html-compiler-runtime-canvas");
      await expect(canvas).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
      await expect(page.getByTestId("html-compiler-browser-stage")).toBeVisible();
      await expect(page.getByTestId("html-compiler-runtime-stage")).toBeVisible();

      const protocol = page.locator("pre").last();
      await expect(protocol).toContainText('"render3d"');
      for (const distance of fixture.distances) await expect(protocol).toContainText(distance);

      const paintedCount = () => canvas.evaluate((element: HTMLCanvasElement) => {
        const context = element.getContext("2d");
        if (!context) return 0;
        const pixels = context.getImageData(0, 0, element.width, element.height).data;
        let painted = 0;
        for (let index = 0; index < pixels.length; index += 4) {
          if (pixels[index] !== 8 || pixels[index + 1] !== 16 || pixels[index + 2] !== 24) painted += 1;
        }
        return painted;
      });
      if (fixture.painted === false) await expect.poll(paintedCount).toBe(0);
      else await expect.poll(paintedCount).toBeGreaterThan(100);

      if (fixture.id === "nested-flat-boundary") {
        const referenceFrame = page.frames().find((frame) => frame !== page.mainFrame());
        const iframe = page.locator('[data-testid="html-compiler-browser-stage"] iframe');
        const iframeBox = await iframe.boundingBox();
        const browserCardBox = referenceFrame ? await referenceFrame.locator("#nested-flat-card").boundingBox() : null;
        const browserFaceBox = referenceFrame ? await referenceFrame.locator("#nested-flat-face").boundingBox() : null;
        const colorBounds = await canvas.evaluate((element) => {
          const context = element.getContext("2d");
          if (!context) return {};
          const pixels = context.getImageData(0, 0, element.width, element.height).data;
          const find = (red: number, green: number, blue: number) => {
            let left = element.width;
            let top = element.height;
            let right = -1;
            let bottom = -1;
            for (let y = 0; y < element.height; y += 1) {
              for (let x = 0; x < element.width; x += 1) {
                const offset = (y * element.width + x) * 4;
                if (Math.abs(pixels[offset]! - red) < 8 && Math.abs(pixels[offset + 1]! - green) < 8 && Math.abs(pixels[offset + 2]! - blue) < 8) {
                  left = Math.min(left, x);
                  top = Math.min(top, y);
                  right = Math.max(right, x);
                  bottom = Math.max(bottom, y);
                }
              }
            }
            return { left, top, right, bottom };
          };
          return { purple: find(167, 139, 250), yellow: find(250, 204, 21) };
        });
        expect(iframeBox).not.toBeNull();
        expect(browserCardBox).not.toBeNull();
        expect(browserFaceBox).not.toBeNull();
        const mapBrowserToRuntime = (box: NonNullable<typeof browserCardBox>) => ({
          left: (box.x - iframeBox!.x) * 1920 / iframeBox!.width,
          top: (box.y - iframeBox!.y) * 1080 / iframeBox!.height,
          right: (box.x + box.width - iframeBox!.x) * 1920 / iframeBox!.width,
          bottom: (box.y + box.height - iframeBox!.y) * 1080 / iframeBox!.height,
        });
        const assertBoundsClose = (actual: { left: number; top: number; right: number; bottom: number }, expected: ReturnType<typeof mapBrowserToRuntime>) => {
          expect(Math.abs(actual.left - expected.left)).toBeLessThan(8);
          expect(Math.abs(actual.top - expected.top)).toBeLessThan(8);
          expect(Math.abs(actual.right - expected.right)).toBeLessThan(8);
          expect(Math.abs(actual.bottom - expected.bottom)).toBeLessThan(8);
        };
        assertBoundsClose(colorBounds.purple!, mapBrowserToRuntime(browserCardBox!));
        assertBoundsClose(colorBounds.yellow!, mapBrowserToRuntime(browserFaceBox!));
      }

      if (fixture.id === "nested-overflow-clip") {
        // overflow:hidden is a CSS grouping property. The protocol must carry
        // the effective flat boundary, otherwise the outer perspective is
        // incorrectly chained through the inner clipped subtree.
        await expect(protocol).toContainText('"transformStyle": "flat"');
        const referenceFrame = page.frames().find((frame) => frame !== page.mainFrame());
        const iframe = page.locator('[data-testid="html-compiler-browser-stage"] iframe');
        const iframeBox = await iframe.boundingBox();
        const browserGeometry = referenceFrame ? await referenceFrame.evaluate(() => {
          const card = document.getElementById("nested-overflow-card")!;
          const inner = document.getElementById("nested-overflow-inner")!;
          const points = [[0, 0], [0, 260]] as const;
          const rects = points.map(([x, y], index) => {
            const marker = document.createElement("i");
            marker.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:1px;height:1px;opacity:0;pointer-events:none`;
            marker.dataset.testid = `nested-overflow-marker-${index}`;
            card.appendChild(marker);
            const rect = marker.getBoundingClientRect();
            marker.remove();
            return { x: rect.left, y: rect.top };
          });
          const clip = inner.getBoundingClientRect();
          return { topLeft: rects[0]!, bottomLeft: rects[1]!, clipRight: clip.right, clipBottom: clip.bottom };
        }) : null;
        const colorBounds = await canvas.evaluate((element) => {
          const context = element.getContext("2d");
          if (!context) return null;
          const pixels = context.getImageData(0, 0, element.width, element.height).data;
          let left = element.width;
          let top = element.height;
          let right = -1;
          let bottom = -1;
          for (let y = 0; y < element.height; y += 1) {
            for (let x = 0; x < element.width; x += 1) {
              const offset = (y * element.width + x) * 4;
              if (Math.abs(pixels[offset]! - 251) < 8 && Math.abs(pixels[offset + 1]! - 113) < 8 && Math.abs(pixels[offset + 2]! - 133) < 8) {
                left = Math.min(left, x);
                top = Math.min(top, y);
                right = Math.max(right, x);
                bottom = Math.max(bottom, y);
              }
            }
          }
          return { left, top, right, bottom };
        });
        expect(iframeBox).not.toBeNull();
        expect(browserGeometry).not.toBeNull();
        expect(colorBounds).not.toBeNull();
        const mapPoint = (point: { x: number; y: number }) => ({
          // frame.evaluate() reports the iframe's logical composition
          // coordinates (1920x1080), while iframeBox is the displayed CSS
          // size. No scale conversion is needed here.
          x: point.x,
          y: point.y,
        });
        const topLeft = mapPoint(browserGeometry!.topLeft);
        const bottomLeft = mapPoint(browserGeometry!.bottomLeft);
        const clipRight = browserGeometry!.clipRight;
        expect(Math.abs(colorBounds!.left - topLeft.x)).toBeLessThan(10);
        expect(Math.abs(colorBounds!.right - clipRight)).toBeLessThan(10);
        // The top/bottom bbox extrema belong to different projected corners
        // than the left edge when the card is rotated in 3D; clipping parity
        // is established by the left edge and the inner boundary edge above.
        expect(colorBounds!.top).toBeLessThan(topLeft.y);
        expect(colorBounds!.bottom).toBeGreaterThan(bottomLeft.y - 10);
      }
    });
  }
});
