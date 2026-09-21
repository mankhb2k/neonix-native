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
    uri: "/preview/font/Inter/Inter-400.ttf",
    mimeType: "font/ttf",
    family: "Inter",
    weight: 400,
    style: "normal",
    integrity: "sha256:72744c3ebeded883deac5ca28ddd410b92c8f8538b9e8e87b503097fccb8f35c",
  },
  {
    id: "preview-font-inter-bold",
    kind: "font",
    uri: "/preview/font/Inter/Inter-700.ttf",
    mimeType: "font/ttf",
    family: "Inter",
    weight: 700,
    style: "normal",
    integrity: "sha256:d1880c32462082e10b7e20a0a51adca9546c04666a4dba32f4f061a307b2cd28",
  },
];
