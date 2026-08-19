# motion-mcp

Transport-agnostic MCP package for MotionVideo.

This package is the home for:

- MCP tool contracts
- tool registry
- project validation / patch / compile operations
- future stdio or HTTP server adapters

It depends on:

- `@motionvideo/motion-protocol` for JSON schema / validation
- `@motionvideo/motion-compiler` for compile

It intentionally does not own render, preview UI, or editor concerns.
