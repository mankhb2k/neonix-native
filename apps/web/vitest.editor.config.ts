import path from "node:path";
import { defineConfig } from "vitest/config";

/** Only certified Protocol V2 app tests run from the root editor contract. */
export default defineConfig({
  test: {
    environment: "happy-dom",
    include: [
      "lib/docs/preview-lab.test.ts",
      "lib/docs/docs-v2.test.ts",
      "lib/editor/commands/**/*.test.ts",
      "lib/editor/document/**/*.test.ts",
      "lib/editor/inspector/**/*.test.ts",
      "lib/editor/__tests__/v2-editor-contract.test.ts",
      "lib/editor/preview/preview-controller.test.ts",
      "lib/editor/stage/transform.test.ts",
      "lib/editor/timeline/**/*.test.ts",
    ],
    globals: false,
    clearMocks: true,
    restoreMocks: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
