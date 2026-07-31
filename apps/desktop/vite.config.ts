import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { PROD_RENDERER_CSP } from "./src/shared/renderer-mode";

const isRelease =
  process.env.MOTIONVIDEO_RELEASE === "1" ||
  process.env.MOTIONVIDEO_RELEASE === "true";

export default defineConfig({
  root: path.resolve(__dirname, "renderer"),
  base: "./",
  plugins: [
    react(),
    {
      name: "motionvideo-prod-csp",
      transformIndexHtml: {
        order: "post",
        handler(html) {
          // Replace meta CSP with production policy (no Vite-dev host).
          return html.replace(
            /<meta\s+http-equiv="Content-Security-Policy"[^>]*>/i,
            `<meta http-equiv="Content-Security-Policy" content="${PROD_RENDERER_CSP}" />`,
          );
        },
      },
    },
  ],
  resolve: {
    alias: {
      "@renderer": path.resolve(__dirname, "renderer/src"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: path.resolve(__dirname, "dist-renderer"),
    emptyOutDir: true,
    // Production builds omit maps unless MOTIONVIDEO_SOURCEMAP=1 (release always omits).
    sourcemap: !isRelease && process.env.MOTIONVIDEO_SOURCEMAP === "1",
  },
});