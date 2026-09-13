import { expect, test } from "@playwright/test";
import path from "node:path";

const FOCUSED_FIXTURES = [
  "phase8-inset-stroke-rounded-medium-halo-medium",
  "phase8-inset-stroke-rounded-medium-halo-large",
  "phase8-inset-stroke-rounded-large-halo-medium",
  "phase8-inset-stroke-rounded-large-halo-large",
  "phase8-outer-glow-plain",
  "phase8-outer-glow-rounded",
  "phase8-outer-glow-border",
  "phase8-outer-glow-offset",
  "phase8-outer-inner-glow-combined",
  "phase8-outer-glow-stack",
  "phase8-inner-glow-stack",
  "phase8-outer-inner-glow-order",
  "phase8-inner-outer-glow-order",
  "phase8-outer-glow-overlay-only",
  "phase8-inner-glow-mask-only",
  "phase8-mixed-glow-order-colors",
] as const;

const DIAGNOSTIC_FIXTURES = ["phase8-outer-glow-spread"] as const;

test.describe("HTML compiler playground", () => {
  test("mounts the Browser and Runtime/Skia screens", async ({ page }) => {
    await page.goto("/playground", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("html-compiler-playground")).toBeVisible();
    await expect(page.getByTestId("playground-import")).toBeVisible();
    await expect(page.getByTestId("playground-two-panel")).toBeVisible();
    await expect(page.getByTestId("playground-browser-stage")).toBeVisible();
    await expect(page.getByTestId("playground-runtime-stage")).toBeVisible();
    await expect(page.getByTestId("playground-runtime-canvas")).toHaveAttribute("data-preview-state", /ready|preparing-text|loading-resources/);
  });

  test("imports and compiles a custom HTML document", async ({ page }) => {
    await page.goto("/playground", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("playground-runtime-canvas")).toHaveAttribute("data-preview-state", /ready|preparing-text|loading-resources/);
    await page.locator('input[type="file"]').setInputFiles(path.resolve(process.cwd(), "e2e/fixtures/playground-valid.html"));
    await expect(page.getByTestId("playground-source")).toContainText("Motion starts here.");
    await expect(page.getByTestId("playground-json")).toContainText('"formatVersion": 2');
    await expect(page).not.toHaveURL(/fixture=/);
  });

  test("persists the selected fixture in the URL across reloads", async ({ page }) => {
    await page.goto("/playground?fixture=phase8-inset-stroke-rounded-medium-halo-medium", { waitUntil: "domcontentloaded" });
    const picker = page.getByTestId("playground-fixture-picker");
    await expect(picker).toHaveValue("phase8-inset-stroke-rounded-medium-halo-medium");
    await expect(page.getByTestId("playground-source")).toContainText("inset-stroke-rounded-medium-halo-medium");

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(picker).toHaveValue("phase8-inset-stroke-rounded-medium-halo-medium");
    await expect(page.getByTestId("playground-source")).toContainText("inset-stroke-rounded-medium-halo-medium");
    await picker.selectOption("phase8-inset-stroke-rounded-large-halo-large");
    await expect(picker).toHaveValue("phase8-inset-stroke-rounded-large-halo-large");
    await expect(page.getByTestId("playground-source")).toContainText("inset-stroke-rounded-large-halo-large");
    await expect(page).toHaveURL(/\/playground\?fixture=phase8-inset-stroke-rounded-large-halo-large$/);
  });

  test("exposes only focused effect fixtures", async ({ page }) => {
    await page.goto("/playground", { waitUntil: "domcontentloaded" });
    const picker = page.getByTestId("playground-fixture-picker");
    const canvas = page.getByTestId("playground-runtime-canvas");
    await expect(canvas).toHaveAttribute("data-preview-state", /ready|preparing-text|loading-resources/);
    await expect(picker).toBeVisible();
    await expect(picker.locator("option")).toHaveCount(1 + FOCUSED_FIXTURES.length + DIAGNOSTIC_FIXTURES.length);
    const values = await picker.locator("option").evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
    expect(values).toEqual([
      "custom",
      ...FOCUSED_FIXTURES,
      ...DIAGNOSTIC_FIXTURES,
    ]);

    for (const fixtureId of FOCUSED_FIXTURES) {
      await picker.selectOption(fixtureId);
      await expect(picker).toHaveValue(fixtureId);
      await expect(page).toHaveURL(new RegExp(`/playground\\?fixture=${fixtureId}$`));
      await expect(page.getByTestId("playground-json")).toContainText('"formatVersion": 2');
      await expect(canvas).toHaveAttribute("data-preview-state", "ready");
      await expect(canvas).not.toHaveAttribute("data-diagnostics", /invalid matrix argument|effect_program|skia_effect_unsupported/);
    }

    await expect(picker.locator('option[value="phase8-outer-glow-spread"]')).toHaveCount(1);
  });
});
