# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: preview-v2-atoms.spec.ts >> Protocol V2 atom preview >> fits a full HD composition inside the stage and exposes fixed-frame controls
- Location: e2e\preview-v2-atoms.spec.ts:1706:7

# Error details

```
Error: expect(locator).toHaveText(expected) failed

Locator:  getByTestId('preview-timecode')
Expected: "0:00 / 0:03"
Received: "0:00 / 16:40"
Timeout:  10000ms

Call log:
  - Expect "toHaveText" with timeout 10000ms
  - waiting for getByTestId('preview-timecode')
    24 × locator resolved to <span data-testid="preview-timecode" class="shrink-0 font-mono text-[11px] tabular-nums text-slate-400">…</span>
       - unexpected value "0:00 / 16:40"

```

```yaml
- text: 0:00 / 16:40
```

# Test source

```ts
  1632 |       );
  1633 |       return readWebGLPixel(page, "preview-v2-canvas", x, y);
  1634 |     }
  1635 | 
  1636 |     await expect(pixel("rectangle.transform.translate", 96, 64)).resolves.toEqual(
  1637 |       [0, 170, 136, 255],
  1638 |     );
  1639 |     await expect(pixel("rectangle.transform.translate", 20, 20)).resolves.toEqual(
  1640 |       [16, 24, 32, 255],
  1641 |     );
  1642 | 
  1643 |     await expect(pixel("rectangle.transform.scale", 150, 100)).resolves.toEqual(
  1644 |       [0, 170, 136, 255],
  1645 |     );
  1646 |     await expect(pixel("rectangle.transform.scale", 161, 100)).resolves.toEqual(
  1647 |       [16, 24, 32, 255],
  1648 |     );
  1649 | 
  1650 |     await expect(pixel("rectangle.transform.anchor", 150, 100)).resolves.toEqual(
  1651 |       [0, 170, 136, 255],
  1652 |     );
  1653 |     await expect(pixel("rectangle.transform.anchor", 120, 70)).resolves.toEqual(
  1654 |       [16, 24, 32, 255],
  1655 |     );
  1656 | 
  1657 |     await expect(pixel("rectangle.transform.rotate", 200, 110)).resolves.toEqual(
  1658 |       [0, 170, 136, 255],
  1659 |     );
  1660 |     await expect(pixel("rectangle.transform.rotate", 170, 110)).resolves.toEqual(
  1661 |       [16, 24, 32, 255],
  1662 |     );
  1663 | 
  1664 |     const outsideAnchor = await pixel(
  1665 |       "rectangle.mat4.anchor-outside-rotate-z",
  1666 |       500,
  1667 |       250,
  1668 |     );
  1669 |     expect(outsideAnchor).toEqual([0, 170, 136, 255]);
  1670 | 
  1671 |     const perspective = await pixel(
  1672 |       "rectangle.mat4.anchor-z-rotate-y-perspective",
  1673 |       960,
  1674 |       540,
  1675 |     );
  1676 |     expect(perspective).toEqual([0, 170, 136, 255]);
  1677 | 
  1678 |     await expect(pixel("rectangle.transform.skew", 100, 70)).resolves.toEqual(
  1679 |       [0, 170, 136, 255],
  1680 |     );
  1681 |     await expect(pixel("rectangle.transform.skew", 45, 85)).resolves.toEqual(
  1682 |       [16, 24, 32, 255],
  1683 |     );
  1684 | 
  1685 |     await expect(pixel("rectangle.timing", 50, 35, 0.999)).resolves.toEqual([
  1686 |       16, 24, 32, 255,
  1687 |     ]);
  1688 |     await expect(pixel("rectangle.timing", 50, 35, 1)).resolves.toEqual([
  1689 |       0, 170, 136, 255,
  1690 |     ]);
  1691 |     await expect(pixel("rectangle.timing", 50, 35, 2)).resolves.toEqual([
  1692 |       16, 24, 32, 255,
  1693 |     ]);
  1694 | 
  1695 |     await expect(pixel("rectangle.opacity", 50, 35)).resolves.toEqual([
  1696 |       8, 97, 84, 255,
  1697 |     ]);
  1698 |     await expect(pixel("rectangle.order", 960, 540)).resolves.toEqual([
  1699 |       255, 51, 102, 255,
  1700 |     ]);
  1701 |     await expect(pixel("rectangle.order", 400, 250)).resolves.toEqual([
  1702 |       0, 170, 136, 255,
  1703 |     ]);
  1704 |   });
  1705 | 
  1706 |   test("fits a full HD composition inside the stage and exposes fixed-frame controls", async ({
  1707 |     page,
  1708 |   }) => {
  1709 |     await page.goto("/docs/preview?case=primitive.shape.rectangle&backend=webgl2");
  1710 |     const canvas = page.getByTestId("preview-v2-canvas");
  1711 |     const stage = page.getByTestId("preview-v2-stage");
  1712 |     const sidebar = page.locator('[data-testid="preview-v2-lab"] > aside');
  1713 |     await expect(canvas).toHaveJSProperty("width", 1920);
  1714 |     await expect(canvas).toHaveJSProperty("height", 1080);
  1715 |     await expect(canvas).toHaveAttribute("data-device-pixel-ratio", "1");
  1716 |     await expect(canvas).toHaveAttribute("data-backing-width", "1920");
  1717 |     await expect(canvas).toHaveAttribute("data-backing-height", "1080");
  1718 |     await expect(stage).toBeVisible();
  1719 |     await expect(sidebar).toBeVisible();
  1720 |     const sidebarLayout = await sidebar.evaluate((node) => {
  1721 |       const rect = node.getBoundingClientRect();
  1722 |       return {
  1723 |         width: rect.width,
  1724 |         position: getComputedStyle(node).position,
  1725 |         height: rect.height,
  1726 |       };
  1727 |     });
  1728 |     expect(sidebarLayout.width).toBeGreaterThanOrEqual(300);
  1729 |     expect(sidebarLayout.position).toBe("sticky");
  1730 |     expect(sidebarLayout.height).toBeGreaterThan(600);
  1731 |     await expect(page.getByTestId("preview-transport")).toBeVisible();
> 1732 |     await expect(page.getByTestId("preview-timecode")).toHaveText("0:00 / 0:03");
       |                                                        ^ Error: expect(locator).toHaveText(expected) failed
  1733 |     await expect(page.getByText("Fixed frame")).toBeVisible();
  1734 |   });
  1735 | 
  1736 |   test("renders a V2 video preview at deterministic requested times", async ({
  1737 |     page,
  1738 |   }) => {
  1739 |     await page.goto("/docs/preview?case=video.frame-seek&backend=webgl2&time=0");
  1740 |     const slider = page.getByTestId("preview-time-slider");
  1741 |     await expect(slider).toHaveValue("0");
  1742 | 
  1743 |     await slider.fill("1");
  1744 |     await expect(slider).toHaveValue("1");
  1745 |     await expect(page.getByTestId("preview-timecode")).toHaveText("0:01 / 0:03");
  1746 |     await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
  1747 |       "data-video-times",
  1748 |       "video:1.000:visible",
  1749 |       { timeout: 10_000 },
  1750 |     );
  1751 |   });
  1752 | 
  1753 |   test("keeps 3D rectangle bounds and interior pixels within backend tolerance", async ({
  1754 |     page,
  1755 |   }) => {
  1756 |     const cases = [
  1757 |       "rectangle.mat4.rotate-x-perspective",
  1758 |       "rectangle.mat4.rotate-y-perspective",
  1759 |       "rectangle.mat4.anchor-z-rotate-y-perspective",
  1760 |       "rectangle.mat4.translate-z-perspective",
  1761 |     ];
  1762 |     const webglResults = new Map<string, Awaited<ReturnType<typeof analyzePresentedCanvas>>>();
  1763 |     for (const caseId of cases) {
  1764 |       await page.goto(`/docs/preview?case=${caseId}&backend=webgl2`);
  1765 |       await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
  1766 |         "data-backend",
  1767 |         "webgl2",
  1768 |       );
  1769 |       webglResults.set(
  1770 |         caseId,
  1771 |         await analyzePresentedCanvas(page, "preview-v2-canvas"),
  1772 |       );
  1773 |     }
  1774 | 
  1775 |     await page.goto(
  1776 |       "/docs/preview?case=rectangle.mat4.rotate-x-perspective&backend=webgl2",
  1777 |     );
  1778 |     test.skip(!(await supportsWebGPU(page)), "WebGPU is unavailable in this browser");
  1779 | 
  1780 |     for (const caseId of cases) {
  1781 |       await page.goto(`/docs/preview?case=${caseId}&backend=webgpu`);
  1782 |       await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
  1783 |         "data-backend",
  1784 |         "webgpu",
  1785 |       );
  1786 |       const webgpu = await analyzePresentedCanvas(page, "preview-v2-canvas");
  1787 |       const webgl = webglResults.get(caseId)!;
  1788 |       expect(webgpu.width).toBe(webgl.width);
  1789 |       expect(webgpu.height).toBe(webgl.height);
  1790 |       expect(webgpu.center).toEqual([0, 170, 136, 255]);
  1791 |       expect(webgl.center).toEqual([0, 170, 136, 255]);
  1792 |       expect(webgpu.bounds).not.toBeNull();
  1793 |       expect(webgl.bounds).not.toBeNull();
  1794 |       expect(Math.abs(webgpu.bounds!.left - webgl.bounds!.left)).toBeLessThanOrEqual(1);
  1795 |       expect(Math.abs(webgpu.bounds!.top - webgl.bounds!.top)).toBeLessThanOrEqual(1);
  1796 |       expect(Math.abs(webgpu.bounds!.right - webgl.bounds!.right)).toBeLessThanOrEqual(1);
  1797 |       expect(Math.abs(webgpu.bounds!.bottom - webgl.bounds!.bottom)).toBeLessThanOrEqual(1);
  1798 |       expect(webgpu.partialCoveragePixels).toBeGreaterThan(0);
  1799 |       expect(webgl.partialCoveragePixels).toBeGreaterThan(0);
  1800 |       expect(webgpu.darkFringePixels).toBe(0);
  1801 |       expect(webgl.darkFringePixels).toBe(0);
  1802 |     }
  1803 |   });
  1804 | 
  1805 |   test("reports WebGL2 antialias capability at the native canvas resolution", async ({
  1806 |     page,
  1807 |   }) => {
  1808 |     await page.goto("/docs/preview?case=rectangle.mat4.rotate-x-perspective&backend=webgl2");
  1809 |     const info = await page.getByTestId("preview-v2-canvas").evaluate((node) => {
  1810 |       if (!(node instanceof HTMLCanvasElement)) throw new Error("Expected canvas");
  1811 |       const gl = node.getContext("webgl2");
  1812 |       if (!gl) throw new Error("WebGL2 context is not available");
  1813 |       return {
  1814 |         antialias: gl.getContextAttributes()?.antialias ?? false,
  1815 |         samples: gl.getParameter(gl.SAMPLES) as number,
  1816 |         width: node.width,
  1817 |         height: node.height,
  1818 |       };
  1819 |     });
  1820 |     expect(info.antialias).toBe(true);
  1821 |     expect(info.samples).toBeGreaterThanOrEqual(0);
  1822 |     expect(info.width).toBe(1920);
  1823 |     expect(info.height).toBe(1080);
  1824 |   });
  1825 | });
  1826 | 
  1827 | test.describe("Task 4.5 physical canvas", () => {
  1828 |   test.use({ deviceScaleFactor: 2 });
  1829 | 
  1830 |   test("keeps logical composition dimensions while backing the canvas at DPR 2", async ({
  1831 |     page,
  1832 |   }) => {
```