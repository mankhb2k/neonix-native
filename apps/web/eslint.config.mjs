/**
 * ESLint flat config for @motionvideo/web (Next.js App Router).
 *
 * Adapted from a strict Next layer config for MotionVideo:
 *  - UI must not call raw HTTP or pull in render engines
 *  - Domain lives in @motionvideo/* packages
 *  - Editor session state stays in EditorSurfaceProvider; document mutations
 *    use Protocol V2 commands
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
import reactWebApi from "eslint-plugin-react-web-api";
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

const testAndToolingFiles = [
  "**/*.spec.{ts,tsx}",
  "**/*.test.{ts,tsx}",
  "e2e/**/*.{ts,tsx}",
];

/** Browser-facing modules must not pull server-only capabilities into the client bundle. */
const clientServerImportPaths = [
  {
    name: "server-only",
    message: "Client modules must not import server-only markers or server modules.",
  },
  {
    name: "@/lib/supabase/server",
    message: "Client modules must use the browser Supabase client.",
  },
  {
    name: "@/lib/mcp/server",
    message: "The MCP server is server-only and must not enter the client bundle.",
  },
];

const clientServerImportPatterns = [
  {
    group: ["@/lib/server/**", "@/app/api/**"],
    message: "Client modules must not import server-only application code.",
  },
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
    ],
    message: "The web editor no longer has a V1 store or persistence path.",
  },
];

const editorBoundaryImportPaths = [
  {
    name: "@motionvideo/editor-core/v2",
    message: "Use the canonical @motionvideo/editor-core document API.",
  },
  {
    name: "@motionvideo/editor-core/timeline-runtime",
    message: "Use the canonical @motionvideo/editor-core/timeline or /interactions APIs.",
  },
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
  "@typescript-eslint/no-empty-object-type": "error",
  "@typescript-eslint/no-unused-vars": [
    "error",
    {
      args: "after-used",
      argsIgnorePattern: "^_",
      varsIgnorePattern: "^_",
      caughtErrorsIgnorePattern: "^_",
      destructuredArrayIgnorePattern: "^_",
      ignoreRestSiblings: true,
    },
  ],
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
      ".next-local3000/**",
      "node_modules/**",
      "next-env.d.ts",
      "eslint.config.mjs",
      "postcss.config.mjs",
      "public/**",
      "playwright.config.ts",
      "vitest.config.ts",
      "vitest.editor.config.ts",
      "tsconfig.editor.json",
      "tsconfig.eslint.json",
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
    plugins: {
      "react-web-api": reactWebApi,
    },
    rules: {
      ...coreSafetyRules,
      ...importRules,
      ...typescriptErrorRules,
      "react-web-api/no-leaked-event-listener": "error",
      "react-web-api/no-leaked-fetch": "error",
      "react-web-api/no-leaked-intersection-observer": "error",
      "react-web-api/no-leaked-interval": "error",
      "react-web-api/no-leaked-resize-observer": "error",
      "react-web-api/no-leaked-timeout": "error",
      "@next/next/no-img-element": "error",
      "@next/next/no-html-link-for-pages": "error",
      "react/jsx-no-useless-fragment": "error",
      "react/no-unstable-nested-components": "error",
      "react/no-array-index-key": "warn",
      "react/no-danger": "warn",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
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
      "i18n/request.ts",
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
    files: ["app/api/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-globals": "off",
    },
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
    ignores: ["lib/editor/document/project-repository.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: clientServerImportPaths,
          patterns: [...clientServerImportPatterns, ...editorLibraryImportPatterns],
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
    files: ["lib/docs/**/*.{ts,tsx}", "lib/guides/**/*.{ts,tsx}"],
    rules: {
      // Documentation/guide definitions include React renderers by design, but remain client-safe.
      "no-restricted-imports": [
        "error",
        {
          paths: clientServerImportPaths,
          patterns: clientServerImportPatterns,
        },
      ],
    },
  },
  {
    files: ["lib/**/*.{ts,tsx}"],
    ignores: [
      "lib/store/**/*.{ts,tsx}",
      "lib/api/**/*.{ts,tsx}",
      "lib/docs/**/*.{ts,tsx}",
      "lib/guides/**/*.{ts,tsx}",
    ],
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
          paths: clientServerImportPaths,
          patterns: [
            ...clientServerImportPatterns,
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
              message: "lib/editor/timeline/ must be pure domain logic — no React or client store allowed.",
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
          paths: [...clientServerImportPaths, ...editorLayerImportPaths],
          patterns: [
            ...clientServerImportPatterns,
            ...editorLayerImportPatterns,
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
            ...clientServerImportPaths,
            ...editorLayerImportPaths,
            {
              name: "axios",
              message: "Use lib/api/* — not raw axios in hooks.",
            },
          ],
          patterns: [
            ...clientServerImportPatterns,
            ...editorLayerImportPatterns,
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
    files: testAndToolingFiles,
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: "./tsconfig.eslint.json",
      },
    },
    rules: {
      "no-restricted-globals": "off",
      "no-restricted-imports": "off",
      "no-restricted-syntax": "off",
      "import/first": "off",
      "import/order": "off",
      "import/no-useless-path-segments": "off",
      "no-console": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
      "@typescript-eslint/no-redundant-type-constituents": "off",
    },
  },
);
