import { expect, test } from "@playwright/test";
import path from "node:path";

test.describe("HTML compiler playground", () => {
  test("mounts the browser and Runtime/Skia screens", async ({ page }) => {
    await page.goto("/playground", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("html-compiler-playground")).toBeVisible();
    await expect(page.getByTestId("playground-import")).toBeVisible();
    await expect(page.getByTestId("playground-two-panel")).toBeVisible();
    await expect(page.getByTestId("playground-browser-stage")).toBeVisible();
    await expect(page.getByTestId("playground-runtime-stage")).toBeVisible();
    await expect(page.getByTestId("playground-runtime-canvas")).toHaveAttribute("data-preview-state", /ready|preparing-text|loading-resources/);
    await expect(page.getByTestId("playground-play-toggle")).toHaveAttribute("aria-label", "Play preview");
  });

  test("imports and compiles a single HTML document", async ({ page }) => {
    await page.goto("/playground", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("playground-runtime-canvas")).toHaveAttribute("data-preview-state", /ready|preparing-text|loading-resources/);
    await page.locator('input[type="file"]').setInputFiles(path.resolve(process.cwd(), "e2e/fixtures/playground-valid.html"));
    await expect(page.getByTestId("playground-source")).toContainText("Motion starts here.");
    await expect(page.getByTestId("playground-json")).toContainText('"formatVersion": 2');
  });

  test("exposes and loads all review and production fixtures in development", async ({ page }) => {
    await page.goto("/playground", { waitUntil: "domcontentloaded" });
    const picker = page.getByTestId("playground-fixture-picker");
    const playToggle = page.getByTestId("playground-play-toggle");
    await expect(picker).toBeVisible();
    await expect(picker.locator("option")).toHaveCount(22);
    await expect(page.getByTestId("playground-runtime-canvas")).toHaveAttribute("data-preview-state", /ready|preparing-text|loading-resources/);

    await page.route("**/playground/fixtures/marketing-launch.html", async (route) => {
      await new Promise((resolve) => {
        setTimeout(resolve, 250);
      });
      await route.continue();
    });
    await picker.selectOption("marketing-launch");
    await expect(playToggle).toHaveAttribute("aria-label", "Preparing preview");
    await expect(playToggle).toHaveAttribute("aria-label", "Play preview");
    await page.unroute("**/playground/fixtures/marketing-launch.html");
    await expect(page.getByTestId("playground-source")).toContainText("ai-grid-breathe");
    await expect(page.getByTestId("playground-json")).toContainText('"formatVersion": 2');
    await expect(page.getByTestId("playground-runtime-canvas")).toHaveAttribute("data-preview-state", "ready");
    const renderMetrics = await page.getByTestId("playground-runtime-canvas").evaluate((element) => ({
      cssScale: Number(element.getAttribute("data-css-scale")),
      renderDpr: Number(element.getAttribute("data-render-dpr")),
      backingWidth: Number(element.getAttribute("data-backing-width")),
      backingHeight: Number(element.getAttribute("data-backing-height")),
      devicePixelRatio: window.devicePixelRatio,
    }));
    expect(renderMetrics.renderDpr).toBe(1);
    expect(renderMetrics.backingWidth).toBe(1920);
    expect(renderMetrics.backingHeight).toBe(1080);
    const slider = page.getByLabel("Preview time");
    for (let step = 0; step < 49; step += 1) await slider.press("ArrowRight");
    await expect(page.getByTestId("playground-runtime-canvas")).toHaveAttribute("data-runtime-text-commands", /[1-9]/);
    await expect(page.getByTestId("playground-runtime-canvas")).toHaveAttribute("data-runtime-glyphs", /[1-9]/);

    for (const [fixtureId, marker] of [
      ["review-compositing-baseline-overlap", "One layer. One opacity boundary."],
      ["product-story", "product-phone"],
      ["creative-brand", "creative-hero"],
    ] as const) {
      await picker.selectOption(fixtureId);
      await expect(picker).toHaveValue(fixtureId);
      await expect(page.getByTestId("playground-source")).toContainText(marker);
      await expect(page.getByTestId("playground-json")).toContainText('"formatVersion": 2');
      await expect(page.getByTestId("playground-runtime-canvas")).toHaveAttribute("data-preview-state", "ready");
      const seekSteps = fixtureId === "review-compositing-baseline-overlap" ? 14 : 49;
      for (let step = 0; step < seekSteps; step += 1) await slider.press("ArrowRight");
      await expect(page.getByTestId("playground-runtime-canvas")).toHaveAttribute("data-runtime-text-commands", /[1-9]/);
      await expect(page.getByTestId("playground-runtime-canvas")).toHaveAttribute("data-runtime-glyphs", /[1-9]/);
      if (fixtureId === "review-compositing-baseline-overlap") {
        const browserFontLoaded = await page.locator('iframe[title="Native browser HTML CSS reference"]').evaluate((element: HTMLIFrameElement) => {
          const document = element.contentDocument;
          return Boolean(document?.fonts.check('700 92px "Inter"') && document.fonts.check('400 28px "Inter"'));
        });
        expect(browserFontLoaded).toBe(true);
      }
      await expect(page.getByTestId("playground-play-toggle")).toHaveAttribute("aria-label", "Play preview");
    }

    for (const [fixtureId, marker] of [
      ["review-grid-opacity-thirty", "grid-opacity-thirty"],
      ["review-grid-default-opacity", "grid-default-opacity"],
      ["review-grid-composition-baseline", "grid-composition-baseline"],
      ["review-grid-composition-baseline-1px", "grid-composition-baseline-1px"],
      ["review-grid-repeat-x", "grid-repeat-x"],
      ["review-grid-repeat-y", "grid-repeat-y"],
      ["review-grid-no-repeat", "grid-no-repeat"],
      ["review-pattern-radial-repeat", "pattern-radial-repeat"],
      ["review-pattern-conic-repeat", "pattern-conic-repeat"],
    ] as const) {
      await picker.selectOption(fixtureId);
      await expect(picker).toHaveValue(fixtureId);
      await expect(page.getByTestId("playground-source")).toContainText(marker);
      await expect(page.getByTestId("playground-json")).toContainText('"formatVersion": 2');
      await expect(page.getByTestId("playground-runtime-canvas")).toHaveAttribute("data-preview-state", "ready");
      const expectedGridSize = fixtureId === "review-grid-composition-baseline" || fixtureId === "review-grid-composition-baseline-1px"
        ? { width: 1680, height: 840 }
        : fixtureId === "review-grid-repeat-x"
          ? { width: 1440, height: 240 }
          : fixtureId === "review-grid-repeat-y"
            ? { width: 480, height: 840 }
              : fixtureId === "review-grid-no-repeat"
                ? { width: 480, height: 360 }
                : fixtureId === "review-pattern-radial-repeat" || fixtureId === "review-pattern-conic-repeat"
                  ? { width: 1440, height: 480 }
              : { width: 960, height: 480 };
      const gridSelector = fixtureId === "review-grid-opacity-thirty"
        ? ".grid-lines-opacity-thirty"
        : fixtureId === "review-grid-default-opacity"
          ? ".grid-lines-default-opacity"
          : fixtureId === "review-grid-composition-baseline"
            ? ".grid-composition-baseline"
            : fixtureId === "review-grid-composition-baseline-1px"
              ? ".grid-composition-baseline-1px"
            : fixtureId === "review-grid-repeat-x"
              ? ".grid-repeat-x"
              : fixtureId === "review-grid-repeat-y"
                ? ".grid-repeat-y"
                : fixtureId === "review-grid-no-repeat"
                  ? ".grid-no-repeat"
                  : fixtureId === "review-pattern-radial-repeat"
                    ? ".pattern-radial-repeat"
                    : ".pattern-conic-repeat";
      await expect.poll(async () => page.locator('iframe[title="Native browser HTML CSS reference"]').evaluate((element: HTMLIFrameElement, input: { size: { width: number; height: number }; selector: string }) => {
        const document = element.contentDocument;
        const grid = document?.querySelector(input.selector);
        if (!grid || !document) return false;
        const style = getComputedStyle(grid);
        const rect = grid.getBoundingClientRect();
        return rect.width === input.size.width && rect.height === input.size.height && style.backgroundImage.includes("gradient(");
      }, { size: expectedGridSize, selector: gridSelector })).toBe(true);
      await expect(page.locator('iframe[title="Native browser HTML CSS reference"]').contentFrame().locator(gridSelector)).toBeVisible();
      if (fixtureId === "review-grid-composition-baseline") {
        const gridStyle = await page.locator('iframe[title="Native browser HTML CSS reference"]').contentFrame().locator(gridSelector).evaluate((element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return { opacity: style.opacity, width: rect.width, height: rect.height, backgroundSize: style.backgroundSize };
        });
        expect(gridStyle).toMatchObject({ opacity: "1", width: 1680, height: 840, backgroundSize: "120px 120px, 120px 120px" });
        // A two-axis repeating gradient with an explicit tile size should be
        // represented by owner rectangles, not hundreds of clipPath tiles.
        await expect(page.getByTestId("playground-json")).not.toContainText("::tile:");
        await expect(page.getByTestId("playground-runtime-canvas")).not.toHaveAttribute("data-diagnostics", /skia_clip_path_unsupported/);
      }
      if (fixtureId.startsWith("review-grid-repeat") || fixtureId === "review-grid-no-repeat") {
        await expect(page.getByTestId("playground-json")).toContainText("::tile:");
      }
      await expect(page.getByTestId("playground-play-toggle")).toHaveAttribute("aria-label", "Play preview");
    }
  });

  test("renders repeated radial and conic backgrounds as independent non-linear paint cases", async ({ page }) => {
    await page.goto("/playground", { waitUntil: "domcontentloaded" });
    const picker = page.getByTestId("playground-fixture-picker");
    await expect(picker.locator("option")).toHaveCount(22);
    await expect(page.getByTestId("playground-runtime-canvas")).toHaveAttribute("data-preview-state", /ready|preparing-text|loading-resources/);

    for (const [fixtureId, selector, gradientName] of [
      ["review-pattern-radial-repeat", ".pattern-radial-repeat", "radial-gradient"],
      ["review-pattern-conic-repeat", ".pattern-conic-repeat", "conic-gradient"],
    ] as const) {
      await picker.selectOption(fixtureId);
      await expect(picker).toHaveValue(fixtureId);
      await expect(page.getByTestId("playground-source")).toContainText(selector.slice(1));
      await expect(page.getByTestId("playground-json")).toContainText('"formatVersion": 2');
      await expect(page.getByTestId("playground-runtime-canvas")).toHaveAttribute("data-preview-state", "ready");
      const browserStyle = await page.locator('iframe[title="Native browser HTML CSS reference"]').contentFrame().locator(selector).evaluate((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return { backgroundImage: style.backgroundImage, backgroundSize: style.backgroundSize, width: rect.width, height: rect.height };
      });
      expect(browserStyle).toMatchObject({ width: 1440, height: 480, backgroundSize: "120px 120px" });
      expect(browserStyle.backgroundImage).toContain(gradientName);
      await expect(page.getByTestId("playground-json")).toContainText("::tile:");
    }
  });

  test("loads the Phase 2 paint primitive and overlap fixtures", async ({ page }) => {
    await page.goto("/playground", { waitUntil: "domcontentloaded" });
    const picker = page.getByTestId("playground-fixture-picker");
    const source = page.getByTestId("playground-source");
    const json = page.getByTestId("playground-json");
    const canvas = page.getByTestId("playground-runtime-canvas");
    await expect(picker.locator("option")).toHaveCount(22);
    await expect(canvas).toHaveAttribute("data-preview-state", /ready|preparing-text|loading-resources/);

    for (const [fixtureId, marker] of [
      ["phase2-single-rect", "phase2-single-rect"],
      ["phase2-single-opacity", "phase2-single-opacity"],
      ["phase2-rounded-shape", "phase2-rounded-rect"],
      ["phase2-two-shape-overlap", "phase2-overlap-rect"],
      ["phase2-three-shape-order", "phase2-order-yellow"],
      ["phase2-shape-text-image", "phase2-media-image"],
      ["phase2-border-background", "phase2-border-background"],
      ["phase2-multiple-backgrounds", "phase2-multiple-backgrounds"],
    ] as const) {
      await picker.selectOption(fixtureId);
      await expect(picker).toHaveValue(fixtureId);
      await expect(source).toContainText(marker);
      await expect(json).toContainText('"formatVersion": 2');
      await expect(canvas).toHaveAttribute("data-preview-state", "ready");
      await expect(page.getByTestId("playground-play-toggle")).toHaveAttribute("aria-label", "Play preview");
    }
  });

  test("renders the vector-backed repeated linear baseline without a CanvasKit matrix error", async ({ page }) => {
    await page.goto("/playground", { waitUntil: "domcontentloaded" });
    const picker = page.getByTestId("playground-fixture-picker");
    await expect(page.getByTestId("playground-runtime-canvas")).toHaveAttribute("data-preview-state", /ready|preparing-text|loading-resources/);
    await picker.selectOption("review-grid-composition-baseline");
    await expect(picker).toHaveValue("review-grid-composition-baseline");
    await expect(page.getByTestId("playground-source")).toContainText("grid-composition-baseline");
    await expect(page.getByTestId("playground-json")).toContainText('"formatVersion": 2');
    await expect(page.getByTestId("playground-json")).not.toContainText("::tile:");
    await expect(page.getByTestId("playground-runtime-canvas")).toHaveAttribute("data-preview-state", "ready");
    await expect(page.getByTestId("playground-runtime-canvas")).not.toHaveAttribute("data-diagnostics", /invalid matrix argument/);
  });
});
