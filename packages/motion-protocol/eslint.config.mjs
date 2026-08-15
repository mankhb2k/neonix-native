import { default as sharedConfig } from "../../eslint.package.mjs";

/**
 * V1 Protocol ESLint config — extends shared baseline with import-boundary
 * guards that keep the authoring protocol (v1) and runtime IR layers separate.
 */
export default [
  ...sharedConfig,
  // ── src/index.ts (public barrel) ──────────────────────────────────
  {
    files: ["src/index.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["./runtime/layers", "./runtime/layers/*"],
              message:
                "src/index.ts must not import from runtime/layers. Runtime node types are a separate entry point.",
            },
          ],
        },
      ],
    },
  },
  // ── src/v1/** (authoring protocol) ────────────────────────────────
  {
    files: ["src/v1/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../runtime/**", "../../runtime/**"],
              message:
                "src/v1/ must not import from src/runtime/. The authoring protocol must not depend on runtime IR types.",
            },
          ],
        },
      ],
    },
  },
];
