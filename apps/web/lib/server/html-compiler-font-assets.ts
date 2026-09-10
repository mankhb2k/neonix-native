import type { HtmlCompilerFontAsset } from "@motionvideo/html-compiler";

/**
 * Deterministic built-in font catalog for the public HTML compile endpoint.
 * User-uploaded font catalogs can be added here when project asset resolution
 * is wired into the API; keeping the catalog explicit prevents runtime font
 * fallback from changing the compiled Protocol V2 layout.
 */
export const HTML_COMPILER_FONT_ASSETS: readonly HtmlCompilerFontAsset[] = [
  {
    id: "preview-font-inter-regular",
    kind: "font",
    uri: "/preview/font/Inter/Inter_18pt-Regular.ttf",
    mimeType: "font/ttf",
    family: "Inter",
    weight: 400,
    style: "normal",
    integrity: "sha256:3e5f90a0138b38de4cf4d779ad78391974ea1df776b9164842bdcbb60ce383c5",
  },
  {
    id: "preview-font-inter-bold",
    kind: "font",
    uri: "/preview/font/Inter/Inter_18pt-Bold.ttf",
    mimeType: "font/ttf",
    family: "Inter",
    weight: 700,
    style: "normal",
    integrity: "sha256:30a5c45ec23a594af2effe8d3b589ad22c2dede27441050a1604d00ff82fd0dc",
  },
];
