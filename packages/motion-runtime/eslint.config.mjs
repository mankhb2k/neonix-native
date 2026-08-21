import { default as sharedConfig } from "../../eslint.package.mjs";

/**
 * Runtime is a framework-agnostic consumer of Runtime IR V2.
 * It must not depend on Protocol JSON, Compiler, editor, or app packages.
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
                "@motionvideo/motion-protocol",
                "@motionvideo/motion-protocol/*",
              ],
              message:
                "Runtime must not import Protocol schemas. Runtime consumes Runtime IR, not authoring JSON.",
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
                "@motionvideo/editor-react",
              ],
              message: "Runtime must not import editor packages.",
            },
            {
              group: ["@motionvideo/web", "@motionvideo/desktop"],
              message: "Runtime must not import app packages.",
            },
          ],
        },
      ],
    },
  },
];
