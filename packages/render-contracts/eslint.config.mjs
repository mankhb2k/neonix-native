import eslintJs from "@eslint/js";
import tseslint from "typescript-eslint";

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
            { name: "react", message: "render-contracts must stay pure TS." },
            { name: "react-dom", message: "render-contracts must stay pure TS." },
            {
              name: "@aws-sdk/client-s3",
              message: "No AWS SDK in render-contracts.",
            },
          ],
          patterns: [
            {
              group: ["apps/*", "**/apps/**", "@/*"],
              message: "render-contracts must not import apps.",
            },
          ],
        },
      ],
    },
  },
);
