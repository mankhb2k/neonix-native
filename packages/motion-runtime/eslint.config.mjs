import { default as sharedConfig } from "../../eslint.package.mjs";

/**
 * Motion Runtime ESLint config — extends shared baseline with import-boundary
 * guards that prevent the runtime from depending on editor, renderer, compiler,
 * or app packages.
 */
export default [
  ...sharedConfig,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@motionvideo/pixi-renderer",
                "@motionvideo/pixi-renderer/*",
              ],
              message:
                "Runtime must not import Pixi renderer. It is framework-agnostic.",
            },
            {
              group: [
                "@motionvideo/remotion-renderer",
                "@motionvideo/remotion-renderer/*",
              ],
              message:
                "Runtime must not import Remotion renderer. It is framework-agnostic.",
            },
            {
              group: [
                "@motionvideo/motion-compiler",
                "@motionvideo/motion-compiler/*",
              ],
              message:
                "Runtime must not import the compiler. Runtime consumes compiler output, not the compiler itself.",
            },
            {
              group: [
                "@motionvideo/editor-core",
                "@motionvideo/editor-interactions",
                "@motionvideo/editor-react",
                "@motionvideo/motion-workspace",
              ],
              message:
                "Runtime must not import editor packages.",
            },
            {
              group: ["@motionvideo/web", "@motionvideo/desktop"],
              message:
                "Runtime must not import app packages.",
            },
          ],
        },
      ],
    },
  },
  // ── Test files exempt from import-boundary rules ──────────────────
  // Test utilities need the compiler to prepare runtime projects.
  {
    files: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "src/**/__tests__/**/*.{ts,tsx}",
      "src/testing/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
];
