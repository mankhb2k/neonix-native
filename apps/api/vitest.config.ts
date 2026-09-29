import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    // Vitest's default esbuild transform strips decorators but does not
    // emit the `design:paramtypes` metadata NestJS's DI container reads at
    // runtime - confirmed for real: an implicit-type constructor param came
    // through as `undefined` under esbuild, and only worked once compiled
    // with a transform that honors `emitDecoratorMetadata` (real `tsc`, and
    // this swc plugin). Required for every Nest module to be testable.
    swc.vite({ module: { type: "es6" } }),
  ],
  test: {
    setupFiles: ["./vitest.setup.ts"],
    // These are real integration tests against Neon/R2/Redis, not mocked
    // unit tests - vitest's 5s default is too tight once several test files
    // each open a fresh connection to real remote services in parallel
    // (e.g. Neon's compute waking from idle under concurrent cold connects).
    testTimeout: 20_000,
  },
});
