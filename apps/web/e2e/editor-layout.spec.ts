import { expect, test, type Page } from "@playwright/test";

const LAYOUT_KEY = "neonix:editor-layout:v1";

async function cssLayoutValue(page: Page, name: string) {
  return page.getByTestId("editor-shell").evaluate((element, variable) =>
    getComputedStyle(element).getPropertyValue(variable).trim(), name);
}

test.describe("Resizable editor panels", () => {
  test("resizes sidebar, inspector, and timeline independently", async ({ page }) => {
    await page.addInitScript((key) => window.localStorage.removeItem(key), LAYOUT_KEY);
    await page.goto("/app/editor/shape");
    await expect(page.getByTestId("editor-shell")).toBeVisible();

    const sidebarHandle = page.getByTestId("editor-resize-sidebar");
    const inspectorHandle = page.getByTestId("editor-resize-inspector");
    const timelineHandle = page.getByTestId("editor-resize-timeline");
    await expect(sidebarHandle).toBeVisible();
    await expect(inspectorHandle).toBeVisible();
    await expect(timelineHandle).toBeVisible();

    const sidebarBox = await sidebarHandle.boundingBox();
    if (!sidebarBox) throw new Error("sidebar resize handle is not measurable");
    await page.mouse.move(sidebarBox.x + sidebarBox.width / 2, sidebarBox.y + 120);
    await page.mouse.down();
    await page.mouse.move(sidebarBox.x + sidebarBox.width / 2 + 32, sidebarBox.y + 120);
    await page.mouse.up();
    await expect.poll(() => cssLayoutValue(page, "--editor-left-w")).toBe("412px");

    const inspectorBox = await inspectorHandle.boundingBox();
    if (!inspectorBox) throw new Error("inspector resize handle is not measurable");
    await page.mouse.move(inspectorBox.x + inspectorBox.width / 2, inspectorBox.y + 120);
    await page.mouse.down();
    await page.mouse.move(inspectorBox.x + inspectorBox.width / 2 - 28, inspectorBox.y + 120);
    await page.mouse.up();
    await expect.poll(() => cssLayoutValue(page, "--editor-right-w")).toBe("448px");

    const timelineBox = await timelineHandle.boundingBox();
    if (!timelineBox) throw new Error("timeline resize handle is not measurable");
    await page.mouse.move(timelineBox.x + 120, timelineBox.y + timelineBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(timelineBox.x + 120, timelineBox.y + timelineBox.height / 2 - 36);
    await page.mouse.up();
    await expect.poll(() => cssLayoutValue(page, "--editor-timeline-h")).toBe("276px");

    await sidebarHandle.dblclick();
    await expect.poll(() => cssLayoutValue(page, "--editor-left-w")).toBe("380px");
  });
});
