import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { compileDocument } from "@motionvideo/html-compiler";
import { compileProtocol, compileProtocolAtTime } from "@motionvideo/motion-compiler";
import { evaluateRuntimeProjectV3 } from "@motionvideo/motion-runtime";
import { HTML_COMPILER_PREVIEW_FONT_ASSETS } from "../lib/docs/html-compiler-preview";

const repoRoot = resolve(__dirname, "../../..");
const sampleRoot = join(repoRoot, "docs", "preview", "html-compiler", "export-samples");

const samples = [
  { id: "marketing-launch", file: "marketing-launch.html", background: "rgb(8, 16, 24)" },
  { id: "product-story", file: "product-story.html", background: "rgb(248, 250, 252)" },
  { id: "creative-brand", file: "creative-brand.html", background: "rgb(20, 15, 42)" },
];

test.describe("HTML motion export samples", () => {
  test("shows the three export samples in the browser/compiler comparison lab", async ({ page }) => {
    await page.goto(
      "/docs/preview/html-compiler?case=html-compiler.export.marketing-launch",
      { waitUntil: "domcontentloaded" },
    );

    await expect(page.getByRole("heading", { name: "Marketing launch / 10s" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Marketing launch / 10s" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByRole("button", { name: "Product story / 10s" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Creative brand / 10s" })).toBeVisible();
    await expect(page.getByTestId("html-compiler-browser-stage")).toBeVisible();
    await expect(page.getByTestId("html-compiler-runtime-stage")).toBeVisible();
    await expect(page.getByTestId("html-compiler-browser-preview-time")).toContainText("10.00s");
    await expect(page.getByTestId("html-compiler-skia-preview-time")).toContainText("10.00s");

    const runtimeCanvas = page.getByTestId("html-compiler-runtime-canvas");
    await expect(runtimeCanvas).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
    const initialPixels = await runtimeCanvas.screenshot();
    const slider = page.getByTestId("html-compiler-skia-transport-time-slider");
    await slider.fill("5");
    await expect(page.getByTestId("html-compiler-skia-preview-time")).toHaveAttribute("data-time", "5.000000");
    await expect(runtimeCanvas).toHaveAttribute("data-runtime-frame", "150");
    const middlePixels = await runtimeCanvas.screenshot();
    expect(initialPixels.equals(middlePixels)).toBe(false);
  });

  test("keeps the creative fixture on the same frame and replaces static CSS transforms", async ({ page }) => {
    const html = await readFile(join(sampleRoot, "creative-brand.html"), "utf8");
    const compiled = compileDocument(
      { html, fontAssets: HTML_COMPILER_PREVIEW_FONT_ASSETS },
      { composition: { durationMs: 10_000, id: "html-motion-creative-transform-regression" } },
    );
    expect(compiled.status, JSON.stringify(compiled.diagnostics)).toBe("success");

    const runtimeAtFrame = compileProtocolAtTime(compiled.protocol!, 3.6);
    for (const id of ["creative-route", "creative-shape-three"]) {
      const node = runtimeAtFrame.visual.nodes.find((candidate) => candidate.id === id);
      expect(node, `runtime node ${id}`).toBeDefined();
      expect(node?.localMatrix[1], `${id} matrix b`).toBeCloseTo(0, 8);
      expect(node?.localMatrix[4], `${id} matrix c`).toBeCloseTo(0, 8);
    }

    await page.goto(
      "/docs/preview/html-compiler?case=html-compiler.export.creative-brand",
      { waitUntil: "domcontentloaded" },
    );
    await expect(page.getByRole("heading", { name: "Creative brand / 10s" })).toBeVisible();
    await expect(page.getByTestId("html-compiler-runtime-canvas")).toHaveAttribute(
      "data-preview-state",
      "ready",
      { timeout: 30_000 },
    );
    const slider = page.getByTestId("html-compiler-skia-transport-time-slider");
    await slider.fill("3.6");
    await expect(page.getByTestId("html-compiler-browser-preview-time")).toHaveAttribute("data-time", "3.600000");
    await expect(page.getByTestId("html-compiler-skia-preview-time")).toHaveAttribute("data-time", "3.600000");
    await expect(page.getByTestId("html-compiler-runtime-canvas")).toHaveAttribute("data-runtime-frame", "108");

    const browserTransforms = await page
      .frameLocator('iframe[title^="Native browser HTML CSS reference"]')
      .locator("body")
      .evaluate(async () => {
        await document.fonts.ready;
        const matrixFor = (selector: string) => {
          const element = document.querySelector(selector);
          if (!element) throw new Error(`Missing browser fixture element: ${selector}`);
          const matrix = new DOMMatrix(getComputedStyle(element).transform);
          return { b: matrix.b, c: matrix.c };
        };
        return {
          route: matrixFor("#creative-route"),
          shape: matrixFor("#creative-shape-three"),
          interLoaded: document.fonts.check("92px Inter"),
        };
      });
    expect(browserTransforms.route.b).toBeCloseTo(0, 8);
    expect(browserTransforms.route.c).toBeCloseTo(0, 8);
    expect(browserTransforms.shape.b).toBeCloseTo(0, 8);
    expect(browserTransforms.shape.c).toBeCloseTo(0, 8);
    expect(browserTransforms.interLoaded).toBe(true);

    const browserDot = await page
      .frameLocator('iframe[title^="Native browser HTML CSS reference"]')
      .locator("#creative-dot")
      .evaluate((element) => {
        for (const animation of element.ownerDocument.getAnimations()) {
          animation.pause();
          animation.currentTime = 5_820;
        }
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          offsetDistance: style.offsetDistance,
          offsetPath: style.offsetPath,
          transform: style.transform,
        };
      });
    const runtimeDot = compileProtocolAtTime(compiled.protocol!, 5.82).visual.nodes.find(
      (candidate) => candidate.id === "creative-dot",
    );
    const dotLayer = compiled.protocol!.layers.find((candidate) => candidate.id === "creative-dot");
    expect(runtimeDot).toBeDefined();
    expect(dotLayer).toBeDefined();
    const dotWidth = dotLayer!.frame.width;
    const dotHeight = dotLayer!.frame.height;
    const runtimeDotCenter = {
      x: runtimeDot!.worldMatrix[0]! * (dotWidth / 2) + runtimeDot!.worldMatrix[4]! * (dotHeight / 2) + runtimeDot!.worldMatrix[12]!,
      y: runtimeDot!.worldMatrix[1]! * (dotWidth / 2) + runtimeDot!.worldMatrix[5]! * (dotHeight / 2) + runtimeDot!.worldMatrix[13]!,
    };
    expect(runtimeDotCenter.x).toBeCloseTo(browserDot.x + browserDot.width / 2, 0);
    expect(runtimeDotCenter.y).toBeCloseTo(browserDot.y + browserDot.height / 2, 0);
  });

  for (const sample of samples) {
    test(`${sample.id} compiles and renders at the canonical composition size`, async ({ page }, testInfo) => {
      const html = await readFile(join(sampleRoot, sample.file), "utf8");
      const compiled = compileDocument(
        { html, fontAssets: HTML_COMPILER_PREVIEW_FONT_ASSETS },
        { composition: { durationMs: 10_000, id: `html-motion-${sample.id}` } },
      );

      expect(compiled.status).toBe("success");
      expect(compiled.protocol).not.toBeNull();
      expect(compiled.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
      expect(compiled.protocol?.composition).toMatchObject({
        width: 1920,
        height: 1080,
        fps: 30,
        background: expect.any(String),
      });
      expect(compiled.protocol?.layers.length).toBeGreaterThan(0);
      expect(compiled.protocol?.layers.every((layer) => layer.timing.start === 0 && layer.timing.duration === 10_000)).toBe(true);

      const runtime = compileProtocol(compiled.protocol!);
      expect(runtime.visualTimeline?.frames).toHaveLength(300);
      expect(runtime.visualTimeline?.frames.some((frame) => frame.nodes.length > 0)).toBe(true);
      const firstFrame = evaluateRuntimeProjectV3(runtime, 0);
      const middleFrame = evaluateRuntimeProjectV3(runtime, 150);
      const visualCommands = (commands: typeof firstFrame.commands) =>
        commands.filter((command) => command.op !== "beginFrame" && command.op !== "endFrame");
      expect(visualCommands(middleFrame.commands)).not.toEqual(visualCommands(firstFrame.commands));

      const apiResponse = await page.request.post("/api/v1/documents/compile", { data: { html, durationMs: 10_000 } });
      expect(apiResponse.ok()).toBe(true);
      const apiPayload = await apiResponse.json() as { status?: string; protocolVersion?: number; protocol?: { composition?: { width?: number; height?: number; fps?: number }; layers?: Array<{ timing: { start: number; duration: number } }> } };
      expect(apiPayload).toMatchObject({
        status: "succeeded",
        protocolVersion: 2,
        protocol: {
          composition: { width: 1920, height: 1080, fps: 30 },
        },
      });
      expect(apiPayload.protocol?.layers?.every((layer) => layer.timing.start === 0 && layer.timing.duration === 10_000)).toBe(true);

      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto("/docs/preview/html-compiler", { waitUntil: "domcontentloaded" });
      const browserHtml = html.replace(
        "</head>",
        `
          <style>
            @font-face { font-family: Inter; src: url('/preview/font/Inter/Inter_18pt-Regular.ttf') format('truetype'); font-weight: 400; font-style: normal; font-display: block; }
            @font-face { font-family: Inter; src: url('/preview/font/Inter/Inter_18pt-Bold.ttf') format('truetype'); font-weight: 700; font-style: normal; font-display: block; }
          </style>
        </head>`,
      );
      await page.evaluate((source) => {
        document.open();
        document.write(source);
        document.close();
      }, browserHtml);
      await page.evaluate(() => document.fonts.ready);

      const browserState = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        bodyBackground: getComputedStyle(document.body).backgroundColor,
        animations: document.getAnimations().length,
      }));
      expect(browserState.width).toBe(1920);
      expect(browserState.height).toBe(1080);
      expect(browserState.bodyBackground).toBe(sample.background);
      expect(browserState.animations).toBeGreaterThan(0);

      for (const timeMs of [0, 5_000, 9_999]) {
        await page.evaluate((time) => {
          for (const animation of document.getAnimations()) {
            animation.pause();
            animation.currentTime = time;
          }
        }, timeMs);
        await page.screenshot({
          path: testInfo.outputPath(`${sample.id}-${timeMs}.png`),
          fullPage: false,
        });
      }
    });
  }
});
