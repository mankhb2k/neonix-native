import { expect, test } from "@playwright/test";

test.describe("readonly preview composition zoom", () => {
  test("keeps pan updates local to the stage instead of the sidebar", async ({ page }) => {
    await page.goto("/preview/three-kingdoms", { waitUntil: "networkidle" });

    await page.getByTestId("readonly-preview-stage").waitFor();
    await page.getByRole("button", { name: "Pan tool", exact: true }).click();
    await page.evaluate(() => {
      const sidebar = document.querySelector<HTMLElement>('[data-testid="preview-layer-sidebar"]');
      const stage = document.querySelector<HTMLElement>('[data-testid="preview-stage-frame"]');
      if (!sidebar || !stage) throw new Error("Preview containers are unavailable");
      const metrics = { sidebarMutations: 0, stageMutations: 0 };
      (window as typeof window & { __previewPanMetrics?: typeof metrics }).__previewPanMetrics = metrics;
      new MutationObserver((records) => { metrics.sidebarMutations += records.length; }).observe(sidebar, {
        subtree: true,
        childList: true,
        attributes: true,
      });
      new MutationObserver((records) => { metrics.stageMutations += records.length; }).observe(stage, {
        subtree: true,
        attributes: true,
      });
    });

    const stageBox = await page.getByTestId("preview-stage-frame").boundingBox();
    if (!stageBox) throw new Error("Preview stage is unavailable");
    const startX = stageBox.x + stageBox.width * 0.2;
    const startY = stageBox.y + stageBox.height * 0.2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    for (let index = 1; index <= 40; index += 1) {
      await page.mouse.move(startX + index * 3, startY + index * 2);
    }
    await page.mouse.up();

    const metrics = await page.evaluate(() => (window as typeof window & {
      __previewPanMetrics?: { sidebarMutations: number; stageMutations: number };
    }).__previewPanMetrics);
    expect(metrics?.sidebarMutations).toBe(0);
    expect(metrics?.stageMutations).toBeGreaterThan(0);
  });

  test("can switch back from pan mode to select mode", async ({ page }) => {
    await page.goto("/preview/shape", { waitUntil: "networkidle" });

    const pan = page.getByRole("button", { name: "Pan tool", exact: true });
    const select = page.getByRole("button", { name: "Select tool", exact: true });
    await expect(select).toHaveAttribute("aria-pressed", "true");

    await pan.click();
    await expect(pan).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("preview-viewport")).toHaveClass(/cursor-grab/);
    const layerHitbox = page.locator('[data-layer-hit="shape"]');
    const layerBox = await layerHitbox.boundingBox();
    if (!layerBox) throw new Error("Preview layer hitbox is unavailable");
    await page.mouse.move(layerBox.x + layerBox.width / 2, layerBox.y + layerBox.height / 2);
    await expect.poll(async () => page.evaluate(({ x, y }) => {
      const element = document.elementFromPoint(x, y);
      return element ? getComputedStyle(element).cursor : null;
    }, { x: layerBox.x + layerBox.width / 2, y: layerBox.y + layerBox.height / 2 })).toBe("grab");
    await select.click();

    await expect(select).toHaveAttribute("aria-pressed", "true");
    await expect(pan).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("preview-viewport")).toHaveClass(/cursor-default/);
    await page.mouse.move(layerBox.x + layerBox.width / 2, layerBox.y + layerBox.height / 2);
    await expect.poll(async () => page.evaluate(({ x, y }) => {
      const element = document.elementFromPoint(x, y);
      return element ? getComputedStyle(element).cursor : null;
    }, { x: layerBox.x + layerBox.width / 2, y: layerBox.y + layerBox.height / 2 })).toBe("default");
  });

  test("scales the composition once without desynchronizing the Skia canvas", async ({ page }) => {
    await page.goto("/preview/shape", { waitUntil: "networkidle" });

    const stage = page.getByTestId("preview-stage-frame");
    const canvas = page.getByTestId("readonly-preview-stage");
    await expect(canvas).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });

    const readGeometry = () => page.evaluate(() => {
      const stageElement = document.querySelector<HTMLElement>('[data-testid="preview-stage-frame"]');
      const canvasElement = document.querySelector<HTMLCanvasElement>('[data-testid="readonly-preview-stage"]');
      if (!stageElement || !canvasElement) throw new Error("Preview geometry is unavailable");
      const rectSnapshot = (value: DOMRect) => ({ x: value.x, y: value.y, width: value.width, height: value.height });
      return {
        stage: rectSnapshot(stageElement.getBoundingClientRect()),
        canvas: rectSnapshot(canvasElement.getBoundingClientRect()),
        logicalWidth: canvasElement.clientWidth,
        logicalHeight: canvasElement.clientHeight,
        cssScale: canvasElement.dataset.cssScale,
      };
    });

    const assertCompositionAlignment = async () => {
      const geometry = await readGeometry();
      expect(geometry.canvas.x).toBeCloseTo(geometry.stage.x, 1);
      expect(geometry.canvas.y).toBeCloseTo(geometry.stage.y, 1);
      expect(geometry.canvas.width).toBeCloseTo(geometry.stage.width, 1);
      expect(geometry.canvas.height).toBeCloseTo(geometry.stage.height, 1);
      expect(geometry.logicalWidth).toBe(1920);
      expect(geometry.logicalHeight).toBe(1080);
      expect(geometry.cssScale).toBe("1");
    };

    await expect.poll(async () => Number(await page.getByTestId("preview-viewport").getAttribute("data-zoom"))).toBeCloseTo(0.9, 5);
    await assertCompositionAlignment();

    const zoomIn = page.getByRole("button", { name: "Zoom in preview", exact: true });
    await zoomIn.click();
    await expect.poll(async () => Number(await page.getByTestId("preview-viewport").getAttribute("data-zoom"))).toBeCloseTo(1, 5);
    await assertCompositionAlignment();

    await zoomIn.click();
    await expect.poll(async () => Number(await page.getByTestId("preview-viewport").getAttribute("data-zoom"))).toBeCloseTo(1.1, 5);
    await assertCompositionAlignment();

    await expect(stage).toHaveCSS("transform", /matrix\(/);
  });
});
