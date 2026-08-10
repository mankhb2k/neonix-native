/**
 * Test taxonomy — shared categories for vitest project tagging.
 *
 * Import this in each package's vitest.config.ts to get consistent
 * test filtering and reporting.
 *
 * Usage in vitest.config.ts:
 *   import { testTaxonomy } from "@motionvideo/editor-core/testing";
 *   // ... use testTaxonomy.unit.include etc.
 */

export const testTaxonomy = {
  /** Pure functions, no DOM, no I/O, parallel-safe, < 100ms each */
  unit: {
    tag: "unit",
    timeout: 5_000,
    environment: "node" as const,
    globPatterns: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },

  /** Module composition, shared state, can use happy-dom */
  integration: {
    tag: "integration",
    timeout: 15_000,
    environment: "happy-dom" as const,
    globPatterns: [
      "src/**/*.integration.test.ts",
      "src/**/*.integration.test.tsx",
    ],
  },

  /** Architecture / dependency rule validation — runs in CI gate */
  arch: {
    tag: "arch",
    timeout: 10_000,
    environment: "node" as const,
    globPatterns: ["src/**/*.arch.test.ts"],
  },

  /** Benchmark & performance regression, longer timeout */
  perf: {
    tag: "perf",
    timeout: 60_000,
    environment: "happy-dom" as const,
    globPatterns: ["src/**/*.benchmark.test.ts", "src/**/*.perf.test.ts"],
  },

  /** End-to-end: full playback, export, parity */
  e2e: {
    tag: "e2e",
    timeout: 120_000,
    environment: "node" as const,
    globPatterns: ["src/**/*.e2e.test.ts", "e2e/**/*.test.ts"],
  },
} as const;

export type TestCategory = keyof typeof testTaxonomy;
