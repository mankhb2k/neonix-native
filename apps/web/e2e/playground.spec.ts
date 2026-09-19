import { expect, test } from "@playwright/test";
import path from "node:path";

const FOCUSED_FIXTURES = [
  "inset-stroke-rounded-medium-halo-medium",
  "inset-stroke-rounded-medium-halo-large",
  "inset-stroke-rounded-large-halo-medium",
  "inset-stroke-rounded-large-halo-large",
  "outer-glow-plain",
  "outer-glow-rounded",
  "outer-glow-border",
  "outer-glow-offset",
  "outer-inner-glow-combined",
  "outer-glow-stack",
  "inner-glow-stack",
  "outer-inner-glow-order",
  "inner-outer-glow-order",
  "outer-glow-overlay-only",
  "inner-glow-mask-only",
  "mixed-glow-order-colors",
] as const;

const DIAGNOSTIC_FIXTURES = ["outer-glow-spread"] as const;

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
    await page.goto("/playground?fixture=inset-stroke-rounded-medium-halo-medium", { waitUntil: "domcontentloaded" });
    const picker = page.getByTestId("playground-fixture-picker");
    await expect(picker).toHaveValue("inset-stroke-rounded-medium-halo-medium");
    await expect(page.getByTestId("playground-source")).toContainText("inset-stroke-rounded-medium-halo-medium");

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(picker).toHaveValue("inset-stroke-rounded-medium-halo-medium");
    await expect(page.getByTestId("playground-source")).toContainText("inset-stroke-rounded-medium-halo-medium");
    await picker.selectOption("inset-stroke-rounded-large-halo-large");
    await expect(picker).toHaveValue("inset-stroke-rounded-large-halo-large");
    await expect(page.getByTestId("playground-source")).toContainText("inset-stroke-rounded-large-halo-large");
    await expect(page).toHaveURL(/\/playground\?fixture=inset-stroke-rounded-large-halo-large$/);
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

    await expect(picker.locator('option[value="outer-glow-spread"]')).toHaveCount(1);
  });
});
