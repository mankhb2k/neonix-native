import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const sharedAlias = {
  "@shared": path.resolve(__dirname, "src/shared"),
  "@renderer": path.resolve(__dirname, "renderer/src"),
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
};

const PERF_FILES = [
  "src/**/stage-renderer-benchmark.test.ts",
  "src/**/performance-virtualization.test.ts",
  "src/**/visible-lane-window.test.ts",
];

export default defineConfig({
  plugins: [react()],
  test: {
    globals: false,
    projects: [
      {
        resolve: { alias: sharedAlias },
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude: [
            ...PERF_FILES,
            "src/**/stage-renderer-contract.test.ts",
          ],
        },
      },
      {
        plugins: [react()],
        resolve: { alias: sharedAlias },
        test: {
          name: "dom",
          environment: "happy-dom",
          include: [
            "renderer/src/**/*.test.ts",
            "renderer/src/**/*.test.tsx",
            "src/**/stage-renderer-contract.test.ts",
          ],
        },
      },
      {
        plugins: [react()],
        resolve: { alias: sharedAlias },
        test: {
          name: "perf",
          environment: "happy-dom",
          include: PERF_FILES,
          // Happy-dom regression only — not Electron 60fps acceptance.
          testTimeout: 60_000,
        },
      },
    ],
  },
  resolve: {
    alias: sharedAlias,
  },
});
