import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const captureRoot = resolve(process.cwd(), "..", "..", "tmp", "phase6-backdrop-isolation");

test("captures Phase 6 backdrop isolation at native 1920x1080 for Browser and Skia", async ({ page }) => {
  mkdirSync(captureRoot, { recursive: true });
  await page.setViewportSize({ width: 1920, height: 1300 });
  await page.goto("/playground/native-stage", { waitUntil: "domcontentloaded" });

  const picker = page.getByTestId("radial-native-case-picker");
  const browser = page.getByTestId("radial-native-browser-iframe");
  const skia = page.getByTestId("radial-native-skia-canvas");
  await expect(picker).toBeEnabled({ timeout: 30_000 });
  await picker.selectOption("phase6-backdrop-isolation");
  await expect(picker).toHaveValue("phase6-backdrop-isolation");
  await expect(skia).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
  await expect(browser).toBeVisible();
  await expect.poll(async () => browser.contentFrame()?.locator(".glass-card").count() ?? 0, "Browser glass fixture loaded").toBe(1);

  const browserFrame = page.frames().find((frame) => frame !== page.mainFrame() && frame.url().startsWith("about:srcdoc"));
  if (!browserFrame) throw new Error("Native browser iframe content is missing");
  const browserMetrics = await browserFrame.evaluate(() => {
    const document = window.document;
    const read = (selector: string) => {
      const node = document?.querySelector(selector);
      if (!(node instanceof HTMLElement)) return null;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return {
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        borderRadius: style.borderRadius,
        backdropFilter: style.backdropFilter,
        filter: style.filter,
        background: style.backgroundColor,
      };
    };
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      glass: read(".glass-card"),
      scene: read(".mid-ground"),
    };
  });
  const skiaMetrics = await skia.evaluate((element) => ({
    width: (element as HTMLCanvasElement).width,
    height: (element as HTMLCanvasElement).height,
    cssWidth: getComputedStyle(element).width,
    cssHeight: getComputedStyle(element).height,
    diagnostics: element.getAttribute("data-diagnostics"),
  }));

  expect(browserMetrics.viewport).toEqual({ width: 1920, height: 1080 });
  expect(browserMetrics.glass).toMatchObject({
    rect: { x: 720, y: 440, width: 728, height: 368 },
    borderRadius: "32px",
    backdropFilter: "blur(22px) contrast(1.2)",
  });
  expect(skiaMetrics).toMatchObject({ width: 1920, height: 1080, cssWidth: "1920px", cssHeight: "1080px" });
  expect(skiaMetrics.diagnostics ?? "").not.toMatch(/backdrop|effect|unsupported|error/i);

  for (const [locator, fileName] of [[browser, "browser.png"], [skia, "skia.png"]] as const) {
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    if (!box) throw new Error(`Could not resolve screenshot bounds for ${fileName}`);
    await page.screenshot({ path: resolve(captureRoot, fileName), clip: box });
  }
  await page.screenshot({ path: resolve(captureRoot, "native-stage-page.png"), fullPage: false });
});
