import eslintJs from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslintJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["src/vendor-stubs/**"],
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "zustand", message: "editor-react must not import Zustand." },
            { name: "@motionvideo/preview-renderer", message: "editor-react must not import preview renderer." },
            { name: "remotion", message: "editor-react must not import remotion." },
          ],
          patterns: [
            {
              group: ["apps/*", "**/apps/**", "@/*"],
              message: "editor-react must not import from apps.",
            },
          ],
        },
      ],
    },
  },
);
