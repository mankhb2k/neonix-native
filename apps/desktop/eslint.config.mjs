import eslintJs from "@eslint/js";
import tseslint from "typescript-eslint";

/** Desktop renderer + shared — ban apps/web imports. */
export default tseslint.config(
  eslintJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["dist/**", "dist-renderer/**", "release/**", "resources/**"],
  },
  {
    files: ["renderer/src/**/*.{ts,tsx}", "src/shared/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/apps/web/**", "apps/web/**", "@/components/desktop/**"],
              message:
                "Desktop must not import from apps/web — copy leaf UI into renderer/src/ui instead.",
            },
          ],
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
