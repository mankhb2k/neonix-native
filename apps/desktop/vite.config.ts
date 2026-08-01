import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { PROD_RENDERER_CSP } from "./shared/renderer-mode";

const isRelease =
  process.env.MOTIONVIDEO_RELEASE === "1" ||
  process.env.MOTIONVIDEO_RELEASE === "true";

export default defineConfig({
  root: path.resolve(__dirname, "gui"),
  base: "./",
  plugins: [
    tailwindcss(),
    react(),
    {
      name: "motionvideo-prod-csp",
      transformIndexHtml: {
        order: "post",
        handler(html) {
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
      "@gui": path.resolve(__dirname, "gui"),
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
    sourcemap: !isRelease && process.env.MOTIONVIDEO_SOURCEMAP === "1",
  },
});
