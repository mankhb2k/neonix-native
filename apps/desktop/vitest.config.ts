import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const sharedAlias = {
  "@shared": path.resolve(__dirname, "shared"),
  "@gui": path.resolve(__dirname, "gui"),
  "@editor-core-fixtures": path.resolve(
    __dirname,
    "../../packages/editor-core/src/testing/fixtures",
  ),
  "@motionvideo/editor-core": path.resolve(
    __dirname,
    "../../packages/editor-core/src/index.ts",
  ),
  "@motionvideo/motion-protocol": path.resolve(
    __dirname,
    "../../packages/motion-protocol/src/index.ts",
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
  "gui/**/stage-renderer-benchmark.test.ts",
  "gui/**/performance-virtualization.test.ts",
  "gui/**/visible-lane-window.test.ts",
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
          include: ["electron/**/*.test.ts", "shared/**/*.test.ts"],
          exclude: [...PERF_FILES, "gui/**/stage-renderer-contract.test.ts"],
        },
      },
      {
        plugins: [react()],
        resolve: { alias: sharedAlias },
        test: {
          name: "dom",
          environment: "happy-dom",
          include: [
            "gui/**/*.test.ts",
            "gui/**/*.test.tsx",
            "gui/**/stage-renderer-contract.test.ts",
          ],
          exclude: [...PERF_FILES],
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
