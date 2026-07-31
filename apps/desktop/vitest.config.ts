import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: false,
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "src/shared"),
      "@motionvideo/editor-core": path.resolve(
        __dirname,
        "../../packages/editor-core/src/index.ts",
      ),
      "@motionvideo/motion-schema": path.resolve(
        __dirname,
        "../../packages/motion-schema/src/index.ts",
      ),
      "@motionvideo/motion-runtime": path.resolve(
        __dirname,
        "../../packages/motion-runtime/src/index.ts",
      ),
      "@motionvideo/motion-compiler": path.resolve(
        __dirname,
        "../../packages/motion-compiler/src/index.ts",
      ),
    },
  },
});
