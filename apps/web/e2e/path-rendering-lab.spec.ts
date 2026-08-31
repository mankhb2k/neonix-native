import { expect, test } from "@playwright/test";

async function selectCase(page: import("@playwright/test").Page, id: string): Promise<unknown[]> {
  await page.locator("select").selectOption(id);
  await expect(page.getByTestId("path-debug-webgl2")).toHaveAttribute("data-backend", "webgl2", { timeout: 30_000 });
  await expect.poll(async () => {
    const text = await page.getByTestId("path-rendering-measurements").textContent();
    return text?.includes("webgl2") ?? false;
  }).toBe(true);
  return JSON.parse(await page.getByTestId("path-rendering-measurements").textContent() ?? "[]") as unknown[];
}

test.describe("Path rendering parity lab", () => {
  test("renders SVG reference and measures core Runtime cases", async ({ page }) => {
    await page.goto("/debug/path-rendering");
    await expect(page.getByTestId("path-rendering-lab")).toBeVisible();
    await expect(page.getByLabel("SVG reference")).toBeVisible();
    for (const id of ["join-round", "round-right-angle", "round-acute", "round-zigzag", "round-closed", "closed-dash", "shape-dash"]) {
      const measurements = await selectCase(page, id) as Array<{ backend: string; backgroundHoles: number; probes: Array<{ actual: string; expected: string }> }>;
      const webgl = measurements.find((entry) => entry.backend === "webgl2");
      expect(webgl).toBeDefined();
      expect(webgl!.backgroundHoles).toBe(0);
      expect(webgl!.probes.every((probe) => probe.actual === probe.expected)).toBe(true);
    }
  });
});
