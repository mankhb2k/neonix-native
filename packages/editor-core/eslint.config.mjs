import eslintJs from "@eslint/js";
import tseslint from "typescript-eslint";

/** Ban UI / app / Electron deps from the framework-free core. */
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
              message: "editor-core must not import React.",
            },
            {
              name: "react-dom",
              message: "editor-core must not import react-dom.",
            },
            {
              name: "zustand",
              message: "editor-core must not import Zustand.",
            },
            {
              name: "next",
              message: "editor-core must not import Next.js.",
            },
            {
              name: "electron",
              message: "editor-core must not import Electron.",
            },
          ],
          patterns: [
            {
              group: ["apps/*", "**/apps/**", "@/*"],
              message: "editor-core must not import from apps or @/ aliases.",
            },
          ],
        },
      ],
    },
  },
);
