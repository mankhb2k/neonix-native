import eslintJs from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Shared flat ESLint config for workspace packages.
 *
 * Apps can keep their own framework-specific configs. Packages should use this
 * baseline and add local eslint.config.mjs only when they need package-specific
 * architecture rules.
 */
export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "dist-*/**",
      "coverage/**",
      "node_modules/**",
      "eslint.config.mjs",
      "vitest.config.ts",
      "**/*.d.ts",
      "src/**/__fixtures__/**",
      "src/**/vendor-stubs/**",
    ],
  },
  eslintJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "array-callback-return": "error",
      "eqeqeq": ["error", "always", { null: "ignore" }],
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-return-assign": "error",
      "no-self-assign": "error",
      "no-throw-literal": "error",
      "no-undef": "off",
      "no-unreachable-loop": "error",
      "no-unsafe-optional-chaining": "error",
      "prefer-template": "error",
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-expect-error": "allow-with-description",
          "ts-ignore": true,
          "ts-nocheck": true,
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["src/**/*.{test,spec}.{ts,tsx}", "src/**/__tests__/**/*.{ts,tsx}"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
);
