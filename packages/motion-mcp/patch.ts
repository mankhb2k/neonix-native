// Root-level re-export shim so `@motionvideo/motion-mcp/patch` resolves
// under TypeScript's classic "node" moduleResolution too (which ignores
// package.json "exports" subpaths entirely and falls back to literal file
// resolution - see the "./patch" entry in package.json for the modern-
// resolution-aware consumers, and src/patch.ts for why this subpath exists
// at all).
export * from "./src/patch";
