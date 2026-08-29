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
                "@motionvideo/web",
                "@motionvideo/desktop",
                "@motionvideo/editor-core",
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
