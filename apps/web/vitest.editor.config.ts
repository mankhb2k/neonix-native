import path from "node:path";
import { defineConfig } from "vitest/config";

/** Only certified Protocol V2 app tests run from the root editor contract. */
export default defineConfig({
  test: {
    environment: "happy-dom",
    include: [
      "lib/docs/preview-lab.test.ts",
      "lib/docs/path-rendering-fixtures.test.ts",
      "lib/docs/docs-v2.test.ts",
      "lib/editor/__tests__/*.test.ts",
      "lib/editor/playback/*.test.ts",
      "lib/editor/state/*.test.ts",
      "lib/media/*.test.ts",
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
