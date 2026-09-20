import { test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const OUT_DIR = path.resolve(__dirname, "../../../tmp/box2-visual");

test("visually capture box2 corner clean", async ({ page }) => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await page.setViewportSize({ width: 1920, height: 1400 });
  await page.goto("/playground/native-stage");
  await page.getByTestId("radial-native-group-picker").selectOption("debug");
  await page.getByTestId("radial-native-case-picker").selectOption("debug-border-dashed-rounded-radius-sweep");
  await page.waitForSelector('[data-preview-state="ready"]', { timeout: 30000 });
  const iframe = page.getByTestId("radial-native-browser-iframe");
  const canvas = page.getByTestId("radial-native-skia-canvas");
  await iframe.screenshot({ path: path.join(OUT_DIR, "browser.png"), clip: { x: 380, y: 90, width: 200, height: 200 } });
  await canvas.screenshot({ path: path.join(OUT_DIR, "canvaskit.png"), clip: { x: 380, y: 90, width: 200, height: 200 } });
});
