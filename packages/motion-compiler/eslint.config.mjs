import { default as sharedConfig } from "../../eslint.package.mjs";

/**
 * Motion Compiler ESLint config — extends shared baseline with import-boundary
 * guards that prevent the compiler from depending on renderers or apps.
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
                "Compiler must not import Pixi renderer. Use @motionvideo/render-contracts for shared types.",
            },
            {
              group: [
                "@motionvideo/remotion-renderer",
                "@motionvideo/remotion-renderer/*",
              ],
              message:
                "Compiler must not import Remotion renderer. Use @motionvideo/render-contracts for shared types.",
            },
            {
              group: [
                "@motionvideo/web",
                "@motionvideo/desktop",
                "@motionvideo/editor-core",
                "@motionvideo/editor-interactions",
                "@motionvideo/editor-react",
              ],
              message:
                "Compiler must not import app or editor packages. It is a pure transform pipeline.",
            },
          ],
        },
      ],
    },
  },
];
