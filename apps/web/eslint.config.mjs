/**
 * ESLint flat config for @motionvideo/web (Next.js App Router).
 *
 * Adapted from a strict Next layer config for MotionVideo:
 *  - UI must not call raw HTTP or pull in render engines
 *  - Domain lives in @motionvideo/* packages
 *  - Editor store may mutate drafts (Zustand)
 *
 * Scripts:
 *  - pnpm --filter @motionvideo/web lint
 *  - pnpm --filter @motionvideo/web lint:ci
 *
 * @see docs/lint.md
 */
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { FlatCompat } from "@eslint/eslintrc";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({
  baseDirectory: __dirname,
});

/** UI + route layers — no raw fetch/axios; no render-worker / Motion Canvas. */
const appLayerFiles = [
  "app/**/*.{ts,tsx}",
  "components/**/*.{ts,tsx}",
  "hooks/**/*.{ts,tsx}",
];

/** Imports that would reintroduce the removed V1 editor boundary. */
const editorBoundaryImportPatterns = [
  {
    group: ["@/lib/v2-editor", "@/lib/v2-editor/**"],
    message: "Use the canonical @/lib/editor V2 modules.",
  },
  {
    group: [
      "@/lib/editor/store",
      "@/lib/editor/store/**",
      "@/lib/editor/authoring",
      "@/lib/editor/authoring/**",
      "@/lib/editor/persistence",
      "@/lib/editor/persistence/**",
      "@/lib/editor/legacy-runtime",
      "@/lib/editor/legacy-runtime/**",
    ],
    message: "The web editor no longer has a V1 store or persistence path.",
  },
];

const editorBoundaryImportPaths = [
  {
    name: "@motionvideo/motion-protocol",
    message: "Editor code must use @motionvideo/motion-protocol/v2 explicitly.",
  },
  {
    name: "@motionvideo/motion-protocol/runtime",
    message: "Editor code must use @motionvideo/motion-protocol/v2 explicitly.",
  },
  {
    name: "@motionvideo/motion-protocol/v1",
    message: "Editor code must use @motionvideo/motion-protocol/v2 explicitly.",
  },
];

const editorLayerImportPatterns = [
  {
    group: ["@motion-canvas/*", "motion-canvas", "@motioncanvas/*"],
    message:
      "Motion Canvas belongs in apps/render-worker â€” editor only edits Motion JSON.",
  },
  {
    group: ["**/render-worker/**", "@motionvideo/render-worker"],
    message: "Do not import render-worker from the web app.",
  },
  {
    group: [
      "@/lib/editor/timeline/timeline-seek",
      "@/lib/editor/pointer-session",
      "@/lib/editor/timeline/sessions/pointer-session-controller",
    ],
    message:
      "Import pure gesture logic from @motionvideo/editor-core; use apps/web/lib/editor/interaction-host for DOM adapters.",
  },
  ...editorBoundaryImportPatterns,
];

const editorLayerImportPaths = [
  {
    name: "axios",
    message: "Use lib/api/* â€” not raw axios in app/components/hooks.",
  },
  ...editorBoundaryImportPaths,
];

const editorLibraryImportPatterns = [
  {
    group: ["react", "react/*", "react-dom", "react-dom/*"],
    message:
      "Keep lib/editor free of React unless it is a UI adapter.",
  },
  {
    group: ["@/hooks/**", "@/components/**", "@/app/**"],
    message: "lib/editor must not import hooks, components, or app.",
  },
  {
    group: ["@motion-canvas/*", "**/render-worker/**"],
    message: "Render engines stay in apps/render-worker.",
  },
  ...editorBoundaryImportPatterns,
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
  "import/first": "error",
  "import/newline-after-import": "error",
  "import/order": [
    "warn",
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
        { pattern: "@/**", group: "internal", position: "before" },
        {
          pattern: "@motionvideo/**",
          group: "internal",
          position: "before",
        },
      ],
      pathGroupsExcludedImportTypes: ["type"],
      alphabetize: { order: "asc", caseInsensitive: true },
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
};

const appLayerRestrictions = {
  "no-restricted-globals": [
    "error",
    {
      name: "fetch",
      message:
        "Use lib/api/* for HTTP — not raw fetch in app/components/hooks.",
    },
  ],
  "no-restricted-imports": [
    "error",
    {
      paths: [
        {
          name: "axios",
          message: "Use lib/api/* — not raw axios in app/components/hooks.",
        },
      ],
      patterns: [
        {
          group: ["@motion-canvas/*", "motion-canvas", "@motioncanvas/*"],
          message:
            "Motion Canvas belongs in apps/render-worker — editor only edits Motion JSON.",
        },
        {
          group: ["**/render-worker/**", "@motionvideo/render-worker"],
          message: "Do not import render-worker from the web app.",
        },
        {
          group: [
            "@/lib/editor/timeline/timeline-seek",
            "@/lib/editor/pointer-session",
            "@/lib/editor/timeline/sessions/pointer-session-controller",
          ],
          message:
            "Import pure gesture logic from @motionvideo/editor-core; use apps/web/lib/editor/interaction-host for DOM adapters.",
        },
      ],
    },
  ],
};

export default tseslint.config(
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      "eslint.config.mjs",
      "postcss.config.mjs",
      "public/**",
      "e2e/**",
      "playwright.config.ts",
      "vitest.config.ts",
      "vitest.editor.config.ts",
      "tsconfig.editor.json",
    ],
  },
  eslint.configs.recommended,
  ...compat.extends("next/core-web-vitals"),
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    settings: {
      "import/resolver": {
        typescript: {
          project: "./tsconfig.json",
        },
      },
    },
    rules: {
      ...coreSafetyRules,
      ...importRules,
      ...typescriptErrorRules,
      "@next/next/no-img-element": "error",
      "@next/next/no-html-link-for-pages": "error",
      "react/jsx-no-useless-fragment": "error",
      "react/no-unstable-nested-components": "error",
      "react/no-array-index-key": "warn",
      "react/no-danger": "warn",
      "react/no-unescaped-entities": ["error", { forbid: [">", "}"] }],
      "no-restricted-syntax": [
        "error",
        {
          selector: "ExportDefaultDeclaration",
          message:
            "Use named exports — default export only in page.tsx, layout.tsx, loading.tsx, error.tsx, not-found.tsx, middleware.ts, next.config.ts.",
        },
      ],
    },
  },
  {
    files: [
      "**/page.tsx",
      "**/layout.tsx",
      "**/loading.tsx",
      "**/error.tsx",
      "**/not-found.tsx",
      "**/template.tsx",
      "**/default.tsx",
      "middleware.ts",
      "next.config.ts",
    ],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  {
    files: appLayerFiles,
    rules: appLayerRestrictions,
  },
  {
    files: [
      "app/app/editor/**/*.{ts,tsx}",
      "components/editor/**/*.{ts,tsx}",
      "hooks/editor/**/*.{ts,tsx}",
      "lib/editor/**/*.{ts,tsx}",
    ],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: "./tsconfig.editor.json",
      },
    },
  },
  {
    files: [
      "app/app/editor/**/*.{ts,tsx}",
      "components/editor/**/*.{ts,tsx}",
      "hooks/editor/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: editorLayerImportPaths,
          patterns: editorLayerImportPatterns,
        },
      ],
    },
  },
  {
    files: ["lib/editor/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: editorLibraryImportPatterns,
        },
      ],
    },
  },
  {
    files: ["lib/api/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react",
              message: "lib/api must not import React.",
            },
          ],
          patterns: [
            {
              group: ["@/hooks/**", "@/components/**", "@/app/**"],
              message: "lib/api must not import hooks, components, or app.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["lib/**/*.{ts,tsx}"],
    ignores: ["lib/store/**/*.{ts,tsx}", "lib/api/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["react", "react/*", "react-dom", "react-dom/*"],
              message:
                "Keep lib/* free of React unless it is lib/store or a UI adapter.",
            },
            {
              group: ["@/hooks/**", "@/components/**", "@/app/**"],
              message: "lib/* must not import hooks, components, or app.",
            },
            {
              group: ["@motion-canvas/*", "**/render-worker/**"],
              message: "Render engines stay in apps/render-worker.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["lib/store/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/components/**", "@/app/**"],
              message: "Store must not import components or app routes.",
            },
            {
              group: ["@motion-canvas/*", "**/render-worker/**"],
              message: "Store holds Motion JSON only — no render engine.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["lib/editor/timeline/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["react", "react-dom", "react-dom/*", "zustand", "zustand/*"],
              message: "lib/editor/timeline/ must be pure domain logic — no React or Zustand allowed.",
            },
            {
              group: ["@/components/**", "@/app/**", "@/hooks/**"],
              message: "lib/editor/timeline/ must not import components, app, or hooks.",
            },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        { name: "window", message: "lib/editor/timeline/ must be pure domain — no DOM globals." },
        { name: "document", message: "lib/editor/timeline/ must be pure domain — no DOM globals." },
        { name: "HTMLElement", message: "lib/editor/timeline/ must be pure domain — no DOM globals." },
      ],
    },
  },
  {
    files: ["components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/editor/store/internal/**"],
              message: "Components must import timeline public API (@/lib/editor/timeline) — do not import store/internal directly.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["hooks/**/*.{ts,tsx}"],
    rules: {
      ...appLayerRestrictions,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "axios",
              message: "Use lib/api/* — not raw axios in hooks.",
            },
          ],
          patterns: [
            {
              group: ["@/components/**", "@/app/**"],
              message: "hooks/ must not import components or app.",
            },
            {
              group: ["@motion-canvas/*", "**/render-worker/**"],
              message: "hooks/ must not import render engines.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.spec.ts", "**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "no-restricted-globals": "off",
      "no-restricted-imports": "off",
      "import/first": "off",
      "no-console": "off",
    },
  },
);
