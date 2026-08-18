import eslintJs from "@eslint/js";
import tseslint from "typescript-eslint";

/** Ban UI / app / renderer deps from interaction logic. */
export default tseslint.config(
  eslintJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react",
              message: "editor-interactions must not import React.",
            },
            {
              name: "react-dom",
              message: "editor-interactions must not import react-dom.",
            },
            {
              name: "zustand",
              message: "editor-interactions must not import Zustand.",
            },
            {
              name: "next",
              message: "editor-interactions must not import Next.js.",
            },
            {
              name: "electron",
              message: "editor-interactions must not import Electron.",
            },
            {
              name: "pixi.js",
              message: "editor-interactions must not import pixi.js.",
            },
            {
              name: "remotion",
              message: "editor-interactions must not import remotion.",
            },
          ],
          patterns: [
            {
              group: ["apps/*", "**/apps/**", "@/*"],
              message:
                "editor-interactions must not import from apps or @/ aliases.",
            },
          ],
        },
      ],
    },
  },
);
