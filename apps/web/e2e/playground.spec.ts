import { expect, test } from "@playwright/test";
import path from "node:path";

const FOCUSED_FIXTURES = [
  "review-grid-opacity-thirty",
  "review-grid-default-opacity",
  "review-grid-composition-baseline",
  "review-grid-composition-baseline-1px",
  "review-grid-repeat-x",
  "review-grid-repeat-y",
  "review-grid-no-repeat",
  "phase8-inset-rounded-small",
  "phase8-inset-rounded-medium",
  "phase8-inset-rounded-large",
  "phase8-inset-transparent-rounded-small",
  "phase8-inset-transparent-rounded-medium",
  "phase8-inset-transparent-rounded-large",
] as const;

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
    await page.goto("/playground?fixture=phase8-inset-rounded-medium", { waitUntil: "domcontentloaded" });
    const picker = page.getByTestId("playground-fixture-picker");
    await expect(picker).toHaveValue("phase8-inset-rounded-medium");
    await expect(page.getByTestId("playground-source")).toContainText("inset-rounded-medium");

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(picker).toHaveValue("phase8-inset-rounded-medium");
    await expect(page.getByTestId("playground-source")).toContainText("inset-rounded-medium");
    await picker.selectOption("phase8-inset-transparent-rounded-large");
    await expect(picker).toHaveValue("phase8-inset-transparent-rounded-large");
    await expect(page.getByTestId("playground-source")).toContainText("inset-transparent-rounded-large");
    await expect(page).toHaveURL(/\/playground\?fixture=phase8-inset-transparent-rounded-large$/);
  });

  test("exposes only focused grid and inset-glow fixtures", async ({ page }) => {
    await page.goto("/playground", { waitUntil: "domcontentloaded" });
    const picker = page.getByTestId("playground-fixture-picker");
    const canvas = page.getByTestId("playground-runtime-canvas");
    await expect(canvas).toHaveAttribute("data-preview-state", /ready|preparing-text|loading-resources/);
    await expect(picker).toBeVisible();
    await expect(picker.locator("option")).toHaveCount(14);
    const values = await picker.locator("option").evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
    expect(values).toEqual([
      "custom",
      ...FOCUSED_FIXTURES,
    ]);

    for (const fixtureId of FOCUSED_FIXTURES) {
      await picker.selectOption(fixtureId);
      await expect(picker).toHaveValue(fixtureId);
      await expect(page).toHaveURL(new RegExp(`/playground\\?fixture=${fixtureId}$`));
      await expect(page.getByTestId("playground-json")).toContainText('"formatVersion": 2');
      await expect(canvas).toHaveAttribute("data-preview-state", "ready");
      await expect(canvas).not.toHaveAttribute("data-diagnostics", /invalid matrix argument|effect_program/);
    }
  });
});
