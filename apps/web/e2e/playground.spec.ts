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
  });

  test("imports and compiles a single HTML document", async ({ page }) => {
    await page.goto("/playground", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("playground-runtime-canvas")).toHaveAttribute("data-preview-state", /ready|preparing-text|loading-resources/);
    await page.locator('input[type="file"]').setInputFiles(path.resolve(process.cwd(), "e2e/fixtures/playground-valid.html"));
    await expect(page.getByTestId("playground-source")).toContainText("Motion starts here.");
    await expect(page.getByTestId("playground-json")).toContainText('"formatVersion": 2');
  });
});
