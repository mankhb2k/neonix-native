import { expect, test } from "@playwright/test";

test.describe("V2 preview layer hit testing", () => {
  test("keeps the preview surface locked to the composition aspect ratio", async ({ page }) => {
    await page.goto("/app/editor/three-kingdoms");
    const stage = page.getByTestId("preview-v2-stage");
    await expect(stage).toBeVisible();
    const box = await stage.boundingBox();
    if (!box) throw new Error("preview stage has no layout box");
    expect(box.width / box.height).toBeCloseTo(16 / 9, 2);
  });

  test("selects the highest-order overlapping layer", async ({ page }) => {
    await page.goto("/app/editor/three-kingdoms");
    await expect(page.getByTestId("preview-v2-stage")).toBeVisible();

    // At t=0 the chapter card and title overlap exactly. The title has the
    // higher order and must own the hit area in the preview.
    const titleHitbox = page.locator('[data-layer-hit="chapter-1-title"]');
    await expect(titleHitbox).toBeVisible();
    await titleHitbox.click();

    await expect(page.locator('[data-layer-id="chapter-1-title"]')).toHaveClass(
      /border-\[var\(--accent\)\]/,
    );
    await expect(page.getByTestId("stage-selection-bounds")).toBeVisible();
  });

  test("resizes a selected shape from the east handle", async ({ page }) => {
    await page.goto("/app/editor/shape");
    await expect(page.getByTestId("preview-v2-stage")).toBeVisible();

    await page.locator('[data-layer-hit="shape"]').click();
    const widthInput = page.getByRole("spinbutton", { name: "Width", exact: true });
    await expect(widthInput).toHaveValue("960");

    const handle = page.locator('[data-testid="stage-selection-bounds"] [data-handle="e"]');
    const box = await handle.boundingBox();
    if (!box) throw new Error("east resize handle is not visible");
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX + 12, centerY);
    await page.mouse.up();

    await expect(widthInput).not.toHaveValue("960");
  });

  test("keeps the default cursor while moving a selected layer", async ({ page }) => {
    await page.goto("/app/editor/shape");
    await expect(page.getByTestId("preview-v2-stage")).toBeVisible();

    await page.locator('[data-layer-hit="shape"]').click();
    const selection = page.getByTestId("stage-selection-bounds");
    const box = await selection.boundingBox();
    if (!box) throw new Error("selection bounds are not visible");

    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 12, startY + 8);

    await expect.poll(async () =>
      page.evaluate(() => document.documentElement.style.cursor),
    ).toBe("default");

    await page.mouse.up();
    await expect.poll(async () =>
      page.evaluate(() => document.documentElement.style.cursor),
    ).toBe("");
  });

  test("routes clicks through a selected full-canvas media layer", async ({ page }) => {
    await page.goto("/app/editor/three-kingdoms");
    await expect(page.getByTestId("preview-v2-stage")).toBeVisible();

    await page.locator('[data-layer-id="historical-atmosphere"]').click();
    await expect(page.locator('[data-layer-id="historical-atmosphere"]')).toHaveClass(
      /border-\[var\(--accent\)\]/,
    );

    // The title is above the full-canvas media layer. Its hitbox coordinate
    // is intentionally clicked while the media selection bounds is active.
    const titleHitbox = page.locator('[data-layer-hit="chapter-1-title"]');
    const titleBox = await titleHitbox.boundingBox();
    if (!titleBox) throw new Error("chapter title hitbox is not visible");
    await page.mouse.click(
      titleBox.x + titleBox.width / 2,
      titleBox.y + titleBox.height / 2,
    );
    await expect(page.locator('[data-layer-id="chapter-1-title"]')).toHaveClass(
      /border-\[var\(--accent\)\]/,
    );
  });

  test("rotates a selected shape from a corner rotation zone", async ({ page }) => {
    await page.goto("/app/editor/shape");
    await expect(page.getByTestId("preview-v2-stage")).toBeVisible();
    await page.locator('[data-layer-hit="shape"]').click();

    const rotationInput = page.getByRole("spinbutton", { name: "Rotation Z", exact: true });
    await expect(rotationInput).toHaveValue("0");
    const selection = page.getByTestId("stage-selection-bounds");
    const selectionBox = await selection.boundingBox();
    const rotateZone = page.locator('[data-rotate-handle="ne"]');
    const zoneBox = await rotateZone.boundingBox();
    if (!selectionBox || !zoneBox) throw new Error("corner rotation zone is not visible");

    const startX = zoneBox.x + zoneBox.width / 2;
    const startY = zoneBox.y + zoneBox.height / 2;
    const centerX = selectionBox.x + selectionBox.width / 2;
    const centerY = selectionBox.y + selectionBox.height / 2;
    const radius = Math.max(24, Math.hypot(startX - centerX, startY - centerY));
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(centerX - radius * 0.707, centerY - radius * 0.707);
    await page.mouse.up();

    await expect.poll(async () => Number(await rotationInput.inputValue())).toBeLessThan(0);
  });

  test("lets a lower layer receive clicks outside a rotated upper quad", async ({ page }) => {
    await page.goto("/app/editor/three-kingdoms");
    await expect(page.getByTestId("preview-v2-stage")).toBeVisible();
    await page.locator('[data-layer-hit="chapter-1-title"]').click();

    const rotationInput = page.getByRole("spinbutton", { name: "Rotation Z", exact: true });
    await rotationInput.fill("30");
    await rotationInput.press("Enter");
    await expect(rotationInput).toHaveValue("30");

    const stage = page.getByTestId("preview-v2-stage");
    const stageBox = await stage.boundingBox();
    if (!stageBox) throw new Error("preview stage is not measurable");
    // This point is inside the rotated title's axis-aligned bounds but above
    // its actual quad; the card underneath must receive the click.
    await page.mouse.click(
      stageBox.x + (960 / 1920) * stageBox.width,
      stageBox.y + (370 / 1080) * stageBox.height,
    );
    await expect(page.locator('[data-layer-id="chapter-1-card"]')).toHaveClass(
      /border-\[var\(--accent\)\]/,
    );
  });

  test("hides a layer from preview and disables its stage hitbox", async ({ page }) => {
    await page.goto("/app/editor/shape");
    await expect(page.getByTestId("preview-v2-stage")).toBeVisible();
    await expect(page.locator('[data-layer-hit="shape"]')).toBeVisible();

    await page.getByRole("button", { name: "Hide shape", exact: true }).click();
    await expect(page.locator('[data-layer-hit="shape"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Show shape", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Show shape", exact: true }).click();
    await expect(page.locator('[data-layer-hit="shape"]')).toBeVisible();
  });

  test("locks a layer so it cannot be selected from the stage", async ({ page }) => {
    await page.goto("/app/editor/shape");
    await expect(page.getByTestId("preview-v2-stage")).toBeVisible();

    await page.getByRole("button", { name: "Lock shape", exact: true }).click();
    await expect(page.locator('[data-layer-hit="shape"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Unlock shape", exact: true })).toBeVisible();
  });

  test("zooms the preview with the stage button group", async ({ page }) => {
    await page.goto("/app/editor/shape");
    await expect(page.getByTestId("preview-v2-stage")).toBeVisible();

    const controls = page.getByTestId("stage-zoom-controls");
    const zoomPercent = page.getByTestId("stage-zoom-percent");
    let initialZoom = 0;
    let previousZoom = -1;
    await expect.poll(async () => {
      initialZoom = Number((await zoomPercent.textContent())?.replace("%", ""));
      const stable = initialZoom === previousZoom;
      previousZoom = initialZoom;
      return stable ? initialZoom : 0;
    }).toBeGreaterThan(0);
    expect(initialZoom).toBeGreaterThan(0);
    await controls.getByRole("button", { name: "Zoom in preview" }).click();
    await expect.poll(async () => Number((await zoomPercent.textContent())?.replace("%", ""))).toBeGreaterThan(initialZoom);
    await expect(page.getByRole("button", { name: "Fit preview" })).toBeVisible();

    await page.getByRole("button", { name: "Fit preview" }).click();
    await expect(zoomPercent).toHaveText(`${initialZoom}%`);
  });

  test("pans the preview with H pan mode", async ({ page }) => {
    await page.goto("/app/editor/shape");
    await expect(page.getByTestId("preview-v2-stage")).toBeVisible();

    const viewport = page.locator('[data-pan-mode="inactive"]');
    const frame = page.locator("[data-pan-x]");
    const box = await frame.boundingBox();
    if (!box) throw new Error("stage frame is not measurable");

    await page.keyboard.press("h");
    await expect(page.locator('[data-pan-mode="active"]')).toBeVisible();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 24, box.y + box.height / 2 + 12);
    await page.mouse.up();
    await page.keyboard.press("h");

    await expect(viewport).toHaveAttribute("data-pan-mode", "inactive");
    await expect.poll(async () => Number(await frame.getAttribute("data-pan-x"))).toBeGreaterThan(0);
    await expect.poll(async () => Number(await frame.getAttribute("data-pan-y"))).toBeGreaterThan(0);
  });

  test("switches back to select mode with V", async ({ page }) => {
    await page.goto("/app/editor/shape");
    await expect(page.getByTestId("preview-v2-stage")).toBeVisible();

    await page.keyboard.press("h");
    await expect(page.locator('[data-pan-mode="active"]')).toBeVisible();
    await expect.poll(async () =>
      page.getByTestId("stage-transform-overlay").evaluate((element) =>
        getComputedStyle(element).cursor,
      ),
    ).toBe("grab");
    await page.keyboard.press("v");
    await expect(page.locator('[data-pan-mode="inactive"]')).toBeVisible();
  });

  test("switches from pan to select when the rail button is clicked", async ({ page }) => {
    await page.goto("/app/editor/shape");
    const rail = page.getByTestId("stage-tool-rail");
    await rail.getByRole("button", { name: "Pan tool" }).click();
    await expect(page.locator('[data-pan-mode="active"]')).toBeVisible();
    await rail.getByRole("button", { name: "Select tool" }).click();
    await expect(page.locator('[data-pan-mode="inactive"]')).toBeVisible();
  });

  test("renders stage-local select, pan, shape, and text tools", async ({ page }) => {
    await page.goto("/app/editor/shape");
    const rail = page.getByTestId("stage-tool-rail");
    await expect(rail).toBeVisible();
    await expect(rail.getByRole("button", { name: "Select tool" })).toBeVisible();
    await expect(rail.getByRole("button", { name: "Pan tool" })).toBeVisible();
    await expect(rail.getByRole("button", { name: "Shape tool" })).toBeVisible();
    await expect(rail.getByRole("button", { name: "Path tool" })).toHaveCount(0);
    await expect(rail.getByRole("button", { name: "Text tool" })).toBeVisible();

    await rail.getByRole("button", { name: "Shape tool" }).click();
    await expect(page.getByTestId("editor-shapes-menu")).toBeVisible();

    await rail.getByRole("button", { name: "Text tool" }).click();
    await expect(page.locator('[data-layer-hit="text-default"]')).toHaveCount(1);
  });
});
