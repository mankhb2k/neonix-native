/**
 * ESLint flat config for @motionvideo/desktop (Vite React + Electron).
 *
 * Ported from apps/web safety / import / TS rules — without next/core-web-vitals.
 *
 * @see docs/lint.md
 */
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import eslint from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const __dirname = dirname(fileURLToPath(import.meta.url));

const webBanPatterns = [
  {
    group: ["**/apps/web/**", "apps/web/**", "@/components/desktop/**"],
    message:
      "Desktop must not import from apps/web — copy leaf UI into renderer/src/ui instead.",
  },
  {
    group: ["@motion-canvas/*", "motion-canvas", "@motioncanvas/*"],
    message: "Motion Canvas belongs in apps/render-worker — not the desktop UI.",
  },
  {
    group: ["**/render-worker/**", "@motionvideo/render-worker"],
    message: "Do not import render-worker from the desktop app.",
  },
  {
    group: ["next", "next/**"],
    message: "Desktop Vite must not import Next.js.",
  },
];

const coreSafetyRules = {
  eqeqeq: ["error", "always", { null: "ignore" }],
  "no-eval": "error",
  "no-implied-eval": "error",
  "no-new-func": "error",
  "no-script-url": "error",
  "no-throw-literal": "error",
  "array-callback-return": "error",
  "no-promise-executor-return": "error",
  "no-return-assign": "error",
  "no-self-assign": "error",
  "no-unreachable-loop": "error",
  "no-unsafe-optional-chaining": "error",
  "no-console": "error",
  "no-param-reassign": [
    "error",
    {
      props: true,
      ignorePropertyModificationsFor: ["acc", "draft", "state"],
    },
  ],
  "consistent-return": "error",
  "default-case": "error",
  "prefer-template": "error",
};

const importRules = {
  "import/no-duplicates": "error",
  "import/no-self-import": "error",
  "import/no-useless-path-segments": "error",
  "import/no-relative-packages": "error",
  "import/first": "error",
  "import/newline-after-import": "error",
  "import/order": [
    "error",
    {
      groups: [
        "builtin",
        "external",
        "internal",
        "parent",
        "sibling",
        "index",
        "type",
      ],
      pathGroups: [
        { pattern: "@renderer/**", group: "internal", position: "before" },
        {
          pattern: "@motionvideo/**",
          group: "internal",
          position: "before",
        },
      ],
      pathGroupsExcludedImportTypes: ["builtin", "type"],
      alphabetize: { order: "asc", caseInsensitive: true },
      "newlines-between": "never",
    },
  ],
  "import/no-restricted-paths": [
    "error",
    {
      zones: [
        {
          target: "./renderer/**/*",
          from: "./../../web/**/*",
          message:
            "Desktop renderer must not import from apps/web — copy leaf UI instead.",
        },
        {
          target: "./renderer/**/*",
          from: "../web/**/*",
          message:
            "Desktop renderer must not import from apps/web — copy leaf UI instead.",
        },
      ],
    },
  ],
};

const typescriptErrorRules = {
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/ban-ts-comment": [
    "error",
    {
      "ts-expect-error": "allow-with-description",
      "ts-ignore": true,
      "ts-nocheck": true,
    },
  ],
  "@typescript-eslint/no-floating-promises": "error",
  "@typescript-eslint/no-misused-promises": [
    "error",
    {
      checksVoidReturn: { attributes: false },
    },
  ],
  "@typescript-eslint/no-unused-vars": [
    "error",
    { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
  ],
};

/** Classic hooks rules only — React Compiler extras are too noisy for this wave. */
const reactHooksClassicRules = {
  "react-hooks/rules-of-hooks": "error",
  "react-hooks/exhaustive-deps": "warn",
};

const jsxA11yWarnRules = Object.fromEntries(
  Object.entries(jsxA11y.flatConfigs.recommended.rules ?? {}).map(
    ([key, value]) => [key, value === "error" ? "warn" : value],
  ),
);

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "dist-renderer/**",
      "storybook-static/**",
      "release/**",
      "resources/**",
      "tmp/**",
      "node_modules/**",
      "eslint.config.mjs",
      "vite.config.ts",
      "vitest.config.ts",
      "**/*.js.map",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  // --- QA / capture scripts (release gates) ---
  {
    files: ["scripts/**/*.{mjs,cjs,js}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        console: "readonly",
        process: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        module: "readonly",
        require: "readonly",
        exports: "readonly",
        Buffer: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        URL: "readonly",
      },
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-var-requires": "off",
    },
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        URL: "readonly",
      },
    },
  },

  // --- Renderer (Vite React) — type-aware for selected TS rules ---
  {
    files: ["renderer/src/**/*.{ts,tsx}"],
    ...react.configs.flat.recommended,
    ...react.configs.flat["jsx-runtime"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      import: importPlugin,
      react: react,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
    },
    settings: {
      react: { version: "detect" },
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: "./tsconfig.renderer.json",
        },
      },
    },
    rules: {
      ...coreSafetyRules,
      ...importRules,
      ...typescriptErrorRules,
      ...reactHooksClassicRules,
      ...jsxA11yWarnRules,
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",
      "react/jsx-no-useless-fragment": "error",
      "react/no-unstable-nested-components": "error",
      "react/no-array-index-key": "warn",
      "react/no-danger": "warn",
      "react/no-unescaped-entities": ["error", { forbid: [">", "}"] }],
      "react/prop-types": "off",
      "no-restricted-syntax": [
        "error",
        {
          selector: "ExportDefaultDeclaration",
          message: "Use named exports in the desktop Vite renderer.",
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: webBanPatterns,
        },
      ],
    },
  },

  // ui/ — no Electron / IPC / session
  {
    files: ["renderer/src/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "electron",
              message: "ui/ primitives must not import Electron.",
            },
          ],
          patterns: [
            ...webBanPatterns,
            {
              group: [
                "**/infrastructure/**",
                "@renderer/infrastructure/**",
                "**/editor/session/**",
                "@renderer/editor/session/**",
                "**/shared/ipc/**",
              ],
              message:
                "ui/ must stay free of IPC, session, and infrastructure — pass props from feature containers.",
            },
          ],
        },
      ],
    },
  },

  // app + editor + infrastructure
  {
    files: [
      "renderer/src/app/**/*.{ts,tsx}",
      "renderer/src/editor/**/*.{ts,tsx}",
      "renderer/src/infrastructure/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: webBanPatterns,
        },
      ],
    },
  },

  // --- shared (no React) ---
  {
    files: ["src/shared/**/*.{ts,tsx}"],
    plugins: {
      import: importPlugin,
    },
    rules: {
      ...coreSafetyRules,
      ...importRules,
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: webBanPatterns,
        },
      ],
    },
  },

  // --- main / preload ---
  {
    files: ["src/main/**/*.{ts,tsx}", "src/preload/**/*.{ts,tsx}"],
    plugins: {
      import: importPlugin,
    },
    rules: {
      ...coreSafetyRules,
      ...importRules,
      "no-console": [
        "error",
        { allow: ["info", "warn", "error", "debug"] },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: webBanPatterns,
        },
      ],
    },
  },

  // --- tests ---
  {
    files: ["**/*.{test,spec}.{ts,tsx}", "**/__tests__/**/*.{ts,tsx}"],
    rules: {
      "no-console": "off",
      "no-restricted-imports": "off",
      "import/first": "off",
      "import/order": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/no-misused-promises": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "react/no-unstable-nested-components": "off",
      "react-hooks/exhaustive-deps": "off",
      "jsx-a11y/no-static-element-interactions": "off",
      "jsx-a11y/click-events-have-key-events": "off",
    },
  },
);
