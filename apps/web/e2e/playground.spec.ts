import { expect, test } from "@playwright/test";
import path from "node:path";

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
    await page.goto("/playground?fixture=box-shadow-outer-glow", { waitUntil: "domcontentloaded" });
    const picker = page.getByTestId("playground-fixture-picker");
    await expect(picker).toHaveValue("box-shadow-outer-glow");
    await expect(page.getByTestId("playground-source")).toContainText("box-shadow-outer-glow");

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(picker).toHaveValue("box-shadow-outer-glow");
    await expect(page.getByTestId("playground-source")).toContainText("box-shadow-outer-glow");
    await picker.selectOption("inner-glow");
    await expect(picker).toHaveValue("inner-glow");
    await expect(page.getByTestId("playground-source")).toContainText("inner-glow");
    await expect(page).toHaveURL(/\/playground\?fixture=inner-glow$/);
  });
});
