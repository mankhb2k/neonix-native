import { default as sharedConfig } from "../../eslint.package.mjs";

/**
 * V3 Protocol ESLint config — extends shared baseline with import-boundary
 * guards that keep the authoring protocol (v3) and runtime IR layers separate.
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
  // ── src/v3/** (authoring protocol) ────────────────────────────────
  {
    files: ["src/v3/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../runtime/**", "../../runtime/**"],
              message:
                "src/v3/ must not import from src/runtime/. The authoring protocol must not depend on runtime IR types.",
            },
          ],
        },
      ],
    },
  },
];
